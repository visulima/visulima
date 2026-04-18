/**
 * Read and sync native package manager audit exclusion configs.
 *
 * Supports:
 * - pnpm: auditConfig.ignoreCves / ignoreGhsas in pnpm-workspace.yaml
 * - yarn berry: npmAuditIgnoreAdvisories / npmAuditExcludePackages in .yarnrc.yml
 * - npm: no native mechanism (vis provides the only exclusion layer)
 * - bun: CLI-only --ignore (no config file), vis provides the config layer
 */

import { isAccessibleSync, readFileSync, writeFileSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";

// ── Types ───────────────────────────────────────────────────────────

interface NativeAuditExclusions {
    /** Package names to exclude from audit (yarn berry only). */
    excludedPackages: string[];
    /** Advisory IDs to ignore (CVE-*, GHSA-*, or numeric IDs). */
    ignoredAdvisories: string[];
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
        const data = readYamlSync(filePath) as PnpmWorkspaceYaml | undefined;

        return {
            excludedPackages: [],
            ignoredAdvisories: [...toStringArray(data?.auditConfig?.ignoreCves), ...toStringArray(data?.auditConfig?.ignoreGhsas)],
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
        const data = readYamlSync(filePath) as YarnrcYml | undefined;

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

/** Checks if any of the given IDs (primary + aliases) match the exclusion list. */
const isAdvisoryExcluded = (vulnId: string, exclusions: NativeAuditExclusions, aliases?: string[]): boolean => {
    if (matchesGlobList(vulnId, exclusions.ignoredAdvisories)) {
        return true;
    }

    if (aliases) {
        for (const alias of aliases) {
            if (matchesGlobList(alias, exclusions.ignoredAdvisories)) {
                return true;
            }
        }
    }

    return false;
};

const isPackageExcluded = (packageName: string, exclusions: NativeAuditExclusions): boolean => matchesGlobList(packageName, exclusions.excludedPackages);

// ── Writers (sync vis → native PM config) ───────────────────────────

const syncAcceptedRisksToNativeConfig = (pm: string, workspaceRoot: string, advisoryIds: string[]): string[] => {
    if (advisoryIds.length === 0) {
        return ["No advisory IDs to sync."];
    }

    const actions: string[] = [];

    switch (pm) {
        case "bun": {
            actions.push(`bun has no audit config file. Use CLI flags: bun audit ${advisoryIds.map((id) => `--ignore ${id}`).join(" ")}`);
            break;
        }

        case "npm": {
            actions.push("npm has no native audit exclusion config. vis accepted risks are the only layer.");
            break;
        }

        case "pnpm": {
            const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

            if (!isAccessibleSync(filePath)) {
                actions.push("pnpm-workspace.yaml not found. Cannot sync.");
                break;
            }

            // Read existing exclusions to merge with new ones
            const existing = readPnpmAuditExclusions(workspaceRoot);
            const existingCves = new Set(existing.ignoredAdvisories.filter((id) => id.startsWith("CVE-")));
            const existingGhsas = new Set(existing.ignoredAdvisories.filter((id) => id.startsWith("GHSA-")));

            const newCves = advisoryIds.filter((id) => id.startsWith("CVE-"));
            const newGhsas = advisoryIds.filter((id) => id.startsWith("GHSA-"));

            // Merge and deduplicate
            const mergedCves = [...new Set([...existingCves, ...newCves])];
            const mergedGhsas = [...new Set([...existingGhsas, ...newGhsas])];

            const addedCves = newCves.filter((id) => !existingCves.has(id)).length;
            const addedGhsas = newGhsas.filter((id) => !existingGhsas.has(id)).length;

            if (addedCves === 0 && addedGhsas === 0) {
                actions.push("All advisory IDs already present in pnpm-workspace.yaml.");
                break;
            }

            let content = readFileSync(filePath);

            if (mergedCves.length > 0) {
                const cveBlock = `  ignoreCves:\n${mergedCves.map((id) => `    - ${id}`).join("\n")}\n`;

                if (/auditConfig:/.test(content)) {
                    content = /ignoreCves:/.test(content)
                        ? content.replace(/ignoreCves:\s*\n(?:\s+-\s+(?:\S.*|[\t\v\f \u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])\n)*/, cveBlock)
                        : content.replace(/auditConfig:\s*\n/, `auditConfig:\n${cveBlock}`);
                } else {
                    content = `${content.trimEnd()}\n\nauditConfig:\n${cveBlock}`;
                }

                if (addedCves > 0) {
                    actions.push(`Added ${String(addedCves)} new CVE${addedCves === 1 ? "" : "s"} to pnpm-workspace.yaml (${String(mergedCves.length)} total)`);
                }
            }

            if (mergedGhsas.length > 0) {
                const ghsaBlock = `  ignoreGhsas:\n${mergedGhsas.map((id) => `    - ${id}`).join("\n")}\n`;

                if (/auditConfig:/.test(content)) {
                    content = /ignoreGhsas:/.test(content)
                        ? content.replace(/ignoreGhsas:\s*\n(?:\s+-\s+(?:\S.*|[\t\v\f \u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])\n)*/, ghsaBlock)
                        : content.replace(/(auditConfig:[\s\S]*?)(\n\S|\n?$)/m, `$1${ghsaBlock}$2`);
                }

                if (addedGhsas > 0) {
                    actions.push(
                        `Added ${String(addedGhsas)} new GHSA${addedGhsas === 1 ? "" : "s"} to pnpm-workspace.yaml (${String(mergedGhsas.length)} total)`,
                    );
                }
            }

            writeFileSync(filePath, content);
            break;
        }

        case "yarn": {
            const filePath = join(workspaceRoot, ".yarnrc.yml");

            if (!isAccessibleSync(filePath)) {
                actions.push(".yarnrc.yml not found. Cannot sync.");
                break;
            }

            // Read existing exclusions to merge
            const existingYarn = readYarnAuditExclusions(workspaceRoot);
            const existingSet = new Set(existingYarn.ignoredAdvisories);
            const merged = [...new Set([...existingSet, ...advisoryIds])];
            const added = advisoryIds.filter((id) => !existingSet.has(id)).length;

            if (added === 0) {
                actions.push("All advisory IDs already present in .yarnrc.yml.");
                break;
            }

            let content = readFileSync(filePath);

            const advisoryBlock = `npmAuditIgnoreAdvisories:\n${merged.map((id) => `  - "${id}"`).join("\n")}\n`;

            content = /npmAuditIgnoreAdvisories:/.test(content)
                ? content.replace(
                    /npmAuditIgnoreAdvisories:\s*\n(?:\s+-\s+(?:\S.*|[\t\v\f \u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])\n)*/,
                    advisoryBlock,
                )
                : `${content.trimEnd()}\n\n${advisoryBlock}`;

            writeFileSync(filePath, content);
            actions.push(`Synced ${String(added)} advisor${added === 1 ? "y" : "ies"} to .yarnrc.yml (${String(merged.length)} total)`);
            break;
        }

        default: {
            actions.push(`Unknown package manager: ${pm}`);
        }
    }

    return actions;
};

export type { NativeAuditExclusions };
export { isAdvisoryExcluded, isPackageExcluded, matchesGlobList, readNativeAuditExclusions, syncAcceptedRisksToNativeConfig };
