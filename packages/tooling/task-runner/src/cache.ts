import { createWriteStream } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

import { formatBytes, parseBytes } from "@visulima/humanizer";
import { dirname, join, resolve } from "@visulima/path";

import type { ExtractOptions } from "./archive";
import { createTarBrotli, extractTarBrotli } from "./archive";
import type { ActionResult, BlobSource, CasDigest } from "./backends/types";
import { readActionEntry, readTaskHashIndex, writeActionEntry, writeTaskHashIndex } from "./cas/action-cache";
import { V2_ROOT } from "./cas/paths";
import { containsBlob, fetchBlobToFile, putBlobFromFile } from "./cas/store";
import type { TaskFingerprint } from "./fingerprint";
import { resolveOutputs } from "./output-resolver";
import type { OutputSpec } from "./types";
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

    /**
     * Optional isolation namespace appended to the cache directory
     * as `&lt;cacheDir>/ns/&lt;namespace>`. When the caller derives the
     * namespace from the resolved global-env fingerprint, flipping an
     * env var sends writes into a new namespace while keeping the old
     * namespace intact — rolling the env back restores the old hits.
     *
     * Filesystem-safe segment; callers are responsible for sanitising
     * (slashes/colons would break path resolution).
     */
    cacheNamespace?: string;
    /** Maximum age of cache entries in milliseconds (default: 7 days) */
    maxCacheAge?: number;
    /** Maximum cache size (e.g., "500MB", "1GB") */
    maxCacheSize?: string;
    /** The workspace root directory */
    workspaceRoot: string;
}

const DEFAULT_MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Directory name (relative to `workspaceRoot`) where the task runner writes
 * its cache by default. Exported so callers that manage the cache from the
 * outside — e.g. a CLI `cache clean` command — can reach the same default
 * without hard-coding the literal.
 */
const DEFAULT_CACHE_DIRECTORY_NAME = ".task-runner-cache";

/**
 * Validates that a `cacheNamespace` segment can't escape the cache
 * subtree. Rejects path separators (`/`, `\`), the `..` parent-traversal
 * token as a whole component, and null bytes. `join()` alone isn't
 * enough — a namespace of `"../../etc"` would happily resolve above
 * the cache root.
 *
 * Throws on rejection so misconfiguration surfaces loudly instead of
 * silently writing to the wrong directory.
 */
const assertSafeNamespace = (namespace: string): void => {
    if (namespace.includes("\0")) {
        throw new Error("cacheNamespace: null bytes are not allowed.");
    }

    if (namespace.includes("/") || namespace.includes("\\")) {
        throw new Error(`cacheNamespace: path separators are not allowed (received ${JSON.stringify(namespace)}).`);
    }

    if (namespace === "." || namespace === "..") {
        throw new Error(`cacheNamespace: "${namespace}" would escape the cache subtree.`);
    }
};

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
        throw new TypeError(`Invalid cache size format: "${sizeString}". Expected format like "500MB" or "1GB".`);
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

        const baseDirectory = options.cacheDirectory ?? join(options.workspaceRoot, DEFAULT_CACHE_DIRECTORY_NAME);

        // Namespacing lets callers partition the cache by an external
        // fingerprint (e.g. globalEnv hash) without disturbing the task
        // hash format. Reject path separators + null bytes: a stray
        // `..` or slash in the namespace would escape the cache subtree
        // and either leak state across callers or let a remote value
        // poison paths outside the cache directory.
        if (options.cacheNamespace !== undefined && options.cacheNamespace.length > 0) {
            assertSafeNamespace(options.cacheNamespace);
        }

        this.#cacheDirectory = options.cacheNamespace && options.cacheNamespace.length > 0 ? join(baseDirectory, "ns", options.cacheNamespace) : baseDirectory;
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
     * Root for v2 CAS-shaped reads/writes. Backend implementations
     * (HTTP today, REAPI gRPC next) take this path so they can
     * hydrate fetched blobs into the same CAS the local cache reads
     * from. Equal to {@link cacheDirectory} — `v2/` lives under that.
     */
    public get casRoot(): string {
        return this.#cacheDirectory;
    }

    /**
     * Read a v2 {@link ActionResult} by action digest. Resolves to
     * `null` on miss. The orchestrator is expected to follow up with
     * {@link materializeOutputs} to place the referenced blobs into
     * the workspace.
     */
    public async getActionResult(actionDigest: CasDigest): Promise<ActionResult | null> {
        return readActionEntry(this.#cacheDirectory, actionDigest.hash);
    }

    /**
     * Look up an action digest by the legacy task hash. Returns
     * `null` when the bridge file isn't present — caller falls
     * through to the legacy `&lt;hash>/` layout (or executes the task).
     */
    public async resolveActionDigestForTaskHash(taskHash: string): Promise<string | null> {
        return readTaskHashIndex(this.#cacheDirectory, taskHash);
    }

    /**
     * Persist a v2 entry: writes the AC JSON, copies referenced
     * blobs into the CAS via the lazy {@link BlobSource} handles,
     * and binds the task hash → action digest redirect last so a
     * partial failure can't surface a half-written entry.
     */
    public async putActionResult(
        taskHash: string,
        actionDigest: CasDigest,
        result: ActionResult,
        blobs: ReadonlyArray<BlobSource>,
    ): Promise<void> {
        await this.#ensureBlobs(blobs);
        await writeActionEntry(this.#cacheDirectory, actionDigest.hash, result);
        await writeTaskHashIndex(this.#cacheDirectory, taskHash, actionDigest.hash);
    }

    /**
     * Materialize an action's outputs into the workspace. Streams
     * each referenced blob from the local CAS to its workspace path.
     * Returns `false` when any blob is missing — caller treats that
     * as a cache miss and re-executes.
     */
    public async materializeOutputs(result: ActionResult, workspaceRoot: string): Promise<boolean> {
        for (const file of result.outputFiles) {
            const destination = resolve(workspaceRoot, file.path);
            // eslint-disable-next-line no-await-in-loop -- streaming each blob serially keeps fd usage flat
            const ok = await fetchBlobToFile(this.#cacheDirectory, file.digest, destination);

            if (!ok) {
                return false;
            }
        }

        return true;
    }

    /**
     * Sequentially materializes each {@link BlobSource} into the local
     * CAS. Serial on purpose: a single Action typically references a
     * handful of blobs, and parallelizing would multiply RSS by the
     * largest payload's size while gaining nothing on disk-bound IO.
     * The small per-blob loop also keeps tmp-file naming and rename
     * pressure predictable instead of fanning out a burst of writers.
     */
    async #ensureBlobs(blobs: ReadonlyArray<BlobSource>): Promise<void> {
        for (const blob of blobs) {
            // eslint-disable-next-line no-await-in-loop -- existence probe gates the rest of the loop body; running it ahead of the put would force us to buffer the open() stream
            const present = await containsBlob(this.#cacheDirectory, blob.digest);

            if (present) {
                continue;
            }

            // Stream the blob into a tmp file under the CAS root so
            // putBlobFromFile can rename it into place atomically.
            const tmpPath = join(this.#cacheDirectory, V2_ROOT, "tmp", `.put-${uniqueId()}`);

            // eslint-disable-next-line no-await-in-loop -- serial mkdir matches the serial blob walk
            await mkdir(dirname(tmpPath), { recursive: true });

            // eslint-disable-next-line no-await-in-loop -- open() may fetch from the wire; serial avoids parallel network spikes
            const source = await blob.open();

            // eslint-disable-next-line no-await-in-loop -- pipeline backpressure dictates the natural order
            await pipeline(source, createWriteStream(tmpPath));

            // eslint-disable-next-line no-await-in-loop -- rename happens before the next blob's open() to keep tmp pressure low
            await putBlobFromFile(this.#cacheDirectory, blob.digest, tmpPath);

            // eslint-disable-next-line no-await-in-loop -- best-effort tmp cleanup completes before the next iteration so failed rename never leaves a visible orphan for the next put
            await rm(tmpPath, { force: true }).catch(() => {});
        }
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
     *
     * `outputs` accepts the richer `OutputSpec[]` shape — glob
     * patterns, negative globs, and `{ auto: true }` entries. Pass
     * `autoWrites` alongside `{ auto: true }` so the resolver knows
     * which files the task actually wrote; otherwise auto entries
     * contribute nothing.
     */
    public async put(
        hash: string,
        terminalOutput: string,
        outputs: OutputSpec[],
        code: number,
        fingerprint?: TaskFingerprint,
        autoWrites?: ReadonlyArray<string>,
    ): Promise<void> {
        const cacheEntryDirectory = join(this.#cacheDirectory, hash);
        const temporaryDirectory = join(this.#cacheDirectory, `.tmp-${hash}-${uniqueId()}`);

        try {
            await mkdir(temporaryDirectory, { recursive: true });

            // Write data files in parallel, then .commit marker last
            const writes: Promise<void>[] = [
                writeFile(join(temporaryDirectory, "code"), String(code)),
                writeFile(join(temporaryDirectory, "terminalOutput"), terminalOutput),
                this.#archiveOutputs(temporaryDirectory, outputs, autoWrites),
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
     * Restores cached outputs from the compressed `outputs.tar.br`
     * archive. Returns `true` either when the archive was extracted
     * successfully OR when the entry simply has no outputs to restore.
     *
     * The restore flow stages into a temp directory, then swaps each
     * top-level entry into place (see {@link restoreOutputsCompressed})
     * so a mid-restore failure never destroys the user's working tree.
     * The `outputs` parameter is no longer consulted at restore time —
     * the archive is authoritative, and top-level entries in the
     * extracted staging become the set of swap roots. Still accepted
     * for backward compat.
     */
    public async restoreOutputs(hash: string, _outputs?: OutputSpec[], options?: ExtractOptions): Promise<boolean> {
        const cacheEntryDirectory = join(this.#cacheDirectory, hash);

        return restoreOutputsCompressed(cacheEntryDirectory, this.#workspaceRoot, options);
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
     * Archives task output files into the cache as a single
     * brotli-compressed tarball (`outputs.tar.br`). See
     * {@link archiveOutputsCompressed} for the staging + compression
     * flow.
     */
    async #archiveOutputs(cacheEntryDirectory: string, outputs: OutputSpec[], autoWrites?: ReadonlyArray<string>): Promise<void> {
        await archiveOutputsCompressed(this.#workspaceRoot, cacheEntryDirectory, outputs, autoWrites);
    }
}

const OUTPUTS_ARCHIVE_FILENAME = "outputs.tar.br";

/**
 * Resolves `outputs` through `resolveOutputs()` — expanding globs,
 * filtering negatives, materialising `{ auto: true }` — then stages
 * each concrete file under `stagingDirectory` preserving its
 * workspace-relative path, and writes
 * `cacheEntryDirectory/outputs.tar.br`. Staging is cleaned up on exit.
 *
 * `resolveOutputs` already skips missing files, so the per-file `cp`
 * failure catch only covers the narrow race where a path vanishes
 * between resolve and stage (tasks cleaning up temp files during
 * teardown).
 */
const archiveOutputsCompressed = async (
    workspaceRoot: string,
    cacheEntryDirectory: string,
    outputs: OutputSpec[],
    autoWrites?: ReadonlyArray<string>,
): Promise<void> => {
    if (outputs.length === 0) {
        return;
    }

    const resolvedPaths = await resolveOutputs(workspaceRoot, outputs, autoWrites);

    if (resolvedPaths.length === 0) {
        return;
    }

    const stagingDirectory = join(cacheEntryDirectory, `.outputs-stage-${uniqueId()}`);
    const finalPath = join(cacheEntryDirectory, OUTPUTS_ARCHIVE_FILENAME);

    try {
        await mkdir(stagingDirectory, { recursive: true });

        // Parallel stage with a bounded pool — tasks can emit
        // thousands of files and per-file sequential cp dominates
        // archive time. FD exhaustion risk is capped at the pool
        // size; paths are unique (deduped upstream) so there's no
        // ordering constraint between copies.
        const stagedFlags = await runBounded(STAGE_CONCURRENCY, resolvedPaths, async (relativePath): Promise<boolean> => {
            const absoluteOutput = resolve(workspaceRoot, relativePath);
            const stagedOutput = join(stagingDirectory, relativePath);

            try {
                await mkdir(dirname(stagedOutput), { recursive: true });
                // preserveTimestamps so collectEntries below captures
                // the original file mtime, not the cp time. Without
                // this the tar header records "now" and a later
                // restore would faithfully replay an mtime stamped at
                // archive time — defeating the whole point.
                await cp(absoluteOutput, stagedOutput, { preserveTimestamps: true, recursive: true });

                return true;
            } catch {
                // Path vanished between resolve and stage (rare).
                return false;
            }
        });

        const stagedCount = stagedFlags.filter(Boolean).length;

        if (stagedCount === 0) {
            return;
        }

        await createTarBrotli(stagingDirectory, finalPath);
    } finally {
        await rm(stagingDirectory, { force: true, recursive: true }).catch(() => {});
    }
};

/** Concurrency cap for per-file archive staging + restore swap. */
const STAGE_CONCURRENCY = 16;

/**
 * Runs `fn` across `items` with at most `limit` in flight. Results
 * come back in input order, matching `Promise.all` semantics.
 */
const runBounded = async <T, R>(limit: number, items: ReadonlyArray<T>, fn: (item: T, index: number) => Promise<R>): Promise<R[]> => {
    const results: R[] = Array.from({ length: items.length });
    let cursor = 0;

    const worker = async (): Promise<void> => {
        while (cursor < items.length) {
            const index = cursor;

            cursor += 1;
            // eslint-disable-next-line no-await-in-loop -- worker is the serialisation unit; parallelism comes from multiple workers.
            results[index] = await fn(items[index] as T, index);
        }
    };

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());

    await Promise.all(workers);

    return results;
};

/**
 * Restores outputs from the compressed `outputs.tar.br` archive.
 * Returns `true` when the restore succeeded OR when the entry has no
 * archive (which is valid for tasks that declare no outputs). Returns
 * `false` only on actual extraction/copy failure.
 *
 * Uses a backup-and-rollback flow so a mid-restore failure never
 * destroys the user's existing output tree:
 *  1. decompress + extract to a staging dir
 *  2. read the archive's top-level entries as the set of swap roots
 *     (e.g. `dist`, `build` — whatever the archive contains). This
 *     lets glob-expanded archives restore cleanly without callers
 *     having to re-resolve patterns against the post-task workspace.
 *  3. for each root, move the existing tree aside to
 *     `&lt;path>.pre-restore-&lt;uid>` (atomic rename) before copying the
 *     staged version into place.
 *  4. on any failure during step 3, undo every rename so the user
 *     ends up exactly where they started
 *  5. on success, rm the backups
 *
 * Note: swap roots come from the archive's top-level entries. If a
 * task's outputs were filtered via negative globs, those paths won't
 * appear in the archive and therefore won't be touched on restore —
 * matching the user's "exclude from cache, keep on disk" intent.
 */
const restoreOutputsCompressed = async (cacheEntryDirectory: string, workspaceRoot: string, options?: ExtractOptions): Promise<boolean> => {
    const archivePath = join(cacheEntryDirectory, OUTPUTS_ARCHIVE_FILENAME);

    try {
        await stat(archivePath);
    } catch {
        // No archive — entry has no saved outputs. That's a valid
        // state (task declared no outputs, or outputs were empty at
        // cache time). Treat as a successful no-op.
        return true;
    }

    const stagingDirectory = join(cacheEntryDirectory, `.restore-${uniqueId()}`);
    const backups: { backup: string; original: string }[] = [];
    // The extract above already applied the captured mtime to each
    // staged file via utimes(); without `preserveTimestamps` here, the
    // subsequent `cp` would silently re-stamp every restored file to
    // "now" and undo the work. Mode bits are always preserved by cp.
    const preserveMtime = options?.preserveMtime ?? true;

    try {
        await mkdir(stagingDirectory, { recursive: true });
        await extractTarBrotli(archivePath, stagingDirectory, options);

        // Derive swap roots from what's actually in the archive.
        // Avoids the caller having to re-resolve globs against the
        // post-task workspace, which may have moved on.
        //
        // readdir order is fs-dependent (ext4 returns inode order, APFS
        // by creation, NTFS alphabetic-ish); sort here so the swap loop
        // visits roots in the same order across machines and reruns.
        // Ordering only matters for failure-mode determinism — the
        // bounded parallel runBounded below interleaves writes either
        // way — but it makes diffs and bug reports reproducible.
        const topLevel = (await readdir(stagingDirectory)).sort();

        // Swap roots are disjoint subtrees by construction (archive
        // top-levels), so placement can run in parallel. Each task
        // locally backs up → cps; the shared `backups` array is only
        // pushed to, and we only read it on the error path after the
        // Promise.all settles, so there's no interleaving hazard.
        await runBounded(STAGE_CONCURRENCY, topLevel, async (entry) => {
            const absoluteOutput = resolve(workspaceRoot, entry);
            const stagedOutput = join(stagingDirectory, entry);

            await mkdir(dirname(absoluteOutput), { recursive: true });

            // Move the existing tree aside atomically before copying the
            // replacement into place. If anything fails below, the
            // rollback loop renames these backups back to their originals.
            try {
                await stat(absoluteOutput);

                const backup = `${absoluteOutput}.pre-restore-${uniqueId()}`;

                await rename(absoluteOutput, backup);
                backups.push({ backup, original: absoluteOutput });
            } catch {
                // No existing tree to back up — nothing to rollback later.
            }

            await cp(stagedOutput, absoluteOutput, { preserveTimestamps: preserveMtime, recursive: true });
        });

        // All outputs placed successfully — drop the backups in parallel.
        await Promise.all(backups.map(({ backup }) => rm(backup, { force: true, recursive: true }).catch(() => {})));

        return true;
    } catch {
        // Roll back every rename so the working tree matches its
        // pre-call state. Any new cp() that partially succeeded also
        // needs to go so the rename can land.
        //
        // Known limitation: rollback is best-effort. If `rm(original)`
        // fails — Windows file lock, EBUSY, or a permission change
        // mid-flight — the subsequent `rename` can't land and the user
        // ends up with neither the new tree nor the old. We swallow
        // the inner failure because surfacing it would mask the
        // original restore error that triggered the rollback, and
        // both failures already surface via the `return false`.
        for (const { backup, original } of backups) {
            // eslint-disable-next-line no-await-in-loop
            await rm(original, { force: true, recursive: true }).catch(() => {});
            // eslint-disable-next-line no-await-in-loop
            await rename(backup, original).catch(() => {});
        }

        return false;
    } finally {
        await rm(stagingDirectory, { force: true, recursive: true }).catch(() => {});
    }
};

export type { CachedResult, CacheOptions };
export { Cache, DEFAULT_CACHE_DIRECTORY_NAME, formatCacheSize, parseCacheSize };
