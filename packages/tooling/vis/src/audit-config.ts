/**
 * Read and sync native package manager audit exclusion configs.
 *
 * Supports:
 * - pnpm: auditConfig.ignoreCves / ignoreGhsas in pnpm-workspace.yaml
 * - yarn berry: npmAuditIgnoreAdvisories / npmAuditExcludePackages in .yarnrc.yml
 * - npm: no native mechanism (vis provides the only exclusion layer)
 * - bun: CLI-only --ignore (no config file), vis provides the config layer
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { isAccessibleSync, readYamlSync } from "@visulima/fs";
import { join } from "@visulima/path";

// ── Types ───────────────────────────────────────────────────────────

interface NativeAuditExclusions {
    /** Advisory IDs to ignore (CVE-*, GHSA-*, or numeric IDs). */
    ignoredAdvisories: string[];
    /** Package names to exclude from audit (yarn berry only). */
    excludedPackages: string[];
}

// ── Shared helpers ──────────────────────────────────────────────────

/** Safely coerces a YAML value to a string array. */
const toStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((v): v is string => typeof v === "string");
};

/** Checks if a value matches any pattern in a list (exact or trailing glob). */
const matchesGlobList = (value: string, patterns: string[]): boolean => {
    for (const pattern of patterns) {
        if (pattern === value) {
            return true;
        }

        if (pattern.endsWith("*") && value.startsWith(pattern.slice(0, -1))) {
            return true;
        }
    }

    return false;
};

// ── Readers (use @visulima/fs readYamlSync for proper parsing) ──────

interface PnpmWorkspaceYaml {
    auditConfig?: {
        ignoreCves?: string[];
        ignoreGhsas?: string[];
    };
}

interface YarnrcYml {
    npmAuditExcludePackages?: string[];
    npmAuditIgnoreAdvisories?: string[];
}

const readPnpmAuditExclusions = (workspaceRoot: string): NativeAuditExclusions => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!isAccessibleSync(filePath)) {
        return { excludedPackages: [], ignoredAdvisories: [] };
    }

    try {
        const data = readYamlSync<PnpmWorkspaceYaml>(filePath);

        return {
            excludedPackages: [],
            ignoredAdvisories: [
                ...toStringArray(data?.auditConfig?.ignoreCves),
                ...toStringArray(data?.auditConfig?.ignoreGhsas),
            ],
        };
    } catch {
        return { excludedPackages: [], ignoredAdvisories: [] };
    }
};

const readYarnAuditExclusions = (workspaceRoot: string): NativeAuditExclusions => {
    const filePath = join(workspaceRoot, ".yarnrc.yml");

    if (!isAccessibleSync(filePath)) {
        return { excludedPackages: [], ignoredAdvisories: [] };
    }

    try {
        const data = readYamlSync<YarnrcYml>(filePath);

        return {
            excludedPackages: toStringArray(data?.npmAuditExcludePackages),
            ignoredAdvisories: toStringArray(data?.npmAuditIgnoreAdvisories),
        };
    } catch {
        return { excludedPackages: [], ignoredAdvisories: [] };
    }
};

const readNativeAuditExclusions = (workspaceRoot: string, pm: string): NativeAuditExclusions => {
    switch (pm) {
        case "pnpm": {
            return readPnpmAuditExclusions(workspaceRoot);
        }

        case "yarn": {
            return readYarnAuditExclusions(workspaceRoot);
        }

        default: {
            return { excludedPackages: [], ignoredAdvisories: [] };
        }
    }
};

const isAdvisoryExcluded = (vulnId: string, exclusions: NativeAuditExclusions): boolean =>
    matchesGlobList(vulnId, exclusions.ignoredAdvisories);

const isPackageExcluded = (packageName: string, exclusions: NativeAuditExclusions): boolean =>
    matchesGlobList(packageName, exclusions.excludedPackages);

// ── Writers (sync vis → native PM config) ───────────────────────────

const syncAcceptedRisksToNativeConfig = (
    pm: string,
    workspaceRoot: string,
    advisoryIds: string[],
): string[] => {
    if (advisoryIds.length === 0) {
        return ["No advisory IDs to sync."];
    }

    const actions: string[] = [];

    switch (pm) {
        case "pnpm": {
            const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

            if (!existsSync(filePath)) {
                actions.push("pnpm-workspace.yaml not found. Cannot sync.");
                break;
            }

            let content = readFileSync(filePath, "utf8");

            const cves = advisoryIds.filter((id) => id.startsWith("CVE-"));
            const ghsas = advisoryIds.filter((id) => id.startsWith("GHSA-"));

            if (cves.length > 0) {
                const cveBlock = `  ignoreCves:\n${cves.map((id) => `    - ${id}`).join("\n")}\n`;

                if (/auditConfig:/m.test(content)) {
                    if (/ignoreCves:/m.test(content)) {
                        content = content.replace(/ignoreCves:\s*\n(?:\s+-\s+.+\n)*/m, cveBlock);
                    } else {
                        content = content.replace(/auditConfig:\s*\n/m, `auditConfig:\n${cveBlock}`);
                    }
                } else {
                    content = `${content.trimEnd()}\n\nauditConfig:\n${cveBlock}`;
                }

                actions.push(`Synced ${String(cves.length)} CVE${cves.length === 1 ? "" : "s"} to pnpm-workspace.yaml auditConfig.ignoreCves`);
            }

            if (ghsas.length > 0) {
                const ghsaBlock = `  ignoreGhsas:\n${ghsas.map((id) => `    - ${id}`).join("\n")}\n`;

                if (/auditConfig:/m.test(content)) {
                    if (/ignoreGhsas:/m.test(content)) {
                        content = content.replace(/ignoreGhsas:\s*\n(?:\s+-\s+.+\n)*/m, ghsaBlock);
                    } else {
                        content = content.replace(/(auditConfig:[\s\S]*?)(\n\S|\n?$)/m, `$1${ghsaBlock}$2`);
                    }
                }

                actions.push(`Synced ${String(ghsas.length)} GHSA${ghsas.length === 1 ? "" : "s"} to pnpm-workspace.yaml auditConfig.ignoreGhsas`);
            }

            writeFileSync(filePath, content);
            break;
        }

        case "yarn": {
            const filePath = join(workspaceRoot, ".yarnrc.yml");

            if (!existsSync(filePath)) {
                actions.push(".yarnrc.yml not found. Cannot sync.");
                break;
            }

            let content = readFileSync(filePath, "utf8");

            const advisoryBlock = `npmAuditIgnoreAdvisories:\n${advisoryIds.map((id) => `  - "${id}"`).join("\n")}\n`;

            if (/npmAuditIgnoreAdvisories:/m.test(content)) {
                content = content.replace(/npmAuditIgnoreAdvisories:\s*\n(?:\s+-\s+.+\n)*/m, advisoryBlock);
            } else {
                content = `${content.trimEnd()}\n\n${advisoryBlock}`;
            }

            writeFileSync(filePath, content);
            actions.push(`Synced ${String(advisoryIds.length)} advisor${advisoryIds.length === 1 ? "y" : "ies"} to .yarnrc.yml npmAuditIgnoreAdvisories`);
            break;
        }

        case "npm": {
            actions.push("npm has no native audit exclusion config. vis accepted risks are the only layer.");
            break;
        }

        case "bun": {
            actions.push("bun has no audit config file. Use CLI flags: bun audit " + advisoryIds.map((id) => `--ignore ${id}`).join(" "));
            break;
        }

        default: {
            actions.push(`Unknown package manager: ${pm}`);
        }
    }

    return actions;
};

export type { NativeAuditExclusions };
export {
    isAdvisoryExcluded,
    isPackageExcluded,
    matchesGlobList,
    readNativeAuditExclusions,
    syncAcceptedRisksToNativeConfig,
};
