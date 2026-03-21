import {
    cp,
    mkdir,
    readdir,
    readFile,
    rename,
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
 *     fingerprint.json  (Auto-fingerprint data, optional)
 *     .commit           (Marker indicating complete cache entry)
 *   .task-index.json    (Task ID → hash mapping for auto-fingerprint)
 * ```
 *
 * Atomicity: Cache entries are written to a temporary directory first,
 * then renamed into place. The `.commit` marker ensures readers only
 * see complete entries.
 */
export class Cache {
    readonly #workspaceRoot: string;
    readonly #cacheDirectory: string;
    readonly #maxCacheAge: number;
    readonly #maxCacheSize: number | null;

    constructor(options: CacheOptions) {
        this.#workspaceRoot = options.workspaceRoot;
        this.#cacheDirectory =
            options.cacheDirectory ?? join(options.workspaceRoot, ".task-runner-cache");
        this.#maxCacheAge = options.maxCacheAge ?? DEFAULT_MAX_CACHE_AGE;
        this.#maxCacheSize = options.maxCacheSize
            ? parseCacheSize(options.maxCacheSize)
            : null;
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
            // Reading .commit first verifies the entry is complete (atomic write guarantee)
            await readFile(join(cacheEntryDir, ".commit"));

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
     *
     * Uses atomic write: builds the entry in a temporary directory,
     * then renames into place to avoid partial reads by concurrent processes.
     */
    async put(
        hash: string,
        terminalOutput: string,
        outputs: string[],
        code: number,
        fingerprint?: TaskFingerprint,
    ): Promise<void> {
        const cacheEntryDir = join(this.#cacheDirectory, hash);
        const tempDir = join(
            this.#cacheDirectory,
            `.tmp-${hash}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        );

        try {
            await mkdir(tempDir, { recursive: true });

            // Write data files in parallel, then .commit marker last
            const writes: Promise<void>[] = [
                writeFile(join(tempDir, "code"), String(code)),
                writeFile(join(tempDir, "terminalOutput"), terminalOutput),
                this.#archiveOutputs(tempDir, outputs),
            ];

            if (fingerprint) {
                writes.push(writeFile(join(tempDir, "fingerprint.json"), JSON.stringify(fingerprint)));
            }

            await Promise.all(writes);
            await writeFile(join(tempDir, ".commit"), "");

            // Atomically move into place
            await this.#removeEntry(cacheEntryDir);
            await rename(tempDir, cacheEntryDir);
        } catch {
            // Clean up temp dir on failure
            await this.#removeEntry(tempDir);
        }
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
     * Uses atomic write to prevent corruption from concurrent access.
     */
    async setTaskIndex(taskId: string, hash: string): Promise<void> {
        const indexFile = join(this.#cacheDirectory, ".task-index.json");
        const tempFile = join(
            this.#cacheDirectory,
            `.task-index-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.tmp`,
        );

        let index: Record<string, string> = {};

        try {
            const indexContent = await readFile(indexFile, "utf-8");

            index = JSON.parse(indexContent) as Record<string, string>;
        } catch {
            // Index doesn't exist yet
        }

        index[taskId] = hash;

        await mkdir(this.#cacheDirectory, { recursive: true });
        await writeFile(tempFile, JSON.stringify(index));

        try {
            await rename(tempFile, indexFile);
        } catch {
            // Fallback: direct write if rename fails (cross-device)
            await writeFile(indexFile, JSON.stringify(index));
            await rm(tempFile, { force: true });
        }
    }

    /**
     * Removes old cache entries that exceed the maximum age,
     * and enforces the maximum cache size by evicting oldest entries.
     */
    async removeOldEntries(): Promise<void> {
        try {
            const entries = await readdir(this.#cacheDirectory);
            const now = Date.now();

            // Collect entry metadata for age and size eviction
            const entryInfos: Array<{ name: string; path: string; mtimeMs: number; size: number }> = [];

            for (const entry of entries) {
                // Skip index files and temp dirs
                if (entry.startsWith(".")) {
                    continue;
                }

                const entryPath = join(this.#cacheDirectory, entry);

                try {
                    const entryStat = await stat(entryPath);

                    if (now - entryStat.mtimeMs > this.#maxCacheAge) {
                        // Remove expired entries immediately
                        await this.#removeEntry(entryPath);
                    } else {
                        const size = await this.#getDirectorySize(entryPath);

                        entryInfos.push({
                            name: entry,
                            path: entryPath,
                            mtimeMs: entryStat.mtimeMs,
                            size,
                        });
                    }
                } catch {
                    // Entry may have been removed already
                }
            }

            // Enforce max cache size by evicting oldest entries first
            if (this.#maxCacheSize !== null) {
                // Sort by modification time (oldest first)
                entryInfos.sort((a, b) => a.mtimeMs - b.mtimeMs);

                let totalSize = 0;

                for (const info of entryInfos) {
                    totalSize += info.size;
                }

                // Evict oldest entries until under the limit
                for (const info of entryInfos) {
                    if (totalSize <= this.#maxCacheSize) {
                        break;
                    }

                    await this.#removeEntry(info.path);
                    totalSize -= info.size;
                }
            }
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
     * Calculates the total size of a directory in bytes.
     */
    async #getDirectorySize(dirPath: string): Promise<number> {
        let totalSize = 0;

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    totalSize += await this.#getDirectorySize(fullPath);
                } else if (entry.isFile()) {
                    const fileStat = await stat(fullPath);

                    totalSize += fileStat.size;
                }
            }
        } catch {
            // Ignore errors
        }

        return totalSize;
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
