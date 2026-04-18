import { lstatSync, readdirSync, unlinkSync } from "node:fs";

import type { Command } from "@visulima/cerebro";
import { isAccessibleSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { loadNativeBindings } from "../native-binding";
import { failure, info, success } from "../output";
import { errorMessage } from "../utils";

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
            success(`Removed ${lockfile}`);
            removed++;
        } catch (error: unknown) {
            failure(`${lockfile}: ${errorMessage(error)}`);
            hadError = true;
        }
    }

    return { hadError, removed };
};

const clean: Command = {
    description: "Remove node_modules from all workspace projects",
    examples: [
        ["vis clean", "Remove all node_modules directories"],
        ["vis clean --lockfile", "Also remove lockfiles"],
        ["vis clean --dry-run", "Preview what would be removed"],
    ],
    /** Removes node_modules directories (and optionally lockfiles) across the workspace. */
    execute: async ({ logger, options, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();
        const shouldRemoveLockfile = (options.lockfile as boolean) || false;
        const dryRun = (options.dryRun as boolean) || false;

        // --dry-run uses TS walker since native cleanWorkspace is destructive
        if (dryRun) {
            const directories = findNodeModulesDirectories(cwd);

            if (directories.length > 0) {
                info("Would remove:");

                for (const dir of directories) {
                    logger.info(`  ${dir}`);
                }
            } else {
                info("No node_modules directories found.");
            }

            if (shouldRemoveLockfile) {
                removeLockfiles(cwd, true, logger);
            }

            return;
        }

        const native = loadNativeBindings();

        if (!native) {
            failure("Native bindings unavailable. Ensure the correct platform binary is installed.");
            process.exitCode = 1;

            return;
        }

        const result = native.cleanWorkspace(cwd, shouldRemoveLockfile);

        for (const dir of result.removed) {
            success(`Removed ${dir}`);
        }

        for (const file of result.lockfilesRemoved) {
            success(`Removed ${file}`);
        }

        for (const error of result.errors) {
            failure(error);
        }

        if (result.removed.length === 0 && result.lockfilesRemoved.length === 0) {
            info("No node_modules directories found.");
        } else {
            info(`Cleaned ${result.removed.length} node_modules director${result.removed.length === 1 ? "y" : "ies"}`);
        }

        if (result.errors.length > 0) {
            process.exitCode = 1;
        }
    },
    group: "Workspace",
    name: "clean",
    options: [
        { alias: "l", defaultValue: false, description: "Also remove lockfiles (pnpm-lock.yaml, package-lock.json, etc.)", name: "lockfile", type: Boolean },
        { defaultValue: false, description: "Preview what would be removed without deleting", name: "dry-run", type: Boolean },
    ],
};

export default clean;
