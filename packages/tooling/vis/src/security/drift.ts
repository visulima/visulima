import { isAccessibleSync, readFileSync, readJsonSync } from "@visulima/fs";
import { readTomlSync } from "@visulima/fs/toml";
import { readYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";

import type { VisConfig } from "../config/workspace";
import { parseDurationToMinutes } from "./duration";
import type { PackageManagerName } from "./types";

interface PmNativeSnapshot {
    allowBuilds?: Set<string>;
    minReleaseAgeExcludes?: Set<string>;
    minReleaseAgeMinutes?: number;
}

/**
 * Reads the package manager's native security knobs into a normalised
 * snapshot for drift comparison. All durations are in minutes.
 *
 * Limitations:
 *
 * - **bun**: `trustedDependencies` is only read from the workspace-root
 *   `package.json`. Per-workspace arrays are ignored — bun runs install
 *   from the root, so root is the only source of truth for the gate, but
 *   if a sub-workspace also lists trusted deps they will not contribute
 *   to drift comparison here.
 */
const readPmNativeSnapshot = (pm: PackageManagerName, workspaceRoot: string): PmNativeSnapshot => {
    const snapshot: PmNativeSnapshot = {};

    try {
        switch (pm) {
            case "bun": {
                const pkgPath = join(workspaceRoot, "package.json");

                if (isAccessibleSync(pkgPath)) {
                    const pkg = readJsonSync(pkgPath) as { trustedDependencies?: string[] };

                    if (Array.isArray(pkg.trustedDependencies)) {
                        snapshot.allowBuilds = new Set(pkg.trustedDependencies);
                    }
                }

                const tomlPath = join(workspaceRoot, "bunfig.toml");

                if (isAccessibleSync(tomlPath)) {
                    const data = readTomlSync(tomlPath) as { install?: { minimumReleaseAge?: number; minimumReleaseAgeExcludes?: string[] } } | undefined;
                    const rawSeconds = data?.install?.minimumReleaseAge;

                    if (typeof rawSeconds === "number") {
                        snapshot.minReleaseAgeMinutes = Math.round(rawSeconds / 60);
                    }

                    if (Array.isArray(data?.install?.minimumReleaseAgeExcludes)) {
                        snapshot.minReleaseAgeExcludes = new Set(data.install.minimumReleaseAgeExcludes);
                    }
                }

                break;
            }

            case "npm": {
                const npmrcPath = join(workspaceRoot, ".npmrc");

                if (isAccessibleSync(npmrcPath)) {
                    const content = readFileSync(npmrcPath);
                    const match = /^\s*min-release-age\s*=\s*([^\s#;]+)/m.exec(content);

                    if (match) {
                        snapshot.minReleaseAgeMinutes = parseDurationToMinutes(match[1]!);
                    }
                }

                break;
            }

            case "pnpm": {
                const yamlPath = join(workspaceRoot, "pnpm-workspace.yaml");

                if (isAccessibleSync(yamlPath)) {
                    const data = readYamlSync(yamlPath) as
                        | {
                            allowBuilds?: Record<string, boolean>;
                            minimumReleaseAge?: number;
                            minimumReleaseAgeExclude?: string[];
                            onlyBuiltDependencies?: string[];
                        }
                        | undefined;

                    if (data?.allowBuilds && typeof data.allowBuilds === "object") {
                        snapshot.allowBuilds = new Set(
                            Object.entries(data.allowBuilds)
                                .filter(([, v]) => v)
                                .map(([k]) => k),
                        );
                    } else if (Array.isArray(data?.onlyBuiltDependencies)) {
                        snapshot.allowBuilds = new Set(data.onlyBuiltDependencies);
                    }

                    if (typeof data?.minimumReleaseAge === "number") {
                        snapshot.minReleaseAgeMinutes = data.minimumReleaseAge;
                    }

                    if (Array.isArray(data?.minimumReleaseAgeExclude)) {
                        snapshot.minReleaseAgeExcludes = new Set(data.minimumReleaseAgeExclude);
                    }
                }

                break;
            }

            case "yarn": {
                const yarnrcPath = join(workspaceRoot, ".yarnrc.yml");

                if (isAccessibleSync(yarnrcPath)) {
                    const data = readYamlSync(yarnrcPath) as { npmMinimalAgeGate?: number | string } | undefined;
                    const raw = data?.npmMinimalAgeGate;

                    if (typeof raw === "string") {
                        snapshot.minReleaseAgeMinutes = parseDurationToMinutes(raw);
                    } else if (typeof raw === "number") {
                        snapshot.minReleaseAgeMinutes = raw;
                    }
                }

                break;
            }

            default: {
                break;
            }
        }
    } catch {
        // Best-effort: malformed config files yield an empty snapshot.
    }

    return snapshot;
};

interface DriftReport {
    allowBuilds?: { onlyInPm: string[]; onlyInVis: string[] };
    /** True if any of the compared fields disagree. */
    hasDrift: boolean;
    minReleaseAge?: { pm?: number; vis?: number };
    minReleaseAgeExcludes?: { onlyInPm: string[]; onlyInVis: string[] };
    packageManager: PackageManagerName;
}

/**
 * Compares `vis.config` security settings to what is actually written in
 * the package manager's native config files. The result is a `DriftReport`
 * the caller can render at the end of `vis install` / `vis update` to nudge
 * users towards running the relevant sync command.
 *
 * Only fields the user has set in vis-config are checked — an undefined
 * vis value is treated as "no opinion" and never reported as drift.
 */
const checkPmNativeConfigDrift = (config: VisConfig, pm: PackageManagerName, workspaceRoot: string): DriftReport => {
    const snapshot = readPmNativeSnapshot(pm, workspaceRoot);
    const report: DriftReport = { hasDrift: false, packageManager: pm };
    const security = config.security ?? {};

    const policies = security.policies ?? {};
    const installScripts = policies.install_scripts;
    const firstSeen = policies.first_seen;

    if (installScripts?.allow && (pm === "pnpm" || pm === "bun")) {
        const visApproved = new Set(
            Object.entries(installScripts.allow)
                .filter(([, v]) => v)
                .map(([k]) => k),
        );
        const pmApproved = snapshot.allowBuilds ?? new Set<string>();
        const onlyInVis = [...visApproved].filter((x) => !pmApproved.has(x));
        const onlyInPm = [...pmApproved].filter((x) => !visApproved.has(x));

        if (onlyInVis.length > 0 || onlyInPm.length > 0) {
            report.allowBuilds = { onlyInPm, onlyInVis };
            report.hasDrift = true;
        }
    }

    if (firstSeen?.minutes !== undefined) {
        const yarnClassic = pm === "yarn" && snapshot.minReleaseAgeMinutes === undefined && !isAccessibleSync(join(workspaceRoot, ".yarnrc.yml"));

        if (!yarnClassic && snapshot.minReleaseAgeMinutes !== firstSeen.minutes) {
            report.minReleaseAge = { pm: snapshot.minReleaseAgeMinutes, vis: firstSeen.minutes };
            report.hasDrift = true;
        }
    }

    if (firstSeen?.exclude && (pm === "pnpm" || pm === "bun")) {
        const visSet = new Set(firstSeen.exclude);
        const pmSet = snapshot.minReleaseAgeExcludes ?? new Set<string>();
        const onlyInVis = [...visSet].filter((x) => !pmSet.has(x));
        const onlyInPm = [...pmSet].filter((x) => !visSet.has(x));

        if (onlyInVis.length > 0 || onlyInPm.length > 0) {
            report.minReleaseAgeExcludes = { onlyInPm, onlyInVis };
            report.hasDrift = true;
        }
    }

    return report;
};

/**
 * Renders a `DriftReport` as a list of human-readable lines, ready to feed
 * into `pail.warn` / `pail.info`. Returns an empty array when there is no
 * drift.
 */
const formatDriftReport = (report: DriftReport): string[] => {
    if (!report.hasDrift) {
        return [];
    }

    const lines: string[] = [`vis.config and ${report.packageManager}-native config disagree on security settings:`];

    if (report.allowBuilds) {
        if (report.allowBuilds.onlyInVis.length > 0) {
            lines.push(`  allowBuilds — only in vis.config: ${report.allowBuilds.onlyInVis.join(", ")}`);
        }

        if (report.allowBuilds.onlyInPm.length > 0) {
            lines.push(`  allowBuilds — only in ${report.packageManager} config: ${report.allowBuilds.onlyInPm.join(", ")}`);
        }
    }

    if (report.minReleaseAge) {
        const vis = report.minReleaseAge.vis === undefined ? "unset" : `${String(report.minReleaseAge.vis)} min`;
        const pm = report.minReleaseAge.pm === undefined ? "unset" : `${String(report.minReleaseAge.pm)} min`;

        lines.push(`  minimumReleaseAge — vis.config: ${vis}, ${report.packageManager}: ${pm}`);
    }

    if (report.minReleaseAgeExcludes) {
        if (report.minReleaseAgeExcludes.onlyInVis.length > 0) {
            lines.push(`  minimumReleaseAgeExclude — only in vis.config: ${report.minReleaseAgeExcludes.onlyInVis.join(", ")}`);
        }

        if (report.minReleaseAgeExcludes.onlyInPm.length > 0) {
            lines.push(`  minimumReleaseAgeExclude — only in ${report.packageManager} config: ${report.minReleaseAgeExcludes.onlyInPm.join(", ")}`);
        }
    }

    lines.push("  Run 'vis security sync' to push vis.config values to the native config.");

    return lines;
};

export type { DriftReport };
export { checkPmNativeConfigDrift, formatDriftReport };
