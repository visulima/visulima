import { unlinkSync, writeFileSync } from "node:fs";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { findVisConfigFile } from "../../config/config";
import { backupFile } from "./backup";
import { LINT_STAGED_ALL_CONFIG_FILES, LINT_STAGED_JSON_CONFIG_FILES, LINT_STAGED_OTHER_CONFIG_FILES, STALE_LINT_STAGED_PATTERNS } from "./constants";
import { detectJsonIndent, isJsonFile, readJsonFile } from "./json";
import type { MigrationReport } from "./types";
import { addManualStep, addMigrationWarning } from "./types";

const STAGED_KEY_RE = /\bstaged\s*:/;
const DEFINE_CONFIG_RE = /(defineConfig\(\{)/;
const EXPORT_DEFAULT_RE = /(export\s+default\s+\{)/;

interface MigrateLogger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

// ─── Detection ──────────────────────────────────────────────────────

/**
 * Check if a standalone lint-staged config file exists.
 */
const hasStandaloneLintStagedConfig = (root: string): boolean => LINT_STAGED_ALL_CONFIG_FILES.some((file) => isAccessibleSync(join(root, file)));

/**
 * Check if a standalone lint-staged config exists in a format that can't be
 * auto-migrated (non-JSON files like .yaml, .mjs, .cjs, .js, or a non-JSON .lintstagedrc).
 */
const hasUnsupportedLintStagedConfig = (root: string): boolean => {
    for (const filename of LINT_STAGED_OTHER_CONFIG_FILES) {
        if (isAccessibleSync(join(root, filename))) {
            return true;
        }
    }

    const lintstagedrcPath = join(root, ".lintstagedrc");

    return isAccessibleSync(lintstagedrcPath) && !isJsonFile(lintstagedrcPath);
};

/**
 * Check if vis.config.ts already has a `staged` config key.
 */
const hasStagedConfigInVisConfig = (root: string): boolean => {
    const configPath = findVisConfigFile(root);

    if (!configPath) {
        return false;
    }

    const content = readFileSync(configPath);

    return STAGED_KEY_RE.test(content);
};

/**
 * Detect lint-staged config: returns the source ("package.json", a filename, or undefined).
 */
const detectLintStagedConfig = (root: string): string | undefined => {
    const packageJsonPath = join(root, "package.json");

    if (isAccessibleSync(packageJsonPath)) {
        const pkg = readJsonFile<Record<string, unknown>>(packageJsonPath);

        if (pkg?.["lint-staged"]) {
            return "package.json";
        }
    }

    for (const file of LINT_STAGED_ALL_CONFIG_FILES) {
        if (isAccessibleSync(join(root, file))) {
            return file;
        }
    }

    return undefined;
};

// ─── Config extraction ──────────────────────────────────────────────

/**
 * Extract lint-staged config from package.json.
 */
const extractLintStagedFromPackageJson = (root: string): Record<string, string | string[]> | undefined => {
    const pkg = readJsonFile<{ "lint-staged"?: Record<string, string | string[]> }>(join(root, "package.json"));

    return pkg?.["lint-staged"];
};

/**
 * Parse a JSON lint-staged config file.
 */
const parseLintStagedJsonFile = (filePath: string): Record<string, string | string[]> | undefined => readJsonFile<Record<string, string | string[]>>(filePath);

// ─── Config writing ─────────────────────────────────────────────────

/**
 * Generate a TypeScript snippet for the staged block.
 */
const generateStagedConfigSnippet = (config: Record<string, string | string[]>): string => {
    const entries = Object.entries(config)
        .map(([pattern, commands]) => {
            const value = Array.isArray(commands) ? `[${commands.map((c) => JSON.stringify(c)).join(", ")}]` : JSON.stringify(commands);

            return `        ${JSON.stringify(pattern)}: ${value}`;
        })
        .join(",\n");

    return `    staged: {\n${entries},\n    }`;
};

/**
 * Insert staged config into vis.config.ts. Creates the file if it doesn't exist.
 */
const insertStagedIntoVisConfig = (root: string, config: Record<string, string | string[]>, logger: MigrateLogger): boolean => {
    const configPath = findVisConfigFile(root);

    if (configPath) {
        const content = readFileSync(configPath);

        // Try to insert after `defineConfig({` or `export default {`
        const snippet = generateStagedConfigSnippet(config);

        let updated: string | undefined;

        if (DEFINE_CONFIG_RE.test(content)) {
            updated = content.replace(DEFINE_CONFIG_RE, `$1\n${snippet},`);
        } else if (EXPORT_DEFAULT_RE.test(content)) {
            updated = content.replace(EXPORT_DEFAULT_RE, `$1\n${snippet},`);
        }

        if (updated) {
            backupFile(configPath);
            writeFileSync(configPath, updated, "utf8");
            logger.info(`Merged staged config into ${configPath}`);

            return true;
        }

        logger.warn(`Could not auto-insert staged config into ${configPath} — please add manually`);

        return false;
    }

    // Create new vis.config.ts
    const newConfigPath = join(root, "vis.config.ts");
    const snippet = generateStagedConfigSnippet(config);
    const content = `import { defineConfig } from "@visulima/vis/config";\n\nexport default defineConfig({\n${snippet},\n});\n`;

    writeFileSync(newConfigPath, content, "utf8");
    logger.info(`Created ${newConfigPath} with staged config`);

    return true;
};

// ─── Cleanup ────────────────────────────────────────────────────────

/**
 * Remove `lint-staged` key, config, and dependency from package.json in a single read/write.
 * Returns which removals were performed.
 */
const removeLintStagedFromPackageJson = (root: string, useEditorconfig?: boolean): { configRemoved: boolean; dependencyRemoved: boolean } => {
    const packageJsonPath = join(root, "package.json");
    const result = { configRemoved: false, dependencyRemoved: false };

    if (!isAccessibleSync(packageJsonPath)) {
        return result;
    }

    const content = readFileSync(packageJsonPath);
    const pkg = JSON.parse(content) as Record<string, unknown>;
    let modified = false;

    // Remove lint-staged config key
    if (pkg["lint-staged"]) {
        delete pkg["lint-staged"];
        modified = true;
        result.configRemoved = true;
    }

    // Remove lint-staged from dependencies
    const devDeps = pkg["devDependencies"] as Record<string, string> | undefined;
    const deps = pkg["dependencies"] as Record<string, string> | undefined;

    if (devDeps?.["lint-staged"]) {
        delete devDeps["lint-staged"];
        modified = true;
        result.dependencyRemoved = true;
    }

    if (deps?.["lint-staged"]) {
        delete deps["lint-staged"];
        modified = true;
        result.dependencyRemoved = true;
    }

    if (modified) {
        const indent = detectJsonIndent(packageJsonPath, content, { useEditorconfig });

        backupFile(packageJsonPath);
        writeFileSync(packageJsonPath, `${JSON.stringify(pkg, undefined, indent)}\n`, "utf8");
    }

    return result;
};

/**
 * Remove standalone lint-staged config files.
 */
const removeLintStagedConfigFiles = (root: string, report: MigrationReport): void => {
    for (const file of LINT_STAGED_ALL_CONFIG_FILES) {
        const filePath = join(root, file);

        if (isAccessibleSync(filePath)) {
            backupFile(filePath, report);
            unlinkSync(filePath);

            report.removedConfigCount += 1;
        }
    }
};

// ─── Pre-commit hook rewriting ──────────────────────────────────────

/**
 * Rewrite pre-commit hook to replace lint-staged invocations with `vis staged`.
 */

const rewritePreCommitHook = (root: string, hooksDirectory: string): boolean => {
    const hookPath = join(root, hooksDirectory, "pre-commit");

    if (!isAccessibleSync(hookPath)) {
        return false;
    }

    const existing = readFileSync(hookPath);

    if (existing.includes("vis staged")) {
        return false;
    }

    const lines = existing.split("\n");
    let replaced = false;
    const result: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (!replaced) {
            let matched = false;

            for (const pattern of STALE_LINT_STAGED_PATTERNS) {
                const match = pattern.exec(trimmed);

                if (match) {
                    const indent = line.slice(0, line.length - line.trimStart().length);
                    const envPrefix = match[1]?.trim() ?? "";
                    const rest = trimmed.slice(match[0].length).trim();
                    const parts = [envPrefix, "vis staged", rest].filter(Boolean);

                    result.push(`${indent}${parts.join(" ")}`);
                    replaced = true;
                    matched = true;
                    break;
                }
            }

            if (matched) {
                continue;
            }
        }

        result.push(line);
    }

    if (!replaced) {
        return false;
    }

    backupFile(hookPath);
    writeFileSync(hookPath, result.join("\n"));

    return true;
};

// ─── Orchestrator helpers ────────────────────────────────────────────

/**
 * Extract lint-staged config from the detected source.
 * Returns the config or undefined if extraction fails or is unsupported.
 */
const extractConfig = (root: string, source: string, report: MigrationReport): Record<string, string | string[]> | undefined => {
    if (source === "package.json") {
        return extractLintStagedFromPackageJson(root);
    }

    const filePath = join(root, source);

    if (!(LINT_STAGED_JSON_CONFIG_FILES as ReadonlyArray<string>).includes(source)) {
        addMigrationWarning(report, `${source} cannot be auto-migrated — please add "staged" config to vis.config.ts manually`);
        addManualStep(report, `Manually convert ${source} to staged config in vis.config.ts`);

        return undefined;
    }

    if (source === ".lintstagedrc" && !isJsonFile(filePath)) {
        addMigrationWarning(report, ".lintstagedrc is not JSON format — please migrate manually");

        return undefined;
    }

    return parseLintStagedJsonFile(filePath);
};

/**
 * Clean up old lint-staged artifacts: config key, files, and dependency.
 */

const cleanupLintStagedArtifacts = (root: string, report: MigrationReport, useEditorconfig?: boolean): void => {
    const { configRemoved, dependencyRemoved } = removeLintStagedFromPackageJson(root, useEditorconfig);

    if (configRemoved) {
        report.inlinedLintStagedConfigCount += 1;
    }

    if (dependencyRemoved) {
        report.removedPackageCount += 1;
    }

    removeLintStagedConfigFiles(root, report);
};

/**
 * Rewrite pre-commit hooks in known hook directories.
 */
const rewriteHooks = (root: string, options: { silent?: boolean }, logger: MigrateLogger, report: MigrationReport): void => {
    const hooksDirectories = [".vis-hooks", ".husky"];

    for (const hooksDirectory of hooksDirectories) {
        if (isAccessibleSync(join(root, hooksDirectory)) && rewritePreCommitHook(root, hooksDirectory)) {
            report.gitHooksConfigured = true;

            if (!options.silent) {
                logger.info(`Rewrote pre-commit hook in ${hooksDirectory}/ to use "vis staged"`);
            }
        }
    }
};

/**
 * Apply the migration: insert config, clean up artifacts, rewrite hooks.
 */
const applyMigration = (
    root: string,
    config: Record<string, string | string[]>,
    options: { silent?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): void => {
    const inserted = insertStagedIntoVisConfig(root, config, logger);

    if (inserted) {
        report.mergedStagedConfigCount += 1;
    }

    cleanupLintStagedArtifacts(root, report, options.useEditorconfig);
    rewriteHooks(root, options, logger, report);
};

// ─── Orchestrator ───────────────────────────────────────────────────

/**
 * Migrates lint-staged configuration to vis.config.ts staged block.
 */
const migrateLintStaged = (root: string, options: { dryRun: boolean; silent?: boolean; useEditorconfig?: boolean }, logger: MigrateLogger, report: MigrationReport): boolean => {
    const source = detectLintStagedConfig(root);

    if (!source) {
        if (!options.silent) {
            logger.info("No lint-staged configuration found — nothing to migrate.");
        }

        return false;
    }

    // Check for unsupported config formats
    if (hasUnsupportedLintStagedConfig(root)) {
        addMigrationWarning(report, 'Non-JSON lint-staged config found — please migrate to "staged" in vis.config.ts manually');
        addManualStep(report, "Convert your lint-staged config file to JSON format or add staged config to vis.config.ts manually");
    }

    // Check if vis.config.ts already has staged
    if (hasStagedConfigInVisConfig(root)) {
        addMigrationWarning(report, 'vis.config.ts already has a "staged" config — skipping lint-staged merge');

        if (!options.silent) {
            logger.warn('vis.config.ts already has a "staged" config — skipping');
        }

        if (!options.dryRun) {
            cleanupLintStagedArtifacts(root, report, options.useEditorconfig);
        }

        return true;
    }

    const config = extractConfig(root, source, report);

    if (!config || Object.keys(config).length === 0) {
        if (!options.silent) {
            logger.warn("lint-staged config is empty — skipping");
        }

        return false;
    }

    if (options.dryRun) {
        if (!options.silent) {
            logger.info("[dry-run] Would insert staged config into vis.config.ts:");
            logger.info(generateStagedConfigSnippet(config));
        }

        return true;
    }

    applyMigration(root, config, options, logger, report);

    return true;
};

export {
    detectLintStagedConfig,
    extractLintStagedFromPackageJson,
    generateStagedConfigSnippet,
    hasStagedConfigInVisConfig,
    hasStandaloneLintStagedConfig,
    hasUnsupportedLintStagedConfig,
    insertStagedIntoVisConfig,
    migrateLintStaged,
    parseLintStagedJsonFile,
    removeLintStagedConfigFiles,
    removeLintStagedFromPackageJson,
    rewritePreCommitHook,
};
