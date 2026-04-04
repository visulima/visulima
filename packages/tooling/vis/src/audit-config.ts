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

import { join } from "@visulima/path";

// ── Types ───────────────────────────────────────────────────────────

interface NativeAuditExclusions {
    /** Advisory IDs to ignore (CVE-*, GHSA-*, or numeric IDs). */
    ignoredAdvisories: string[];
    /** Package names to exclude from audit (yarn berry only). */
    excludedPackages: string[];
}

// ── Readers ─────────────────────────────────────────────────────────

/**
 * Reads pnpm auditConfig from pnpm-workspace.yaml.
 * Parses ignoreCves and ignoreGhsas arrays.
 */
const readPnpmAuditExclusions = (workspaceRoot: string): NativeAuditExclusions => {
    const result: NativeAuditExclusions = { excludedPackages: [], ignoredAdvisories: [] };
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!existsSync(filePath)) {
        return result;
    }

    const content = readFileSync(filePath, "utf8");

    // Parse ignoreCves
    const cveSection = /^auditConfig:\s*\n([\s\S]*?)(?=^\S|\z)/m.exec(content);

    if (cveSection) {
        const block = cveSection[1];

        // Extract ignoreCves entries
        const cveMatch = /ignoreCves:\s*\n((?:\s+-\s+.+\n)*)/m.exec(block);

        if (cveMatch) {
            const entries = cveMatch[1].match(/^\s+-\s+['"]?([^'"\s]+)['"]?/gm);

            if (entries) {
                for (const entry of entries) {
                    const value = entry.replace(/^\s+-\s+['"]?/, "").replace(/['"]?$/, "").trim();

                    if (value) {
                        result.ignoredAdvisories.push(value);
                    }
                }
            }
        }

        // Extract ignoreGhsas entries
        const ghsaMatch = /ignoreGhsas:\s*\n((?:\s+-\s+.+\n)*)/m.exec(block);

        if (ghsaMatch) {
            const entries = ghsaMatch[1].match(/^\s+-\s+['"]?([^'"\s]+)['"]?/gm);

            if (entries) {
                for (const entry of entries) {
                    const value = entry.replace(/^\s+-\s+['"]?/, "").replace(/['"]?$/, "").trim();

                    if (value) {
                        result.ignoredAdvisories.push(value);
                    }
                }
            }
        }
    }

    return result;
};

/**
 * Reads yarn berry audit exclusions from .yarnrc.yml.
 * Parses npmAuditIgnoreAdvisories and npmAuditExcludePackages arrays.
 */
const readYarnAuditExclusions = (workspaceRoot: string): NativeAuditExclusions => {
    const result: NativeAuditExclusions = { excludedPackages: [], ignoredAdvisories: [] };
    const filePath = join(workspaceRoot, ".yarnrc.yml");

    if (!existsSync(filePath)) {
        return result;
    }

    const content = readFileSync(filePath, "utf8");

    // Parse npmAuditIgnoreAdvisories
    const advisoryMatch = /npmAuditIgnoreAdvisories:\s*\n((?:\s+-\s+.+\n)*)/m.exec(content);

    if (advisoryMatch) {
        const entries = advisoryMatch[1].match(/^\s+-\s+['"]?([^'"\s]+)['"]?/gm);

        if (entries) {
            for (const entry of entries) {
                const value = entry.replace(/^\s+-\s+['"]?/, "").replace(/['"]?$/, "").trim();

                if (value) {
                    result.ignoredAdvisories.push(value);
                }
            }
        }
    }

    // Parse npmAuditExcludePackages
    const excludeMatch = /npmAuditExcludePackages:\s*\n((?:\s+-\s+.+\n)*)/m.exec(content);

    if (excludeMatch) {
        const entries = excludeMatch[1].match(/^\s+-\s+['"]?([^'"\s]+)['"]?/gm);

        if (entries) {
            for (const entry of entries) {
                const value = entry.replace(/^\s+-\s+['"]?/, "").replace(/['"]?$/, "").trim();

                if (value) {
                    result.excludedPackages.push(value);
                }
            }
        }
    }

    return result;
};

/**
 * Reads native audit exclusions for the detected package manager.
 */
const readNativeAuditExclusions = (workspaceRoot: string, pm: string): NativeAuditExclusions => {
    switch (pm) {
        case "pnpm": {
            return readPnpmAuditExclusions(workspaceRoot);
        }

        case "yarn": {
            return readYarnAuditExclusions(workspaceRoot);
        }

        default: {
            // npm and bun have no config-file-based exclusion mechanism
            return { excludedPackages: [], ignoredAdvisories: [] };
        }
    }
};

/**
 * Checks if a vulnerability ID (CVE-*, GHSA-*, or numeric) is in the
 * native PM exclusion list.
 */
const isAdvisoryExcluded = (vulnId: string, exclusions: NativeAuditExclusions): boolean => {
    for (const id of exclusions.ignoredAdvisories) {
        if (id === vulnId) {
            return true;
        }

        // Glob support (yarn berry): "GHSA-*"
        if (id.endsWith("*") && vulnId.startsWith(id.slice(0, -1))) {
            return true;
        }
    }

    return false;
};

/**
 * Checks if a package name is excluded from audit (yarn berry only).
 */
const isPackageExcluded = (packageName: string, exclusions: NativeAuditExclusions): boolean => {
    for (const pattern of exclusions.excludedPackages) {
        if (pattern === packageName) {
            return true;
        }

        // Glob: "@scope/*" or "lodash*"
        if (pattern.endsWith("*") && packageName.startsWith(pattern.slice(0, -1))) {
            return true;
        }
    }

    return false;
};

// ── Writers (sync vis → native PM config) ───────────────────────────

/**
 * Syncs vis accepted risk CVE/GHSA IDs to native PM audit exclusion config.
 * Returns a description of actions taken.
 */
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
                        // Replace existing ignoreCves block
                        content = content.replace(
                            /ignoreCves:\s*\n(?:\s+-\s+.+\n)*/m,
                            cveBlock,
                        );
                    } else {
                        // Add ignoreCves to existing auditConfig
                        content = content.replace(
                            /auditConfig:\s*\n/m,
                            `auditConfig:\n${cveBlock}`,
                        );
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
                        content = content.replace(
                            /ignoreGhsas:\s*\n(?:\s+-\s+.+\n)*/m,
                            ghsaBlock,
                        );
                    } else {
                        content = content.replace(
                            /(auditConfig:[\s\S]*?)(\n\S|\n?$)/m,
                            `$1${ghsaBlock}$2`,
                        );
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
                content = content.replace(
                    /npmAuditIgnoreAdvisories:\s*\n(?:\s+-\s+.+\n)*/m,
                    advisoryBlock,
                );
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
    readNativeAuditExclusions,
    syncAcceptedRisksToNativeConfig,
};
