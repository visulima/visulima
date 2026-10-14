import { lstatSync, readdirSync, rmSync, unlinkSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { isAccessibleSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { cleanWorkspace } from "#native";

import { lintMissingPackageJson } from "../../deps/missing-package-json";
import { pail } from "../../io/logger";
import { errorMessage } from "../../util/utils";
import type { CleanOptions } from "./index";

/**
 * Finds all node_modules directories in the workspace using lstatSync
 * to avoid following symlinks during traversal. Used for --dry-run only.
 */
const findNodeModulesDirectories = (root: string): string[] => {
    const results: string[] = [];
    const stack = [root];

    while (stack.length > 0) {
        const dir = stack.pop()!;
        let entries: string[];

        try {
            entries = readdirSync(dir);
        } catch {
            continue;
        }

        for (const entry of entries) {
            const fullPath = join(dir, entry);

            try {
                const stat = lstatSync(fullPath);

                // Skip symlinks to avoid traversing outside workspace
                if (stat.isSymbolicLink() || !stat.isDirectory()) {
                    continue;
                }
            } catch {
                continue;
            }

            if (entry === "node_modules") {
                results.push(fullPath);
            } else if (entry !== ".git" && entry !== ".hg") {
                stack.push(fullPath);
            }
        }
    }

    return results;
};

const LOCKFILE_NAMES = ["pnpm-lock.yaml", "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "bun.lock", "bun.lockb"];

/** Removes lockfiles from cwd, returns count of removed and whether any failed. */
const removeLockfiles = (cwd: string, dryRun: boolean, logger: Console): { hadError: boolean; removed: number } => {
    let removed = 0;
    let hadError = false;

    for (const name of LOCKFILE_NAMES) {
        const lockfile = join(cwd, name);

        if (!isAccessibleSync(lockfile)) {
            continue;
        }

        if (dryRun) {
            logger.info(`  ${lockfile}`);
            removed++;
            continue;
        }

        try {
            unlinkSync(lockfile);
            pail.success(`Removed ${lockfile}`);
            removed++;
        } catch (error: unknown) {
            pail.error(`${lockfile}: ${errorMessage(error)}`);
            hadError = true;
        }
    }

    return { hadError, removed };
};

/** Directories whose contents are always regenerable: installs, build output and caches. */
const DISPOSABLE_DIRECTORIES = new Set([".cache", ".turbo", "dist", "node_modules"]);

/**
 * Returns the first file beneath `directory` that is not inside a disposable
 * directory, or `undefined` when there is none. Symlinks count as files, so a
 * linked checkout is never treated as empty.
 */
const findKeptFile = (directory: string): string | undefined => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = join(directory, entry.name);

        if (!entry.isDirectory()) {
            return fullPath;
        }

        if (!DISPOSABLE_DIRECTORIES.has(entry.name)) {
            const kept = findKeptFile(fullPath);

            if (kept !== undefined) {
                return kept;
            }
        }
    }

    return undefined;
};

/**
 * Removes stale workspace directories — folders that match a workspace
 * pattern (e.g. `packages/*`) but carry no `package.json`, so installs and
 * task discovery silently skip them. Only directories holding nothing but
 * disposable content (`node_modules`, `dist`, caches) are removed; anything
 * with a real file in it — source, docs, a nested package — is left alone.
 */
const removeEmptyPackages = (cwd: string, dryRun: boolean, logger: Console): { hadError: boolean; removed: number } => {
    let removed = 0;
    let hadError = false;

    for (const { packageDir } of lintMissingPackageJson(cwd)) {
        const absolute = join(cwd, packageDir);
        let keptFile: string | undefined;

        try {
            keptFile = findKeptFile(absolute);
        } catch (error: unknown) {
            pail.error(`${absolute}: ${errorMessage(error)}`);
            hadError = true;
            continue;
        }

        if (keptFile !== undefined) {
            pail.warn(`Skipping ${absolute}: not empty (contains ${keptFile})`);
            continue;
        }

        if (dryRun) {
            logger.info(`  ${absolute}`);
            removed++;
            continue;
        }

        try {
            rmSync(absolute, { force: true, recursive: true });
            pail.success(`Removed empty package ${absolute}`);
            removed++;
        } catch (error: unknown) {
            pail.error(`${absolute}: ${errorMessage(error)}`);
            hadError = true;
        }
    }

    return { hadError, removed };
};

/** Removes node_modules directories (and optionally lockfiles) across the workspace. */
const execute = async ({ logger, options, workspaceRoot: wsRoot }: Toolbox<Console, CleanOptions>): Promise<void> => {
    const cwd = wsRoot ?? process.cwd();
    const shouldRemoveLockfile = options.lockfile || false;
    const shouldRemoveEmptyPackages = options.emptyPackages || false;
    const dryRun = options.dryRun || false;

    // --dry-run uses TS walker since native cleanWorkspace is destructive
    if (dryRun) {
        const directories = findNodeModulesDirectories(cwd);

        if (directories.length > 0) {
            pail.info("Would remove:");

            for (const dir of directories) {
                logger.info(`  ${dir}`);
            }
        } else {
            pail.info("No node_modules directories found.");
        }

        if (shouldRemoveLockfile) {
            removeLockfiles(cwd, true, logger);
        }

        if (shouldRemoveEmptyPackages) {
            pail.info("Would remove empty packages:");
            removeEmptyPackages(cwd, true, logger);
        }

        return;
    }

    const result = cleanWorkspace(cwd, shouldRemoveLockfile);

    for (const dir of result.removed) {
        pail.success(`Removed ${dir}`);
    }

    for (const file of result.lockfilesRemoved) {
        pail.success(`Removed ${file}`);
    }

    for (const error of result.errors) {
        pail.error(error);
    }

    if (result.removed.length === 0 && result.lockfilesRemoved.length === 0) {
        pail.info("No node_modules directories found.");
    } else {
        pail.info(`Cleaned ${result.removed.length} node_modules director${result.removed.length === 1 ? "y" : "ies"}`);
    }

    let emptyPackagesFailed = false;

    if (shouldRemoveEmptyPackages) {
        const { hadError, removed } = removeEmptyPackages(cwd, false, logger);

        emptyPackagesFailed = hadError;

        if (removed > 0) {
            pail.info(`Cleaned ${removed} empty package director${removed === 1 ? "y" : "ies"}`);
        }
    }

    if (result.errors.length > 0 || emptyPackagesFailed) {
        process.exitCode = 1;
    }
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute as CommandExecute<Toolbox>;
