import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import type { Task, TaskResult } from "./types";

/**
 * Hashes a file's content using SHA-256.
 * Returns null if the file cannot be read.
 */
export const hashFile = async (filePath: string): Promise<string | null> => {
    try {
        const content = await readFile(filePath);

        return createHash("sha256").update(content).digest("hex");
    } catch {
        return null;
    }
};

/**
 * Hashes one or more string values using SHA-256.
 */
export const hashStrings = (...values: string[]): string => {
    const hash = createHash("sha256");

    for (const v of values) {
        hash.update(v);
    }

    return hash.digest("hex");
};

/**
 * Sorts an object's keys for deterministic serialization.
 */
export const sortObjectKeys = (object: Record<string, unknown>): Record<string, unknown> => {
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(object).sort()) {
        sorted[key] = object[key];
    }

    return sorted;
};

/**
 * Recursively collects all file paths in a directory,
 * skipping directories in the ignored set.
 */
export const collectFiles = async (
    dir: string,
    ignoredDirs: Set<string>,
): Promise<string[]> => {
    const results: string[] = [];

    try {
        const dirStat = await stat(dir);

        if (dirStat.isFile()) {
            return [dir];
        }

        const entries = await readdir(dir, { withFileTypes: true });

        const promises = entries.map(async (entry) => {
            if (ignoredDirs.has(entry.name)) {
                return [];
            }

            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                return collectFiles(fullPath, ignoredDirs);
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
                        return collectFiles(fullPath, ignoredDirs);
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
export const resolveTaskCwd = (workspaceRoot: string, task: Task): string => {
    return task.projectRoot
        ? join(workspaceRoot, task.projectRoot)
        : workspaceRoot;
};

/**
 * Creates a failure TaskResult from an error.
 */
export const createFailureResult = (
    task: Task,
    error: unknown,
    startTime: number,
): TaskResult => ({
    task,
    status: "failure",
    terminalOutput: error instanceof Error ? error.message : String(error),
    startTime,
    endTime: Date.now(),
    code: 1,
});

/**
 * Reads and parses a package.json, returning dependency names.
 */
export const readPackageDeps = async (
    packageJsonPath: string,
    options: { peer?: boolean; optional?: boolean } = { peer: true, optional: true },
): Promise<Set<string> | null> => {
    try {
        const content = await readFile(packageJsonPath, "utf-8");
        const pkg = JSON.parse(content) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
            optionalDependencies?: Record<string, string>;
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
        return null;
    }
};
