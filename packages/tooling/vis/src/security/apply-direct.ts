/**
 * Direct-dependency apply planner for `vis audit --apply`.
 *
 * Walks every workspace `package.json` (root + workspaces) looking for
 * vulnerable packages declared in `dependencies` / `devDependencies` /
 * `optionalDependencies` / `peerDependencies`. For each match, computes
 * the lowest fixed version reported by the advisory and classifies the
 * upgrade as `in-range` (caret bump that satisfies the existing range)
 * or `major` (the fix is outside the declared range — requires
 * `--allow-major`).
 *
 * Pure planner — does not touch disk. The audit handler hands the plan
 * to {@link "../pm/pm-runner".runAdd} to actually run the PM upgrade
 * after the user confirms.
 */

import { readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { coerce, satisfies } from "semver";

import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../config/workspace";

const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;

type DepField = typeof DEP_FIELDS[number];

interface PackageJsonShape {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    name?: string;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    workspaces?: string[] | { packages?: string[] };
}

/** A single direct-dep upgrade planned by `--apply`. */
export interface DirectFix {
    /** Existing version range from the manifest (`"^1.2.0"`). */
    currentRange: string;
    /** Which dependency field the entry lives in. */
    field: DepField;

    /**
     * True when the lowest fixed version satisfies the existing range. False
     * means the upgrade crosses a major boundary; requires `--allow-major`.
     */
    inRange: boolean;
    /** Manifest path that declared the dependency. */
    manifestPath: string;
    /** Package name as declared in the workspace manifest. */
    packageName: string;
    /** Caret-pinned spec used for the PM update call (`"^1.2.3"`). */
    targetSpec: string;
    /** Lowest reported fixed version (`"1.2.3"` — bare, no range). */
    targetVersion: string;
    /** Workspace name from the manifest, or `undefined` for the root. */
    workspaceName?: string;
}

export interface DirectApplyPlan {
    /** Fixes the planner is willing to apply (in-range, or major + allowMajor). */
    apply: DirectFix[];
    /** Fixes that would cross a major boundary and were skipped. */
    skippedMajor: DirectFix[];
    /** Findings that aren't direct deps anywhere — handled by `--apply-transitive`. */
    unmatched: { packageName: string; reason: "no-fixed-version" | "transitive-only" }[];
}

const readPackageJsonSafe = (path: string): { path: string; pkg: PackageJsonShape } | undefined => {
    try {
        return { path, pkg: readJsonSync(path) as PackageJsonShape };
    } catch {
        return undefined;
    }
};

interface CollectedManifest {
    path: string;
    pkg: PackageJsonShape;
    workspaceName?: string;
}

const collectWorkspaceManifests = (workspaceRoot: string): CollectedManifest[] => {
    const collected: CollectedManifest[] = [];

    const root = readPackageJsonSafe(join(workspaceRoot, "package.json"));

    if (root) {
        collected.push({ path: root.path, pkg: root.pkg, workspaceName: root.pkg.name });
    }

    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);
    let patterns: string[] | undefined;

    if (pnpmPatterns) {
        patterns = pnpmPatterns;
    } else if (root?.pkg.workspaces) {
        if (Array.isArray(root.pkg.workspaces)) {
            patterns = root.pkg.workspaces;
        } else if (root.pkg.workspaces.packages) {
            patterns = root.pkg.workspaces.packages;
        }
    }

    if (!patterns) {
        return collected;
    }

    for (const dir of resolveWorkspacePatterns(workspaceRoot, patterns)) {
        const ws = readPackageJsonSafe(join(workspaceRoot, dir, "package.json"));

        if (ws) {
            collected.push({ path: ws.path, pkg: ws.pkg, workspaceName: ws.pkg.name });
        }
    }

    return collected;
};

const findDeclarations = (
    manifests: CollectedManifest[],
    packageName: string,
): { field: DepField; manifest: CollectedManifest; range: string }[] => {
    const out: { field: DepField; manifest: CollectedManifest; range: string }[] = [];

    for (const manifest of manifests) {
        for (const field of DEP_FIELDS) {
            const range = manifest.pkg[field]?.[packageName];

            if (typeof range === "string") {
                out.push({ field, manifest, range });
            }
        }
    }

    return out;
};

export interface BuildDirectApplyPlanOptions {
    /**
     * When true, the planner promotes major-bumping fixes into `apply`.
     * Default `false` — the audit handler shows them under `skippedMajor`
     * with a `--allow-major` hint instead of executing silently.
     */
    allowMajor?: boolean;
    findings: ReadonlyArray<{ packageName: string; vulnerability: { fixedVersions: string[] } }>;
    workspaceRoot: string;
}

/**
 * Build a direct-dep apply plan from audit findings.
 *
 * Returns three buckets:
 * - `apply`: fixes ready to dispatch via the PM update command.
 * - `skippedMajor`: in-manifest matches whose lowest fix is a major bump.
 * - `unmatched`: findings that aren't declared anywhere — these belong to
 *   `--apply-transitive`. Includes `no-fixed-version` for findings the
 *   advisory hasn't fixed yet (skipped silently).
 */
export const buildDirectApplyPlan = (options: BuildDirectApplyPlanOptions): DirectApplyPlan => {
    const manifests = collectWorkspaceManifests(options.workspaceRoot);
    const apply: DirectFix[] = [];
    const skippedMajor: DirectFix[] = [];
    const unmatched: DirectApplyPlan["unmatched"] = [];
    const seenFixes = new Set<string>();

    for (const finding of options.findings) {
        const lowest = finding.vulnerability.fixedVersions[0];

        if (!lowest) {
            unmatched.push({ packageName: finding.packageName, reason: "no-fixed-version" });

            continue;
        }

        const declarations = findDeclarations(manifests, finding.packageName);

        if (declarations.length === 0) {
            unmatched.push({ packageName: finding.packageName, reason: "transitive-only" });

            continue;
        }

        const coerced = coerce(lowest);
        const targetSpec = coerced ? `^${coerced.version}` : lowest;
        const targetVersion = coerced ? coerced.version : lowest;

        for (const decl of declarations) {
            const dedupeKey = `${decl.manifest.path}::${decl.field}::${finding.packageName}::${targetVersion}`;

            if (seenFixes.has(dedupeKey)) {
                continue;
            }

            seenFixes.add(dedupeKey);

            const inRange = satisfiesRange(targetVersion, decl.range);

            const fix: DirectFix = {
                currentRange: decl.range,
                field: decl.field,
                inRange,
                manifestPath: decl.manifest.path,
                packageName: finding.packageName,
                targetSpec,
                targetVersion,
                workspaceName: decl.manifest.workspaceName,
            };

            if (inRange || options.allowMajor === true) {
                apply.push(fix);
            } else {
                skippedMajor.push(fix);
            }
        }
    }

    return { apply, skippedMajor, unmatched };
};

const NON_SEMVER_RANGE_RE = /^(?:workspace|file|link|portal|patch|git\+|git:|github:|npm:|catalog|jsr|http|https):/i;

const satisfiesRange = (version: string, range: string): boolean => {
    // Non-semver ranges (workspace:, file:, git:, npm: aliases, …) don't
    // round-trip through `satisfies` — semver returns false instead of
    // throwing. Conservatively treat them as "in range" so the user keeps
    // control; the PM update call will surface any real incompatibility.
    if (NON_SEMVER_RANGE_RE.test(range)) {
        return true;
    }

    const cleanVersion = coerce(version)?.version ?? version;

    try {
        return satisfies(cleanVersion, range);
    } catch {
        return true;
    }
};

/**
 * Format the plan as a stable per-line preview string. Used by the audit
 * handler's dry-run output so the user can review before confirming.
 */
export const formatDirectApplyPlan = (plan: DirectApplyPlan): string => {
    const lines: string[] = [];

    if (plan.apply.length > 0) {
        lines.push(`Apply (${String(plan.apply.length)}):`);

        for (const fix of plan.apply) {
            const scope = fix.workspaceName ? ` [${fix.workspaceName}]` : "";

            lines.push(`  + ${fix.packageName}: ${fix.currentRange} → ${fix.targetSpec}${scope}`);
        }
    }

    if (plan.skippedMajor.length > 0) {
        lines.push(`Skipped — major bump (${String(plan.skippedMajor.length)}, requires --allow-major):`);

        for (const fix of plan.skippedMajor) {
            const scope = fix.workspaceName ? ` [${fix.workspaceName}]` : "";

            lines.push(`  ! ${fix.packageName}: ${fix.currentRange} → ${fix.targetSpec}${scope}`);
        }
    }

    if (plan.unmatched.length > 0) {
        const transitiveOnly = plan.unmatched.filter((u) => u.reason === "transitive-only");
        const noFix = plan.unmatched.filter((u) => u.reason === "no-fixed-version");

        if (transitiveOnly.length > 0) {
            lines.push(`Transitive only (${String(transitiveOnly.length)}, requires --apply-transitive):`);

            for (const u of transitiveOnly) {
                lines.push(`  · ${u.packageName}`);
            }
        }

        if (noFix.length > 0) {
            lines.push(`No fixed version available (${String(noFix.length)}):`);

            for (const u of noFix) {
                lines.push(`  · ${u.packageName}`);
            }
        }
    }

    if (lines.length === 0) {
        return "No direct-dep fixes to apply.";
    }

    return lines.join("\n");
};
