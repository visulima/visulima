// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "@visulima/path";

import { formatBytes, parseBytes } from "@visulima/humanizer";

import type { TaskFingerprint } from "./fingerprint";
import { uniqueId } from "./utils";

/**
 * Represents a cached task result.
 */
interface CachedResult {
    /** The exit code of the original task execution */
    code: number;
    /** The auto-fingerprint data, if auto-fingerprinting was used */
    fingerprint?: TaskFingerprint;
    /** The hash that was used as the cache key */
    hash: string;
    /** The terminal output of the original task execution */
    terminalOutput: string;
}

/**
 * Options for creating a Cache instance.
 */
interface CacheOptions {
    /** The cache directory (defaults to `{workspaceRoot}/.task-runner-cache`) */
    cacheDirectory?: string;
    /** Maximum age of cache entries in milliseconds (default: 7 days) */
    maxCacheAge?: number;
    /** Maximum cache size (e.g., "500MB", "1GB") */
    maxCacheSize?: string;
    /** The workspace root directory */
    workspaceRoot: string;
}

const DEFAULT_MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Removes a cache entry directory.
 */
const removeEntry = async (entryPath: string): Promise<void> => {
    try {
        await rm(entryPath, { force: true, recursive: true });
    } catch {
        // Ignore removal errors
    }
};

/**
 * Calculates the total size of a directory in bytes.
 */
const getDirectorySize = async (directoryPath: string): Promise<number> => {
    let totalSize = 0;

    try {
        const entries = await readdir(directoryPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(directoryPath, entry.name);

            if (entry.isDirectory()) {
                // eslint-disable-next-line no-await-in-loop
                totalSize += await getDirectorySize(fullPath);
            } else if (entry.isFile()) {
                // eslint-disable-next-line no-await-in-loop
                const fileStat = await stat(fullPath);

                totalSize += fileStat.size;
            }
        }
    } catch {
        // Ignore errors
    }

    return totalSize;
};

/**
 * Parses a human-readable cache size string into bytes.
 * Delegates to @visulima/humanizer's parseBytes with base-2 (1024) multipliers.
 */
const parseCacheSize = (sizeString: string): number => {
    const result = parseBytes(sizeString.trim());

    if (Number.isNaN(result)) {
        throw new Error(`Invalid cache size format: "${sizeString}". Expected format like "500MB" or "1GB".`);
    }

    return result;
};

/**
 * Formats a byte count into a human-readable string.
 * Delegates to @visulima/humanizer's formatBytes with base-2 (1024) multipliers.
 */
const formatCacheSize = (bytes: number): string => formatBytes(bytes, { decimals: 1, space: false });

/**
 * Local file-based cache for task results.
 *
 * Cache structure:
 * ```
 * .task-runner-cache/
 *   &lt;hash&gt;/
 *     outputs/          (Archived build outputs)
 *     code              (Exit code)
 *     terminalOutput    (Captured terminal output)
 *     fingerprint.json  (Auto-fingerprint data, optional)
 *     .commit           (Marker indicating complete cache entry)
 *   .task-index.json    (Task ID -> hash mapping for auto-fingerprint)
 * ```
 *
 * Atomicity: Cache entries are written to a temporary directory first,
 * then renamed into place. The `.commit` marker ensures readers only
 * see complete entries.
 */
class Cache {
    readonly #workspaceRoot: string;

    readonly #cacheDirectory: string;

    readonly #maxCacheAge: number;

    readonly #maxCacheSize: number | undefined;

    /** Serializes concurrent setTaskIndex writes to prevent lost updates */
    #indexWriteQueue: Promise<void> = Promise.resolve();

    public constructor(options: CacheOptions) {
        this.#workspaceRoot = options.workspaceRoot;
        this.#cacheDirectory = options.cacheDirectory ?? join(options.workspaceRoot, ".task-runner-cache");
        this.#maxCacheAge = options.maxCacheAge ?? DEFAULT_MAX_CACHE_AGE;
        this.#maxCacheSize = options.maxCacheSize ? parseCacheSize(options.maxCacheSize) : undefined;
    }

    /**
     * Gets the cache directory path.
     */
    public get cacheDirectory(): string {
        return this.#cacheDirectory;
    }

    /**
     * Retrieves a cached result for the given task hash.
     * Returns undefined if no valid cache entry exists.
     */
    public async get(hash: string): Promise<CachedResult | undefined> {
        const cacheEntryDirectory = join(this.#cacheDirectory, hash);

        try {
            // Reading .commit first verifies the entry is complete (atomic write guarantee)
            await readFile(join(cacheEntryDirectory, ".commit"));

            const codeString = await readFile(join(cacheEntryDirectory, "code"), "utf8");
            const code = Number.parseInt(codeString.trim(), 10);

            if (Number.isNaN(code)) {
                return undefined;
            }

            let terminalOutput = "";

            try {
                terminalOutput = await readFile(join(cacheEntryDirectory, "terminalOutput"), "utf8");
            } catch {
                // Terminal output may not exist
            }

            let fingerprint: TaskFingerprint | undefined;

            try {
                const fingerprintContent = await readFile(join(cacheEntryDirectory, "fingerprint.json"), "utf8");

                fingerprint = JSON.parse(fingerprintContent) as TaskFingerprint;
            } catch {
                // Fingerprint may not exist (non-auto-fingerprinted entry)
            }

            return { code, fingerprint, hash, terminalOutput };
        } catch {
            return undefined;
        }
    }

    /**
     * Stores a task result in the cache.
     *
     * Uses atomic write: builds the entry in a temporary directory,
     * then renames into place to avoid partial reads by concurrent processes.
     */
    public async put(hash: string, terminalOutput: string, outputs: string[], code: number, fingerprint?: TaskFingerprint): Promise<void> {
        const cacheEntryDirectory = join(this.#cacheDirectory, hash);
        const temporaryDirectory = join(this.#cacheDirectory, `.tmp-${hash}-${uniqueId()}`);

        try {
            await mkdir(temporaryDirectory, { recursive: true });

            // Write data files in parallel, then .commit marker last
            const writes: Promise<void>[] = [
                writeFile(join(temporaryDirectory, "code"), String(code)),
                writeFile(join(temporaryDirectory, "terminalOutput"), terminalOutput),
                this.#archiveOutputs(temporaryDirectory, outputs),
            ];

            if (fingerprint) {
                writes.push(writeFile(join(temporaryDirectory, "fingerprint.json"), JSON.stringify(fingerprint)));
            }

            await Promise.all(writes);
            await writeFile(join(temporaryDirectory, ".commit"), "");

            // Atomically move into place
            await removeEntry(cacheEntryDirectory);
            await rename(temporaryDirectory, cacheEntryDirectory);
        } catch {
            // Clean up temp dir on failure
            await removeEntry(temporaryDirectory);
        }
    }

    /**
     * Restores cached outputs to their original locations.
     */
    public async restoreOutputs(hash: string, outputs: string[]): Promise<boolean> {
        const cacheEntryDirectory = join(this.#cacheDirectory, hash);
        const outputsDirectory = join(cacheEntryDirectory, "outputs");

        try {
            await stat(outputsDirectory);
        } catch {
            // No outputs to restore
            return true;
        }

        try {
            await Promise.all(
                outputs.map(async (output) => {
                    const absoluteOutput = resolve(this.#workspaceRoot, output);
                    const cachedOutput = join(outputsDirectory, output);

                    try {
                        await stat(cachedOutput);
                    } catch {
                        return;
                    }

                    const parentDirectory = dirname(absoluteOutput);

                    await mkdir(parentDirectory, { recursive: true });

                    // Remove existing output
                    await rm(absoluteOutput, { force: true, recursive: true });

                    // Copy cached output
                    await cp(cachedOutput, absoluteOutput, { recursive: true });
                }),
            );

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
    public async getByTaskId(taskId: string): Promise<CachedResult | undefined> {
        const indexFile = join(this.#cacheDirectory, ".task-index.json");

        try {
            const indexContent = await readFile(indexFile, "utf8");
            const index = JSON.parse(indexContent) as Record<string, string>;
            const hash = index[taskId];

            if (!hash) {
                return undefined;
            }

            return this.get(hash);
        } catch {
            return undefined;
        }
    }

    /**
     * Stores the mapping from task ID to cache hash.
     * Uses a write queue to serialize concurrent writes and prevent lost updates.
     * Each write is atomic (temp file + rename).
     */
    public async setTaskIndex(taskId: string, hash: string): Promise<void> {
        // Serialize writes through a queue to prevent concurrent read-modify-write races
        this.#indexWriteQueue = this.#indexWriteQueue.then(() => this.#writeTaskIndex(taskId, hash)).catch(() => {});

        return this.#indexWriteQueue;
    }

    async #writeTaskIndex(taskId: string, hash: string): Promise<void> {
        const indexFile = join(this.#cacheDirectory, ".task-index.json");
        const temporaryFile = join(this.#cacheDirectory, `.task-index-${uniqueId()}.tmp`);

        let index: Record<string, string> = {};

        try {
            const indexContent = await readFile(indexFile, "utf8");

            index = JSON.parse(indexContent) as Record<string, string>;
        } catch {
            // Index doesn't exist yet
        }

        index[taskId] = hash;

        await mkdir(this.#cacheDirectory, { recursive: true });
        await writeFile(temporaryFile, JSON.stringify(index));

        try {
            await rename(temporaryFile, indexFile);
        } catch {
            // Fallback: direct write if rename fails (cross-device)
            await writeFile(indexFile, JSON.stringify(index));
            await rm(temporaryFile, { force: true });
        }
    }

    /**
     * Removes old cache entries that exceed the maximum age,
     * and enforces the maximum cache size by evicting oldest entries.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async removeOldEntries(): Promise<void> {
        try {
            const entries = await readdir(this.#cacheDirectory);
            const now = Date.now();

            // Collect entry metadata for age and size eviction
            const entryInfos: { mtimeMs: number; name: string; path: string; size: number }[] = [];

            for (const entry of entries) {
                // Skip index files and temp dirs
                if (entry.startsWith(".")) {
                    continue;
                }

                const entryPath = join(this.#cacheDirectory, entry);

                try {
                    // eslint-disable-next-line no-await-in-loop
                    const entryStat = await stat(entryPath);

                    if (now - entryStat.mtimeMs > this.#maxCacheAge) {
                        // Remove expired entries immediately
                        // eslint-disable-next-line no-await-in-loop
                        await removeEntry(entryPath);
                    } else {
                        // eslint-disable-next-line no-await-in-loop
                        const size = await getDirectorySize(entryPath);

                        entryInfos.push({
                            mtimeMs: entryStat.mtimeMs,
                            name: entry,
                            path: entryPath,
                            size,
                        });
                    }
                } catch {
                    // Entry may have been removed already
                }
            }

            // Enforce max cache size by evicting oldest entries first
            if (this.#maxCacheSize !== undefined) {
                // Sort by modification time (oldest first)
                const sortedEntries = entryInfos.toSorted((a, b) => a.mtimeMs - b.mtimeMs);

                let totalSize = 0;

                for (const info of sortedEntries) {
                    totalSize += info.size;
                }

                // Evict oldest entries until under the limit
                for (const info of sortedEntries) {
                    if (totalSize <= this.#maxCacheSize) {
                        break;
                    }

                    // eslint-disable-next-line no-await-in-loop
                    await removeEntry(info.path);
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
    public async clear(): Promise<void> {
        try {
            await rm(this.#cacheDirectory, { force: true, recursive: true });
        } catch {
            // Cache directory may not exist
        }
    }

    /**
     * Archives task output files into the cache.
     */
    async #archiveOutputs(cacheEntryDirectory: string, outputs: string[]): Promise<void> {
        const outputsDirectory = join(cacheEntryDirectory, "outputs");

        await mkdir(outputsDirectory, { recursive: true });

        for (const output of outputs) {
            const absoluteOutput = resolve(this.#workspaceRoot, output);
            const cachedOutput = join(outputsDirectory, output);

            try {
                // eslint-disable-next-line no-await-in-loop
                await stat(absoluteOutput);

                const cachedOutputParent = join(cachedOutput, "..");

                // eslint-disable-next-line no-await-in-loop
                await mkdir(cachedOutputParent, { recursive: true });

                // eslint-disable-next-line no-await-in-loop
                await cp(absoluteOutput, cachedOutput, { recursive: true });
            } catch {
                // Output file doesn't exist, skip it
            }
        }
    }
}

export type { CachedResult, CacheOptions };
export { Cache, formatCacheSize, parseCacheSize };
