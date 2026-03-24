import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { InstallResult } from "./constants";
import { HOOKS } from "./constants";
import { installHooks } from "./install";

const HUSKY_DIRECTORIES = [".husky", ".config/husky"];

const COMMON_SH_SOURCE_RE = /^\. "\$\(dirname "\$0"\)\/common\.sh"\s*\n?/m;

/**
 * Detects which husky directory is in use, if any.
 */
const detectHuskyDirectory = (root: string): string | undefined => {
    for (const directory of HUSKY_DIRECTORIES) {
        if (existsSync(join(root, directory)) && statSync(join(root, directory)).isDirectory()) {
            return directory;
        }
    }

    return undefined;
};

/**
 * Reads user-defined hook scripts from a husky directory.
 * Returns only actual hook files (skips `_/`, `common.sh`, and non-hook files).
 */
const readHuskyHooks = (root: string, huskyDirectory: string): Map<string, string> => {
    const hooks = new Map<string, string>();
    const fullPath = join(root, huskyDirectory);
    const hookNames: Set<string> = new Set(HOOKS);

    for (const entry of readdirSync(fullPath)) {
        if (entry === "_" || entry === ".gitignore" || entry.startsWith(".")) {
            continue;
        }

        const entryPath = join(fullPath, entry);

        if (!statSync(entryPath).isFile()) {
            continue;
        }

        // Only migrate known hook names and common.sh
        if (!hookNames.has(entry) && entry !== "common.sh") {
            continue;
        }

        hooks.set(entry, readFileSync(entryPath, "utf8"));
    }

    return hooks;
};

/**
 * Transforms a husky hook script for vis.
 * Removes the common.sh sourcing line since vis handles PATH setup in its dispatcher.
 */
const transformHookScript = (content: string): string => content.replace(COMMON_SH_SOURCE_RE, "");

/**
 * Detects the package manager used in the project.
 */
const detectPackageManager = (root: string): "bun" | "npm" | "pnpm" | "yarn" => {
    if (existsSync(join(root, "pnpm-lock.yaml")) || existsSync(join(root, "pnpm-workspace.yaml"))) {
        return "pnpm";
    }

    if (existsSync(join(root, "yarn.lock"))) {
        return "yarn";
    }

    if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock"))) {
        return "bun";
    }

    return "npm";
};

/**
 * Uninstalls the husky package via the detected package manager.
 */
const uninstallHuskyPackage = (root: string, logger: Console): boolean => {
    const packageManager = detectPackageManager(root);

    const removeCommands: Record<string, string[]> = {
        bun: ["bun", "remove", "husky"],
        npm: ["npm", "uninstall", "husky"],
        pnpm: ["pnpm", "remove", "husky"],
        yarn: ["yarn", "remove", "husky"],
    };

    const [command, ...arguments_] = removeCommands[packageManager] as [string, ...string[]];

    logger.info(`Removing husky package via ${packageManager}...`);

    const result = spawnSync(command, arguments_, {
        cwd: root,
        encoding: "utf8",
        stdio: "pipe",
    });

    if (result.status !== 0) {
        logger.info(`Warning: failed to remove husky via ${packageManager} (${result.stderr?.trim() ?? "unknown error"})`);

        return false;
    }

    return true;
};

/**
 * Cleans husky references from package.json scripts.
 */
const cleanPackageJsonScripts = (root: string): { modified: boolean; removedScriptReferences: string[] } => {
    const packageJsonPath = join(root, "package.json");

    if (!existsSync(packageJsonPath)) {
        return { modified: false, removedScriptReferences: [] };
    }

    const content = readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(content) as Record<string, unknown>;
    let modified = false;
    const removedScriptReferences: string[] = [];

    const scripts = packageJson["scripts"] as Record<string, string> | undefined;

    if (scripts) {
        for (const [scriptName, scriptValue] of Object.entries(scripts)) {
            if (typeof scriptValue !== "string") {
                continue;
            }

            // Remove standalone "husky" or "husky install" commands
            if (scriptValue === "husky" || scriptValue === "husky install") {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete scripts[scriptName];
                modified = true;
                removedScriptReferences.push(`removed "${scriptName}" script (was: "${scriptValue}")`);
                continue;
            }

            // Remove husky from compound commands like "(is-ci || husky || exit 0) && other-stuff"
            const huskyPatterns = [
                /\(is-ci \|\| husky \|\| exit 0\)\s*&&\s*/g,
                /\bhusky(?:\s+install)?\s*&&\s*/g,
                /\s*&&\s*husky(?:\s+install)?/g,
                /\s*\|\|\s*husky(?:\s+install)?/g,
            ];

            let cleaned = scriptValue;

            for (const pattern of huskyPatterns) {
                cleaned = cleaned.replace(pattern, "");
            }

            cleaned = cleaned.trim();

            if (cleaned !== scriptValue) {
                if (cleaned) {
                    scripts[scriptName] = cleaned;
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete scripts[scriptName];
                }

                modified = true;
                removedScriptReferences.push(`updated "${scriptName}" script`);
            }
        }
    }

    if (modified) {
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, undefined, 4) + "\n", "utf8");
    }

    return { modified, removedScriptReferences };
};

/**
 * Migrates from husky to vis hooks.
 */
const migrateFromHusky = (
    root: string,
    hooksDirectory: string,
    logger: Console,
): InstallResult => {
    const huskyDirectory = detectHuskyDirectory(root);

    if (!huskyDirectory) {
        return { isError: true, message: "No husky installation found (.husky/ or .config/husky/)" };
    }

    logger.info(`Found husky at ${huskyDirectory}/`);

    // Read existing husky hooks
    const huskyHooks = readHuskyHooks(root, huskyDirectory);

    if (huskyHooks.size === 0) {
        logger.info("No user-defined hooks found in husky directory.");
    }

    // Install vis hooks first (sets up core.hooksPath and dispatcher scripts)
    // Temporarily unset core.hooksPath if it points to husky so installHooks doesn't skip
    const checkResult = spawnSync("git", ["config", "--local", "core.hooksPath"]);
    const existingPath = checkResult.status === 0 ? checkResult.stdout?.toString().trim() : "";

    if (existingPath && (existingPath === ".husky/_" || existingPath.startsWith(".husky"))) {
        spawnSync("git", ["config", "--local", "--unset", "core.hooksPath"]);
    }

    const installResult = installHooks(hooksDirectory);

    if (installResult.isError) {
        return installResult;
    }

    if (installResult.message) {
        logger.info(installResult.message);
    }

    // Copy and transform hook scripts
    const targetDirectory = join(root, hooksDirectory);

    mkdirSync(targetDirectory, { recursive: true });

    let migratedCount = 0;

    for (const [hookName, content] of huskyHooks) {
        if (hookName === "common.sh") {
            // Copy common.sh as-is since hooks may still reference it
            writeFileSync(join(targetDirectory, hookName), content, { mode: 0o755 });
            logger.info("  Copied common.sh");
            continue;
        }

        const transformed = transformHookScript(content);

        writeFileSync(join(targetDirectory, hookName), transformed, { mode: 0o755 });
        migratedCount++;
        logger.info(`  Migrated ${hookName}`);
    }

    // Uninstall husky package
    uninstallHuskyPackage(root, logger);

    // Clean husky references from package.json scripts
    const packageResult = cleanPackageJsonScripts(root);

    if (packageResult.modified) {
        logger.info("Updated package.json scripts:");

        for (const reference of packageResult.removedScriptReferences) {
            logger.info(`  ${reference}`);
        }
    }

    // Remove husky directory
    const huskyFullPath = join(root, huskyDirectory);

    rmSync(huskyFullPath, { force: true, recursive: true });
    logger.info(`Removed ${huskyDirectory}/`);

    return {
        isError: false,
        message: `Migration complete: ${migratedCount} hook${migratedCount === 1 ? "" : "s"} migrated from ${huskyDirectory}/ to ${hooksDirectory}/`,
    };
};

export { cleanPackageJsonScripts, detectHuskyDirectory, detectPackageManager, migrateFromHusky, transformHookScript };
