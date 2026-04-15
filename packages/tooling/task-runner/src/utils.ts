import { readdir, readFile, realpath, stat } from "node:fs/promises";

// eslint-disable-next-line import/no-extraneous-dependencies -- bundled inline by packem from workspace devDependency
import { createXxh3Hasher, xxh3Hash } from "@shared/xxh3";
import { join } from "@visulima/path";

import type { Task, TaskResult } from "./types";

/**
 * Hashes a file's content using xxh3-128.
 * Returns undefined if the file cannot be read.
 */
const hashFile = async (filePath: string): Promise<string | undefined> => {
    try {
        const content = await readFile(filePath);

        return xxh3Hash(content);
    } catch {
        return undefined;
    }
};

/**
 * Hashes one or more string values using xxh3-128.
 */
const hashStrings = (...values: string[]): string => {
    const hash = createXxh3Hasher();

    for (const v of values) {
        hash.update(v);
        hash.update("\0");
    }

    return hash.digest();
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
 *
 * Tracks visited real paths to prevent infinite loops from symlink cycles.
 */
const collectFiles = async (directory: string, ignoredDirectories: Set<string>, visitedRealPaths?: Set<string>): Promise<string[]> => {
    const visited = visitedRealPaths ?? new Set<string>();
    const results: string[] = [];

    try {
        const directoryStat = await stat(directory);

        if (directoryStat.isFile()) {
            return [directory];
        }

        // Resolve real path to detect symlink cycles
        const resolvedPath = await realpath(directory);

        if (visited.has(resolvedPath)) {
            return [];
        }

        visited.add(resolvedPath);

        const entries = await readdir(directory, { withFileTypes: true });

        const promises = entries.map(async (entry) => {
            if (ignoredDirectories.has(entry.name)) {
                return [];
            }

            const fullPath = join(directory, entry.name);

            if (entry.isDirectory()) {
                return collectFiles(fullPath, ignoredDirectories, visited);
            }

            if (entry.isFile()) {
                return [fullPath];
            }

            // Follow symlinks with cycle detection
            if (entry.isSymbolicLink()) {
                try {
                    const linkStat = await stat(fullPath);

                    if (linkStat.isFile()) {
                        return [fullPath];
                    }

                    if (linkStat.isDirectory()) {
                        return collectFiles(fullPath, ignoredDirectories, visited);
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

const resolveTaskCwd = (workspaceRoot: string, task: Task): string => (task.projectRoot ? join(workspaceRoot, task.projectRoot) : workspaceRoot);

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

/**
 * Generates a unique ID for temporary files/directories.
 * Not cryptographically secure — for cache entry naming only.
 */
// eslint-disable-next-line sonarjs/pseudo-random
const uniqueId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export { collectFiles, createFailureResult, hashFile, hashStrings, readPackageDeps, resolveTaskCwd, sortObjectKeys, uniqueId };
