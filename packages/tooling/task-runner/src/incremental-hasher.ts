import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

// eslint-disable-next-line import/no-extraneous-dependencies -- bundled inline by packem from workspace devDependency
import { xxh3Hash } from "@shared/xxh3";
import { dirname, join, relative } from "@visulima/path";

import { collectFiles } from "./utils";

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
interface FileSnapshot {
    /** xxh3-128 hash of file contents */
    hash: string;
    /** Last modification time in milliseconds */
    mtimeMs: number;
    /** File size in bytes (fast pre-check) */
    size: number;
}

interface IncrementalHasherOptions {
    /** Directories to skip (default: node_modules, .git, dist, coverage, .cache) */
    ignoredDirs?: Set<string>;
    /** File to persist the snapshot to (for cross-run reuse) */
    snapshotPath?: string;
    workspaceRoot: string;
}

const DEFAULT_IGNORED_DIRS = new Set([".cache", ".git", ".task-runner-cache", "coverage", "dist", "node_modules"]);

class IncrementalFileHasher {
    readonly #workspaceRoot: string;

    readonly #ignoredDirs: Set<string>;

    readonly #snapshotPath: string | undefined;

    readonly #snapshot = new Map<string, FileSnapshot>();

    #loaded = false;

    public constructor(options: IncrementalHasherOptions) {
        this.#workspaceRoot = options.workspaceRoot;
        this.#ignoredDirs = options.ignoredDirs ?? DEFAULT_IGNORED_DIRS;
        this.#snapshotPath = options.snapshotPath ?? join(options.workspaceRoot, "node_modules", ".cache", "task-runner", "file-snapshot.json");
    }

    /**
     * Loads the snapshot from disk if available.
     * Called automatically on first use.
     */
    public async load(): Promise<void> {
        if (this.#loaded) {
            return;
        }

        this.#loaded = true;

        if (!this.#snapshotPath) {
            return;
        }

        try {
            const content = await readFile(this.#snapshotPath, "utf8");
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
    public async save(): Promise<void> {
        if (!this.#snapshotPath) {
            return;
        }

        const directory = dirname(this.#snapshotPath);

        await mkdir(directory, { recursive: true });

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
    public async hashDirectory(directoryPath: string): Promise<Record<string, string>> {
        await this.load();

        const result: Record<string, string> = {};
        const filePaths = await collectFiles(directoryPath, this.#ignoredDirs);

        // Process files in parallel batches for optimal throughput
        const BATCH_SIZE = 64;
        const batches: string[][] = [];

        for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
            batches.push(filePaths.slice(i, i + BATCH_SIZE));
        }

        for (const batch of batches) {
            // eslint-disable-next-line no-await-in-loop
            const batchResults = await Promise.all(
                batch.map(async (filePath) => {
                    const hash = await this.#hashFileIncremental(filePath);
                    const relativePath = relative(this.#workspaceRoot, filePath);

                    return { hash, relativePath };
                }),
            );

            for (const { hash, relativePath } of batchResults) {
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
    async #hashFileIncremental(filePath: string): Promise<string | undefined> {
        try {
            const fileStat = await stat(filePath);

            if (!fileStat.isFile()) {
                return undefined;
            }

            const cached = this.#snapshot.get(filePath);

            // Fast path: mtime and size match → reuse cached hash
            if (cached?.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
                return cached.hash;
            }

            // Slow path: re-read and re-hash the file
            const content = await readFile(filePath);
            const hash = xxh3Hash(content);

            this.#snapshot.set(filePath, {
                hash,
                mtimeMs: fileStat.mtimeMs,
                size: fileStat.size,
            });

            return hash;
        } catch {
            // File doesn't exist or can't be read — remove from snapshot
            this.#snapshot.delete(filePath);

            return undefined;
        }
    }

    /**
     * Returns how many files are in the snapshot (for diagnostics).
     */
    public get snapshotSize(): number {
        return this.#snapshot.size;
    }

    /**
     * Clears the in-memory snapshot.
     */
    public clear(): void {
        this.#snapshot.clear();
    }

    /**
     * Looks up the cached hash for `absolutePath` when its mtime and
     * size match the snapshot; returns `undefined` otherwise. Callers
     * that already have a `stat` result (e.g. `InProcessTaskHasher`)
     * skip an extra syscall by passing it through directly.
     *
     * The snapshot is considered loaded on first call — lazy-load is
     * synchronous-friendly here because the caller already performed
     * an async `stat` before calling this method.
     */
    public getSnapshotHash(absolutePath: string, mtimeMs: number, size: number): string | undefined {
        const entry = this.#snapshot.get(absolutePath);

        if (!entry) {
            return undefined;
        }

        return entry.mtimeMs === mtimeMs && entry.size === size ? entry.hash : undefined;
    }

    /**
     * Writes a fresh snapshot entry after the caller has computed the
     * hash. Pairs with {@link IncrementalFileHasher.getSnapshotHash}
     * — after a miss, the caller hashes the file and records the
     * result here so the next run can reuse it.
     */
    public recordSnapshot(absolutePath: string, hash: string, mtimeMs: number, size: number): void {
        this.#snapshot.set(absolutePath, { hash, mtimeMs, size });
    }
}

export type { FileSnapshot, IncrementalHasherOptions };
export { IncrementalFileHasher };
