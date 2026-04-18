import { writeFileSync } from "node:fs";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { VisConfig } from "../../workspace";
import { discoverWorkspace } from "../../workspace";
import { backupFile } from "./backup";
import { cleanHuskyFromScript, REPLACED_PACKAGES } from "./constants";
import { editJsonFile } from "./json";
import type { MigrationReport, PackageManagerType } from "./types";

const LINT_STAGED_CMD_RE = /\blint-staged\b/g;

interface MigrateLogger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

/**
 * Rewrite scripts in package.json to replace husky/lint-staged references.
 */
const rewriteScripts = (scripts: Record<string, string>, report: MigrationReport): { modified: boolean; scripts: Record<string, string> } => {
    let modified = false;
    const result = { ...scripts };

    for (const [name, value] of Object.entries(result)) {
        if (typeof value !== "string") {
            continue;
        }

        // Clean husky references using shared function
        let cleaned = cleanHuskyFromScript(value);

        // Replace lint-staged with vis staged
        if (cleaned) {
            cleaned = cleaned.replaceAll(LINT_STAGED_CMD_RE, "vis staged").trim() || undefined;
        }

        if (cleaned === value) {
            continue;
        }

        if (cleaned) {
            result[name] = cleaned;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete result[name];
        }

        modified = true;
        report.rewrittenScriptCount += 1;
    }

    return { modified, scripts: result };
};

/**
 * Rewrite a single package.json: remove replaced packages, add overrides, rewrite scripts.
 */
const rewritePackageJson = (root: string, packageManager: PackageManagerType, overrides: Record<string, string>, report: MigrationReport): void => {
    const packageJsonPath = join(root, "package.json");

    if (!isAccessibleSync(packageJsonPath)) {
        return;
    }

    editJsonFile<Record<string, unknown>>(packageJsonPath, (pkg) => {
        let modified = false;

        // Remove replaced packages from deps/devDeps
        for (const packageName of REPLACED_PACKAGES) {
            const deps = pkg["dependencies"] as Record<string, string> | undefined;
            const devDeps = pkg["devDependencies"] as Record<string, string> | undefined;

            if (deps?.[packageName]) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing known package name
                delete deps[packageName];
                modified = true;
                report.removedPackageCount += 1;
            }

            if (devDeps?.[packageName]) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing known package name
                delete devDeps[packageName];
                modified = true;
                report.removedPackageCount += 1;
            }
        }

        // Add PM-specific overrides if configured
        if (Object.keys(overrides).length > 0) {
            switch (packageManager) {
                case "bun": {
                    // Bun supports catalogs in both workspaces.catalog and top-level catalog;
                    // prefer the location the user already chose to avoid moving their config.
                    const workspacesField = pkg["workspaces"] as string[] | { catalog?: Record<string, string>; packages?: string[] } | undefined;
                    const workspacesObject = workspacesField && !Array.isArray(workspacesField) ? workspacesField : undefined;
                    const bunCatalog: Record<string, string> = {
                        ...(workspacesObject?.catalog ?? (pkg["catalog"] as Record<string, string> | undefined)),
                    };

                    for (const [key, value] of Object.entries(overrides)) {
                        bunCatalog[key] = value;
                    }

                    if (workspacesObject?.catalog == undefined) {
                        pkg["catalog"] = bunCatalog;
                    } else {
                        workspacesObject.catalog = bunCatalog;
                    }

                    // bun overrides support catalog: references
                    const bunOverrides = (pkg["overrides"] ?? {}) as Record<string, string>;

                    for (const key of Object.keys(overrides)) {
                        bunOverrides[key] = "catalog:";
                    }

                    pkg["overrides"] = bunOverrides;
                    modified = true;
                    break;
                }

                case "npm": {
                    const existing = (pkg["overrides"] ?? {}) as Record<string, string>;

                    pkg["overrides"] = { ...existing, ...overrides };
                    modified = true;
                    break;
                }

                case "pnpm": {
                    const pnpmConfig = (pkg["pnpm"] ?? {}) as Record<string, unknown>;
                    const existing = (pnpmConfig["overrides"] ?? {}) as Record<string, string>;

                    pnpmConfig["overrides"] = { ...existing, ...overrides };
                    pkg["pnpm"] = pnpmConfig;
                    modified = true;
                    break;
                }

                case "yarn": {
                    const existing = (pkg["resolutions"] ?? {}) as Record<string, string>;

                    pkg["resolutions"] = { ...existing, ...overrides };
                    modified = true;
                    break;
                }

                default: {
                    break;
                }
            }
        }

        // Rewrite scripts
        const scripts = pkg["scripts"] as Record<string, string> | undefined;

        if (scripts) {
            const result = rewriteScripts(scripts, report);

            if (result.modified) {
                pkg["scripts"] = result.scripts;
                modified = true;
            }
        }

        return modified ? pkg : undefined;
    });
};

/**
 * Iterate over all workspace packages and rewrite their package.json files.
 */
const migrateMonorepoPackages = (root: string, packageManager: PackageManagerType, overrides: Record<string, string>, report: MigrationReport): void => {
    try {
        const { workspace } = discoverWorkspace(root);

        for (const config of Object.values(workspace.projects)) {
            const projectRoot = join(root, config.root);

            rewritePackageJson(projectRoot, packageManager, overrides, report);
        }
    } catch {
        // Not a monorepo or workspace discovery failed — skip
    }
};

/**
 * Check if a YAML line ends the catalog section.
 */
const isCatalogSectionEnd = (trimmed: string): boolean => trimmed.startsWith("- ") || (trimmed !== "" && !trimmed.includes(":") && !trimmed.startsWith("#"));

/**
 * Parse existing catalog entries from pnpm-workspace.yaml.
 */
const parseCatalogEntries = (lines: string[]): { entries: Set<string>; indent: string } => {
    let inCatalog = false;
    let catalogIndent = "";
    const entries = new Set<string>();

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === "catalog:") {
            inCatalog = true;
            continue;
        }

        if (!inCatalog) {
            continue;
        }

        if (isCatalogSectionEnd(trimmed)) {
            break;
        }

        const key = trimmed.includes(":") ? trimmed.split(":")[0]?.trim() : undefined;

        if (key) {
            entries.add(key);
            catalogIndent = catalogIndent || line.slice(0, line.indexOf(trimmed));
        }
    }

    return { entries, indent: catalogIndent || "  " };
};

/**
 * Insert new entries into the catalog section of pnpm-workspace.yaml lines.
 */
const insertCatalogEntries = (lines: string[], newEntries: string[], content: string): string[] => {
    const result: string[] = [];
    let inserted = false;
    let inCatalog = false;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] as string;
        const trimmed = line.trim();

        result.push(line);

        if (trimmed === "catalog:") {
            inCatalog = true;
            continue;
        }

        if (inCatalog && !inserted) {
            const nextLine = lines[index + 1];
            const nextTrimmed = nextLine?.trim() ?? "";

            if (!nextTrimmed.includes(":") || nextTrimmed.startsWith("- ") || !nextTrimmed || nextTrimmed === "catalog:") {
                result.push(...newEntries);
                inserted = true;
                inCatalog = false;
            }
        }
    }

    if (!inserted) {
        if (!content.includes("catalog:")) {
            result.push("catalog:");
        }

        result.push(...newEntries);
    }

    return result;
};

/**
 * Update pnpm-workspace.yaml catalog with override entries.
 */
const updatePnpmWorkspaceCatalog = (root: string, overrides: Record<string, string>): void => {
    const filePath = join(root, "pnpm-workspace.yaml");

    if (!isAccessibleSync(filePath) || Object.keys(overrides).length === 0) {
        return;
    }

    const content = readFileSync(filePath);
    const lines = content.split("\n");
    const { entries: existingEntries, indent } = parseCatalogEntries(lines);

    const newEntries: string[] = [];

    for (const [name, version] of Object.entries(overrides)) {
        if (!existingEntries.has(name)) {
            newEntries.push(`${indent}${name}: "${version}"`);
        }
    }

    if (newEntries.length === 0) {
        return;
    }

    const result = insertCatalogEntries(lines, newEntries, content);

    backupFile(filePath);
    writeFileSync(filePath, result.join("\n"), "utf8");
};

/**
 * Top-level orchestrator for dependency migration.
 */
const migrateDeps = (
    root: string,
    packageManager: PackageManagerType,
    visConfig: VisConfig,
    options: { dryRun: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): void => {
    const overrides = visConfig.overrides ?? {};

    if (options.dryRun) {
        logger.info("[dry-run] Would rewrite package.json files (remove husky/lint-staged, rewrite scripts)");

        if (Object.keys(overrides).length > 0) {
            logger.info(`[dry-run] Would add overrides: ${JSON.stringify(overrides)}`);
        }

        return;
    }

    // Rewrite root package.json
    rewritePackageJson(root, packageManager, overrides, report);
    logger.info("Rewritten root package.json");

    // Rewrite workspace packages
    migrateMonorepoPackages(root, packageManager, overrides, report);

    // Update pnpm catalog if applicable
    if (packageManager === "pnpm") {
        updatePnpmWorkspaceCatalog(root, overrides);
    }
};

export { migrateDeps, migrateMonorepoPackages, rewritePackageJson, rewriteScripts, updatePnpmWorkspaceCatalog };
