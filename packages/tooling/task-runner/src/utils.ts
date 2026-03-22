import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "@visulima/path";

import type { Task, TaskResult } from "./types";

/**
 * Hashes a file's content using SHA-256.
 * Returns undefined if the file cannot be read.
 */
const hashFile = async (filePath: string): Promise<string | undefined> => {
    try {
        const content = await readFile(filePath);

        return createHash("sha256").update(content).digest("hex");
    } catch {
        return undefined;
    }
};

/**
 * Hashes one or more string values using SHA-256.
 */
const hashStrings = (...values: string[]): string => {
    const hash = createHash("sha256");

    for (const v of values) {
        hash.update(v);
    }

    return hash.digest("hex");
};

/**
 * Sorts an object's keys for deterministic serialization.
 */
const sortObjectKeys = (object: Record<string, unknown>): Record<string, unknown> => {
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(object).toSorted()) {
        const value = object[key];

        sorted[key]
            = value !== undefined && value !== null && typeof value === "object" && !Array.isArray(value)
                ? sortObjectKeys(value as Record<string, unknown>)
                : value;
    }

    return sorted;
};

/**
 * Recursively collects all file paths in a directory,
 * skipping directories in the ignored set.
 */
const collectFiles = async (directory: string, ignoredDirectories: Set<string>): Promise<string[]> => {
    const results: string[] = [];

    try {
        const directoryStat = await stat(directory);

        if (directoryStat.isFile()) {
            return [directory];
        }

        const entries = await readdir(directory, { withFileTypes: true });

        const promises = entries.map(async (entry) => {
            if (ignoredDirectories.has(entry.name)) {
                return [];
            }

            const fullPath = join(directory, entry.name);

            if (entry.isDirectory()) {
                return collectFiles(fullPath, ignoredDirectories);
            }

            if (entry.isFile()) {
                return [fullPath];
            }

            // Follow symlinks
            if (entry.isSymbolicLink()) {
                try {
                    const linkStat = await stat(fullPath);

                    if (linkStat.isFile()) {
                        return [fullPath];
                    }

                    if (linkStat.isDirectory()) {
                        return collectFiles(fullPath, ignoredDirectories);
                    }
                } catch {
                    // Broken symlink
                }
            }

            return [];
        });

        const nested = await Promise.all(promises);

        for (const files of nested) {
            results.push(...files);
        }
    } catch {
        // Directory doesn't exist or can't be read
    }

    return results;
};

/**
 * Resolves the working directory for a task.
 */

// eslint-disable-next-line no-confusing-arrow
const resolveTaskCwd = (workspaceRoot: string, task: Task): string => task.projectRoot ? join(workspaceRoot, task.projectRoot) : workspaceRoot;

/**
 * Creates a failure TaskResult from an error.
 */
const createFailureResult = (task: Task, error: unknown, startTime: number): TaskResult => {
    return {
        code: 1,
        endTime: Date.now(),
        startTime,
        status: "failure",
        task,
        terminalOutput: error instanceof Error ? error.message : String(error),
    };
};

/**
 * Reads and parses a package.json, returning dependency names.
 */
const READ_PACKAGE_DEPS_DEFAULTS = { optional: true, peer: true } as const;

const readPackageDeps = async (
    packageJsonPath: string,
    options: { optional?: boolean; peer?: boolean } = READ_PACKAGE_DEPS_DEFAULTS,
): Promise<Set<string> | undefined> => {
    try {
        const content = await readFile(packageJsonPath, "utf8");
        const pkg = JSON.parse(content) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            optionalDependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };

        const deps = new Set<string>();
        const maps = [pkg.dependencies, pkg.devDependencies];

        if (options.peer !== false) {
            maps.push(pkg.peerDependencies);
        }

        if (options.optional !== false) {
            maps.push(pkg.optionalDependencies);
        }

        for (const depMap of maps) {
            if (depMap) {
                for (const name of Object.keys(depMap)) {
                    deps.add(name);
                }
            }
        }

        return deps;
    } catch {
        return undefined;
    }
};

export { collectFiles, createFailureResult, hashFile, hashStrings, readPackageDeps, resolveTaskCwd, sortObjectKeys };
