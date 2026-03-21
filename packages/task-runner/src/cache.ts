import {
    cp,
    mkdir,
    readdir,
    readFile,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";

import type { TaskFingerprint } from "./fingerprint";

/**
 * Represents a cached task result.
 */
export interface CachedResult {
    /** The exit code of the original task execution */
    code: number;
    /** The terminal output of the original task execution */
    terminalOutput: string;
    /** The hash that was used as the cache key */
    hash: string;
    /** The auto-fingerprint data, if auto-fingerprinting was used */
    fingerprint?: TaskFingerprint;
}

/**
 * Options for creating a Cache instance.
 */
export interface CacheOptions {
    /** The workspace root directory */
    workspaceRoot: string;
    /** The cache directory (defaults to `{workspaceRoot}/.task-runner-cache`) */
    cacheDirectory?: string;
    /** Maximum cache size (e.g., "500MB", "1GB") */
    maxCacheSize?: string;
    /** Maximum age of cache entries in milliseconds (default: 7 days) */
    maxCacheAge?: number;
}

const DEFAULT_MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Local file-based cache for task results.
 *
 * Cache structure:
 * ```
 * .task-runner-cache/
 *   <hash>/
 *     outputs/          (Archived build outputs)
 *     code              (Exit code)
 *     terminalOutput    (Captured terminal output)
 *     .commit           (Marker indicating complete cache entry)
 * ```
 */
export class Cache {
    readonly #workspaceRoot: string;
    readonly #cacheDirectory: string;
    readonly #maxCacheAge: number;

    constructor(options: CacheOptions) {
        this.#workspaceRoot = options.workspaceRoot;
        this.#cacheDirectory =
            options.cacheDirectory ?? join(options.workspaceRoot, ".task-runner-cache");
        this.#maxCacheAge = options.maxCacheAge ?? DEFAULT_MAX_CACHE_AGE;
    }

    /**
     * Gets the cache directory path.
     */
    get cacheDirectory(): string {
        return this.#cacheDirectory;
    }

    /**
     * Retrieves a cached result for the given task hash.
     * Returns null if no valid cache entry exists.
     */
    async get(hash: string): Promise<CachedResult | null> {
        const cacheEntryDir = join(this.#cacheDirectory, hash);

        try {
            // Check for the .commit marker to ensure the entry is complete
            await stat(join(cacheEntryDir, ".commit"));

            const codeString = await readFile(join(cacheEntryDir, "code"), "utf-8");
            const code = Number.parseInt(codeString.trim(), 10);

            let terminalOutput = "";

            try {
                terminalOutput = await readFile(
                    join(cacheEntryDir, "terminalOutput"),
                    "utf-8",
                );
            } catch {
                // Terminal output may not exist
            }

            let fingerprint: TaskFingerprint | undefined;

            try {
                const fingerprintContent = await readFile(
                    join(cacheEntryDir, "fingerprint.json"),
                    "utf-8",
                );

                fingerprint = JSON.parse(fingerprintContent) as TaskFingerprint;
            } catch {
                // Fingerprint may not exist (non-auto-fingerprinted entry)
            }

            return { code, terminalOutput, hash, fingerprint };
        } catch {
            return null;
        }
    }

    /**
     * Stores a task result in the cache.
     */
    async put(
        hash: string,
        terminalOutput: string,
        outputs: string[],
        code: number,
        fingerprint?: TaskFingerprint,
    ): Promise<void> {
        const cacheEntryDir = join(this.#cacheDirectory, hash);

        // Remove any existing incomplete entry
        await this.#removeEntry(cacheEntryDir);

        // Create the cache entry directory
        await mkdir(cacheEntryDir, { recursive: true });

        // Store exit code
        await writeFile(join(cacheEntryDir, "code"), String(code));

        // Store terminal output
        await writeFile(join(cacheEntryDir, "terminalOutput"), terminalOutput);

        // Store fingerprint if provided
        if (fingerprint) {
            await writeFile(
                join(cacheEntryDir, "fingerprint.json"),
                JSON.stringify(fingerprint),
            );
        }

        // Archive output files
        await this.#archiveOutputs(cacheEntryDir, outputs);

        // Write the .commit marker last to indicate a complete entry
        await writeFile(join(cacheEntryDir, ".commit"), "");
    }

    /**
     * Restores cached outputs to their original locations.
     */
    async restoreOutputs(hash: string, outputs: string[]): Promise<boolean> {
        const cacheEntryDir = join(this.#cacheDirectory, hash);
        const outputsDir = join(cacheEntryDir, "outputs");

        try {
            await stat(outputsDir);
        } catch {
            // No outputs to restore
            return true;
        }

        try {
            for (const output of outputs) {
                const absoluteOutput = resolve(this.#workspaceRoot, output);
                const cachedOutput = join(outputsDir, output);

                try {
                    await stat(cachedOutput);
                } catch {
                    continue;
                }

                // Ensure the parent directory exists
                const parentDir = join(absoluteOutput, "..");

                await mkdir(parentDir, { recursive: true });

                // Remove existing output
                await rm(absoluteOutput, { recursive: true, force: true });

                // Copy cached output
                await cp(cachedOutput, absoluteOutput, { recursive: true });
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Retrieves the most recent cached result for a task by its ID.
     * Used in auto-fingerprint mode where the hash is derived from
     * tracked file accesses rather than computed upfront.
     */
    async getByTaskId(taskId: string): Promise<CachedResult | null> {
        const indexFile = join(this.#cacheDirectory, ".task-index.json");

        try {
            const indexContent = await readFile(indexFile, "utf-8");
            const index = JSON.parse(indexContent) as Record<string, string>;
            const hash = index[taskId];

            if (!hash) {
                return null;
            }

            return this.get(hash);
        } catch {
            return null;
        }
    }

    /**
     * Stores the mapping from task ID to cache hash.
     * Used in auto-fingerprint mode for looking up entries by task ID.
     */
    async setTaskIndex(taskId: string, hash: string): Promise<void> {
        const indexFile = join(this.#cacheDirectory, ".task-index.json");
        let index: Record<string, string> = {};

        try {
            const indexContent = await readFile(indexFile, "utf-8");

            index = JSON.parse(indexContent) as Record<string, string>;
        } catch {
            // Index doesn't exist yet
        }

        index[taskId] = hash;

        await mkdir(this.#cacheDirectory, { recursive: true });
        await writeFile(indexFile, JSON.stringify(index));
    }

    /**
     * Removes old cache entries that exceed the maximum age.
     */
    async removeOldEntries(): Promise<void> {
        try {
            const entries = await readdir(this.#cacheDirectory);
            const now = Date.now();

            const removalPromises = entries.map(async (entry) => {
                const entryPath = join(this.#cacheDirectory, entry);

                try {
                    const entryStat = await stat(entryPath);

                    if (now - entryStat.mtimeMs > this.#maxCacheAge) {
                        await this.#removeEntry(entryPath);
                    }
                } catch {
                    // Entry may have been removed already
                }
            });

            await Promise.all(removalPromises);
        } catch {
            // Cache directory may not exist yet
        }
    }

    /**
     * Clears the entire cache.
     */
    async clear(): Promise<void> {
        try {
            await rm(this.#cacheDirectory, { recursive: true, force: true });
        } catch {
            // Cache directory may not exist
        }
    }

    /**
     * Archives task output files into the cache.
     */
    async #archiveOutputs(cacheEntryDir: string, outputs: string[]): Promise<void> {
        const outputsDir = join(cacheEntryDir, "outputs");

        await mkdir(outputsDir, { recursive: true });

        for (const output of outputs) {
            const absoluteOutput = resolve(this.#workspaceRoot, output);
            const cachedOutput = join(outputsDir, output);

            try {
                await stat(absoluteOutput);

                const cachedOutputParent = join(cachedOutput, "..");

                await mkdir(cachedOutputParent, { recursive: true });
                await cp(absoluteOutput, cachedOutput, { recursive: true });
            } catch {
                // Output file doesn't exist, skip it
            }
        }
    }

    /**
     * Removes a cache entry directory.
     */
    async #removeEntry(entryPath: string): Promise<void> {
        try {
            await rm(entryPath, { recursive: true, force: true });
        } catch {
            // Ignore removal errors
        }
    }
}

/**
 * Parses a human-readable cache size string into bytes.
 */
export const parseCacheSize = (sizeString: string): number => {
    const match = /^(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)?$/i.exec(sizeString.trim());

    if (!match) {
        throw new Error(
            `Invalid cache size format: "${sizeString}". Expected format like "500MB" or "1GB".`,
        );
    }

    const value = Number.parseFloat(match[1] as string);
    const unit = (match[2] ?? "B").toUpperCase();

    const multipliers: Record<string, number> = {
        B: 1,
        KB: 1024,
        MB: 1024 * 1024,
        GB: 1024 * 1024 * 1024,
        TB: 1024 * 1024 * 1024 * 1024,
    };

    const multiplier = multipliers[unit];

    if (multiplier === undefined) {
        throw new Error(`Unknown size unit: ${unit}`);
    }

    return value * multiplier;
};

/**
 * Formats a byte count into a human-readable string.
 */
export const formatCacheSize = (bytes: number): string => {
    if (bytes < 1024) {
        return `${bytes}B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)}KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
};
