import { readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import type { Command } from "@visulima/cerebro";

import { loadNativeBindings } from "../native-binding";
import { failure, info, success } from "../output";
import { errorMessage } from "../utils";

/**
 * Pure TypeScript fallback for clean when native bindings are unavailable.
 * Finds and removes all node_modules directories in the workspace.
 */
const findNodeModulesDirs = (root: string): string[] => {
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
                if (!statSync(fullPath).isDirectory()) {
                    continue;
                }
            } catch {
                continue;
            }

            if (entry === "node_modules") {
                results.push(fullPath);
                // Don't recurse into node_modules
            } else if (entry !== ".git" && entry !== ".hg") {
                stack.push(fullPath);
            }
        }
    }

    return results;
};

const LOCKFILE_NAMES = [
    "pnpm-lock.yaml",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
];

const clean: Command = {
    description: "Remove node_modules from all workspace projects",
    examples: [
        ["vis clean", "Remove all node_modules directories"],
        ["vis clean --lockfile", "Also remove lockfiles"],
        ["vis clean --dry-run", "Preview what would be removed"],
    ],
    execute: async ({ logger, options, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();
        const removeLockfile = (options.lockfile as boolean) || false;
        const dryRun = (options["dry-run"] as boolean) || false;

        // Try native (Rust) implementation first for performance
        const native = loadNativeBindings();

        if (native && !dryRun) {
            const result = native.cleanWorkspace(cwd, removeLockfile);

            for (const dir of result.removed) {
                success(`Removed ${dir}`);
            }

            for (const file of result.lockfilesRemoved) {
                success(`Removed ${file}`);
            }

            for (const err of result.errors) {
                failure(err);
            }

            if (result.removed.length === 0 && result.lockfilesRemoved.length === 0) {
                info("No node_modules directories found.");
            } else {
                info(`Cleaned ${result.removed.length} node_modules director${result.removed.length === 1 ? "y" : "ies"}`);
            }

            if (result.errors.length > 0) {
                process.exitCode = 1;
            }

            return;
        }

        // TypeScript fallback
        const dirs = findNodeModulesDirs(cwd);

        if (dirs.length === 0) {
            info("No node_modules directories found.");

            return;
        }

        if (dryRun) {
            info("Would remove:");

            for (const dir of dirs) {
                logger.info(`  ${dir}`);
            }

            if (removeLockfile) {
                for (const name of LOCKFILE_NAMES) {
                    const lockfile = join(cwd, name);

                    try {
                        statSync(lockfile);
                        logger.info(`  ${lockfile}`);
                    } catch {
                        // Not found
                    }
                }
            }

            return;
        }

        let removedCount = 0;

        for (const dir of dirs) {
            try {
                rmSync(dir, { force: true, recursive: true });
                success(`Removed ${dir}`);
                removedCount++;
            } catch (error: unknown) {
                failure(`${dir}: ${errorMessage(error)}`);
            }
        }

        if (removeLockfile) {
            for (const name of LOCKFILE_NAMES) {
                const lockfile = join(cwd, name);

                try {
                    statSync(lockfile);
                    unlinkSync(lockfile);
                    success(`Removed ${lockfile}`);
                } catch {
                    // Not found, skip
                }
            }
        }

        info(`Cleaned ${removedCount} node_modules director${removedCount === 1 ? "y" : "ies"}`);
    },
    name: "clean",
    options: [
        { alias: "l", defaultValue: false, description: "Also remove lockfiles (pnpm-lock.yaml, package-lock.json, etc.)", name: "lockfile", type: Boolean },
        { defaultValue: false, description: "Preview what would be removed without deleting", name: "dry-run", type: Boolean },
    ],
};

export default clean;
