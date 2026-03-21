import { createHash } from "node:crypto";
import { readFile, stat, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

/**
 * Incremental file hasher that only re-hashes files that have changed
 * since the last run, based on mtime comparison.
 *
 * This is the key performance optimization used by Nx's daemon and
 * Turborepo's daemon — on subsequent runs, only files whose mtime
 * changed need to be re-read and re-hashed.
 *
 * The snapshot (path → { mtime, hash }) is kept in memory and can
 * optionally be persisted to disk for cross-process reuse.
 */
export interface FileSnapshot {
    /** Last modification time in milliseconds */
    mtimeMs: number;
    /** SHA-256 hash of file contents */
    hash: string;
    /** File size in bytes (fast pre-check) */
    size: number;
}

export interface IncrementalHasherOptions {
    workspaceRoot: string;
    /** Directories to skip (default: node_modules, .git, dist, coverage, .cache) */
    ignoredDirs?: Set<string>;
    /** File to persist the snapshot to (for cross-run reuse) */
    snapshotPath?: string;
}

const DEFAULT_IGNORED_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    "coverage",
    ".cache",
    ".task-runner-cache",
]);

export class IncrementalFileHasher {
    readonly #workspaceRoot: string;
    readonly #ignoredDirs: Set<string>;
    readonly #snapshotPath: string | null;
    readonly #snapshot = new Map<string, FileSnapshot>();
    #loaded = false;

    constructor(options: IncrementalHasherOptions) {
        this.#workspaceRoot = options.workspaceRoot;
        this.#ignoredDirs = options.ignoredDirs ?? DEFAULT_IGNORED_DIRS;
        this.#snapshotPath = options.snapshotPath
            ?? join(options.workspaceRoot, "node_modules", ".cache", "task-runner", "file-snapshot.json");
    }

    /**
     * Loads the snapshot from disk if available.
     * Called automatically on first use.
     */
    async load(): Promise<void> {
        if (this.#loaded) {
            return;
        }

        this.#loaded = true;

        if (!this.#snapshotPath) {
            return;
        }

        try {
            const content = await readFile(this.#snapshotPath, "utf-8");
            const data = JSON.parse(content) as Record<string, FileSnapshot>;

            for (const [path, snap] of Object.entries(data)) {
                this.#snapshot.set(path, snap);
            }
        } catch {
            // No snapshot on disk — cold start, hash everything
        }
    }

    /**
     * Persists the current snapshot to disk for cross-run reuse.
     */
    async save(): Promise<void> {
        if (!this.#snapshotPath) {
            return;
        }

        const { mkdir, writeFile } = await import("node:fs/promises");

        const dir = join(this.#snapshotPath, "..");

        await mkdir(dir, { recursive: true });

        const data: Record<string, FileSnapshot> = {};

        for (const [path, snap] of this.#snapshot) {
            data[path] = snap;
        }

        await writeFile(this.#snapshotPath, JSON.stringify(data));
    }

    /**
     * Incrementally hashes all files in a directory.
     *
     * Only files whose mtime or size changed since the last snapshot
     * are re-read and re-hashed. Unchanged files reuse the cached hash.
     *
     * Returns a map of relative paths → hashes.
     */
    async hashDirectory(dirPath: string): Promise<Record<string, string>> {
        await this.load();

        const result: Record<string, string> = {};
        const filePaths = await this.#collectFiles(dirPath);

        // Process files in parallel batches for optimal throughput
        const BATCH_SIZE = 64;

        for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
            const batch = filePaths.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(
                batch.map(async (filePath) => {
                    const hash = await this.#hashFileIncremental(filePath);
                    const relativePath = relative(this.#workspaceRoot, filePath);

                    return { relativePath, hash };
                }),
            );

            for (const { relativePath, hash } of batchResults) {
                if (hash) {
                    result[relativePath] = hash;
                }
            }
        }

        return result;
    }

    /**
     * Hashes a single file incrementally.
     * Returns the cached hash if mtime + size haven't changed.
     */
    async #hashFileIncremental(filePath: string): Promise<string | null> {
        try {
            const fileStat = await stat(filePath);

            if (!fileStat.isFile()) {
                return null;
            }

            const cached = this.#snapshot.get(filePath);

            // Fast path: mtime and size match → reuse cached hash
            if (
                cached &&
                cached.mtimeMs === fileStat.mtimeMs &&
                cached.size === fileStat.size
            ) {
                return cached.hash;
            }

            // Slow path: re-read and re-hash the file
            const content = await readFile(filePath);
            const hash = createHash("sha256").update(content).digest("hex");

            this.#snapshot.set(filePath, {
                mtimeMs: fileStat.mtimeMs,
                hash,
                size: fileStat.size,
            });

            return hash;
        } catch {
            // File doesn't exist or can't be read — remove from snapshot
            this.#snapshot.delete(filePath);

            return null;
        }
    }

    /**
     * Recursively collects all file paths in a directory.
     */
    async #collectFiles(dirPath: string): Promise<string[]> {
        const results: string[] = [];

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            const promises = entries.map(async (entry) => {
                if (this.#ignoredDirs.has(entry.name)) {
                    return [];
                }

                const fullPath = join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    return this.#collectFiles(fullPath);
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
                            return this.#collectFiles(fullPath);
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
            // Directory doesn't exist
        }

        return results;
    }

    /**
     * Returns how many files are in the snapshot (for diagnostics).
     */
    get snapshotSize(): number {
        return this.#snapshot.size;
    }

    /**
     * Clears the in-memory snapshot.
     */
    clear(): void {
        this.#snapshot.clear();
    }
}
