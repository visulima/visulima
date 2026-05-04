import { mkdtemp, readdir, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";

import type { Toolbox } from "@visulima/cerebro";
import { isAccessibleSync } from "@visulima/fs";
import { formatBytes } from "@visulima/humanizer";
import { join, relative } from "@visulima/path";
import { Cache, digestFile, getLastRunSummaryPath, parseCacheSize, readLastRunSummary } from "@visulima/task-runner";

import { clearCache as clearAiResponseCache, getCacheStats as getAiCacheStats } from "../../ai/ai-cache";
import { isCacheDirectoryInsideWorkspace, resolveSharedCacheDirectory } from "../../cache/cache-directory";
import { pail } from "../../io/logger";
import { diffHashDetails, findTaskInSummary, readPreviousRunSummary, readRunSummaryById } from "../../report/run-summary-utils";
import { clearSocketCache, getSocketCacheStats } from "../../security/socket-security";
import type { CacheCleanOptions, CacheHashOptions, CacheListOptions, CachePruneOptions, CacheSizeOptions, CacheVerifyOptions, CacheWhyOptions } from "./index";

/**
 * Shape returned by `collectCacheEntries`. Kept close to what `removeOldEntries`
 * uses internally so we can render the list identically.
 */
interface CacheEntry {
    hash: string;
    mtimeMs: number;
    path: string;
    sizeBytes: number;
}

const sumDirectorySize = async (directory: string): Promise<number> => {
    let total = 0;

    try {
        const entries = await readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
            const full = join(directory, entry.name);

            if (entry.isDirectory()) {
                total += await sumDirectorySize(full);
            } else if (entry.isFile()) {
                const s = await stat(full);

                total += s.size;
            }
        }
    } catch {
        // Ignore — permissions, concurrent deletes, etc.
    }

    return total;
};

export const collectCacheEntries = async (cacheDirectory: string): Promise<CacheEntry[]> => {
    const entries: CacheEntry[] = [];

    let dirents: string[];

    try {
        dirents = await readdir(cacheDirectory);
    } catch {
        return [];
    }

    for (const name of dirents) {
        if (name.startsWith(".")) {
            continue;
        }

        const fullPath = join(cacheDirectory, name);

        try {
            const s = await stat(fullPath);

            if (!s.isDirectory()) {
                continue;
            }

            const sizeBytes = await sumDirectorySize(fullPath);

            entries.push({
                hash: name,
                mtimeMs: s.mtimeMs,
                path: fullPath,
                sizeBytes,
            });
        } catch {
            // Ignore — entry may have been removed concurrently.
        }
    }

    entries.sort((a, b) => b.mtimeMs - a.mtimeMs);

    return entries;
};

export const formatAge = (mtimeMs: number, now: number = Date.now()): string => {
    // Clamp future timestamps to 0 — clock skew or networked filesystems
    // can produce mtimes ahead of `now`, and "-NNs" in the table is noise.
    const seconds = Math.max(0, Math.floor((now - mtimeMs) / 1000));

    if (seconds < 60) {
        return `${String(seconds)}s`;
    }

    if (seconds < 3600) {
        return `${String(Math.floor(seconds / 60))}m`;
    }

    if (seconds < 86_400) {
        return `${String(Math.floor(seconds / 3600))}h`;
    }

    return `${String(Math.floor(seconds / 86_400))}d`;
};

const confirmPrompt = (question: string): Promise<boolean> =>
    new Promise((resolvePromise) => {
        const rl = createInterface({ input: process.stdin, output: process.stderr });

        rl.question(`${question} (y/N) `, (answer) => {
            rl.close();
            const trimmed = answer.trim().toLowerCase();

            resolvePromise(trimmed === "y" || trimmed === "yes");
        });
    });

export const runList = async (cacheDirectory: string, format: string, logger: Console): Promise<void> => {
    if (!isAccessibleSync(cacheDirectory)) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ directory: cacheDirectory, entries: [], totalBytes: 0, totalCount: 0 }, undefined, 2)}\n`);

            return;
        }

        pail.info(`No cache directory found at ${cacheDirectory}`);

        return;
    }

    const entries = await collectCacheEntries(cacheDirectory);

    if (entries.length === 0) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ directory: cacheDirectory, entries: [], totalBytes: 0, totalCount: 0 }, undefined, 2)}\n`);

            return;
        }

        pail.info(`Cache directory is empty: ${cacheDirectory}`);

        return;
    }

    const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);

    if (format === "json") {
        const now = Date.now();

        process.stdout.write(
            `${JSON.stringify(
                {
                    directory: cacheDirectory,
                    entries: entries.map((entry) => {
                        return {
                            ageMs: now - entry.mtimeMs,
                            hash: entry.hash,
                            mtimeIso: new Date(entry.mtimeMs).toISOString(),
                            sizeBytes: entry.sizeBytes,
                        };
                    }),
                    totalBytes,
                    totalCount: entries.length,
                },
                undefined,
                2,
            )}\n`,
        );

        return;
    }

    pail.info(`Cache directory: ${cacheDirectory}`);
    pail.info(`Entries: ${String(entries.length)} (${formatBytes(totalBytes, { decimals: 1, space: false })})`);
    logger.info("");

    const renderedAt = Date.now();
    const rows = entries.map((entry) => {
        return {
            age: formatAge(entry.mtimeMs, renderedAt),
            hash: entry.hash.slice(0, 12),
            size: formatBytes(entry.sizeBytes, { decimals: 1, space: false }),
        };
    });

    const hashWidth = Math.max(4, ...rows.map((r) => r.hash.length));
    const sizeWidth = Math.max(4, ...rows.map((r) => r.size.length));
    const ageWidth = Math.max(3, ...rows.map((r) => r.age.length));

    logger.info(`  ${"hash".padEnd(hashWidth)}  ${"size".padEnd(sizeWidth)}  ${"age".padEnd(ageWidth)}`);
    logger.info(`  ${"-".repeat(hashWidth)}  ${"-".repeat(sizeWidth)}  ${"-".repeat(ageWidth)}`);

    for (const row of rows) {
        logger.info(`  ${row.hash.padEnd(hashWidth)}  ${row.size.padEnd(sizeWidth)}  ${row.age.padEnd(ageWidth)}`);
    }
};

// Keep each clear independent — a failure in one store (e.g. EPERM on a
// stale lockfile) shouldn't prevent the others from being cleared, and
// neither should bubble up and abort `vis cache clean`.
export const clearAiCacheSafe = (): void => {
    try {
        const aiDeleted = clearAiResponseCache();

        if (aiDeleted > 0) {
            pail.info(`Cleared ${String(aiDeleted)} cached AI response${aiDeleted === 1 ? "" : "s"}.`);
        }
    } catch (error: unknown) {
        pail.warn(`Failed to clear AI response cache: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const clearSocketCacheSafe = (): void => {
    try {
        const socketDeleted = clearSocketCache();

        if (socketDeleted > 0) {
            pail.info(`Cleared ${String(socketDeleted)} cached Socket.dev report${socketDeleted === 1 ? "" : "s"}.`);
        }
    } catch (error: unknown) {
        pail.warn(`Failed to clear Socket.dev cache: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const runClean = async (cacheDirectory: string, workspaceRoot: string, options: { dryRun: boolean; force: boolean }): Promise<void> => {
    if (!isAccessibleSync(cacheDirectory)) {
        pail.info(`No cache directory to clean at ${cacheDirectory}`);

        return;
    }

    if (options.dryRun) {
        const entries = await collectCacheEntries(cacheDirectory);
        const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);

        pail.info(
            `Would remove ${String(entries.length)} cache entr${entries.length === 1 ? "y" : "ies"} `
            + `(${formatBytes(totalBytes, { decimals: 1, space: false })}) from ${cacheDirectory}`,
        );

        return;
    }

    const insideWorkspace = isCacheDirectoryInsideWorkspace(cacheDirectory, workspaceRoot);

    try {
        const realCache = await realpath(cacheDirectory);
        const realWorkspace = await realpath(workspaceRoot);

        if (realCache === realWorkspace) {
            pail.error("Refusing to delete the workspace root. The cache directory resolved to the same path as the workspace.");
            process.exitCode = 1;

            return;
        }
    } catch {
        // Path may not exist on disk; deletion branches handle missing paths safely.
    }

    if (!insideWorkspace && !options.force) {
        pail.warn(`Cache directory is outside the workspace root: ${cacheDirectory}`);
        pail.warn("This will recursively delete the entire directory, including anything stored there by other tools.");

        if (!process.stdin.isTTY) {
            pail.error("Refusing to clean an out-of-workspace cache without --force (stdin is not a TTY).");
            process.exitCode = 1;

            return;
        }

        const confirmed = await confirmPrompt("  Continue?");

        if (!confirmed) {
            pail.info("Aborted.");

            return;
        }
    }

    if (insideWorkspace) {
        const cache = new Cache({ cacheDirectory, workspaceRoot });

        await cache.clear();
    } else {
        await rm(cacheDirectory, { force: true, recursive: true });
    }

    pail.success(`Cleared cache: ${cacheDirectory}`);
};

export const runPrune = async (
    cacheDirectory: string,
    workspaceRoot: string,
    options: { keepLast?: number; maxCacheAgeDays?: number; maxCacheSize?: string },
): Promise<void> => {
    if (!isAccessibleSync(cacheDirectory)) {
        pail.info(`No cache directory to prune at ${cacheDirectory}`);

        return;
    }

    if (options.maxCacheAgeDays !== undefined && (!Number.isFinite(options.maxCacheAgeDays) || options.maxCacheAgeDays < 0)) {
        pail.error(`Invalid --max-age-days value: expected a finite number >= 0, got ${String(options.maxCacheAgeDays)}`);
        process.exitCode = 1;

        return;
    }

    if (options.keepLast !== undefined && (!Number.isFinite(options.keepLast) || options.keepLast < 0 || !Number.isInteger(options.keepLast))) {
        pail.error(`Invalid --keep-last value: expected a non-negative integer, got ${String(options.keepLast)}`);
        process.exitCode = 1;

        return;
    }

    if (options.maxCacheSize !== undefined) {
        let parsedBytes: number;

        try {
            parsedBytes = parseCacheSize(options.maxCacheSize);
        } catch (error: unknown) {
            pail.error(`Invalid --max-size value: ${error instanceof Error ? error.message : String(error)}`);
            process.exitCode = 1;

            return;
        }

        if (!Number.isFinite(parsedBytes) || parsedBytes <= 0) {
            pail.error(`Invalid --max-size value: expected a positive size, got "${options.maxCacheSize}" (${String(parsedBytes)} bytes)`);
            process.exitCode = 1;

            return;
        }
    }

    const maxCacheAge = options.maxCacheAgeDays === undefined ? undefined : options.maxCacheAgeDays * 24 * 60 * 60 * 1000;

    const before = await collectCacheEntries(cacheDirectory);
    const beforeBytes = before.reduce((sum, entry) => sum + entry.sizeBytes, 0);

    // --keep-last runs first: trim by recency before letting the
    // task-runner Cache enforce age/size limits. This way `--keep-last 30`
    // is an absolute floor — we never end up over 30 even if the surviving
    // entries are also young or small.
    if (options.keepLast !== undefined && before.length > options.keepLast) {
        const stale = before.slice(options.keepLast);

        await Promise.all(stale.map((entry) => rm(entry.path, { force: true, recursive: true })));
    }

    const cache = new Cache({
        cacheDirectory,
        maxCacheAge,
        maxCacheSize: options.maxCacheSize,
        workspaceRoot,
    });

    await cache.removeOldEntries();

    const after = await collectCacheEntries(cacheDirectory);
    const afterBytes = after.reduce((sum, entry) => sum + entry.sizeBytes, 0);

    const removed = before.length - after.length;
    const reclaimedBytes = beforeBytes - afterBytes;

    if (removed <= 0) {
        pail.info("Nothing to prune — all entries are within the configured limits.");

        return;
    }

    pail.success(`Pruned ${String(removed)} entr${removed === 1 ? "y" : "ies"}, ` + `freed ${formatBytes(reclaimedBytes, { decimals: 1, space: false })}.`);
};

/**
 * Hashes are long opaque blobs; show enough prefix to be diff-grep-able
 * but not so much that columns wrap. The trailing `…` is load-bearing —
 * without it the user can't tell whether two truncated values are
 * equal or just share a prefix.
 */
const HASH_DISPLAY_PREFIX = 16;

const truncateHash = (value: string): string => (value.length > HASH_DISPLAY_PREFIX ? `${value.slice(0, HASH_DISPLAY_PREFIX)}…` : value);

const renderHashDetailsBucket = (label: string, bucket: Record<string, string> | undefined, logger: Console): void => {
    const entries = Object.entries(bucket ?? {});

    if (entries.length === 0) {
        return;
    }

    logger.info(`  ${label}:`);
    entries.sort(([a], [b]) => a.localeCompare(b));

    for (const [key, value] of entries) {
        logger.info(`    ${key.padEnd(40)}  ${truncateHash(value)}`);
    }
};

interface RunWhyOptions {
    format: string;
    runId: string | undefined;
    workspaceRoot: string;
}

export const runWhy = async (taskId: string, options: RunWhyOptions, logger: Console): Promise<void> => {
    const { format, runId, workspaceRoot } = options;

    const summary = runId === undefined ? await readLastRunSummary(workspaceRoot) : await readRunSummaryById(workspaceRoot, runId);

    if (!summary) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ error: "no-summary", runId: runId ?? null, taskId }, undefined, 2)}\n`);
            process.exitCode = 1;

            return;
        }

        if (runId === undefined) {
            pail.error("No previous run summary found. Run a task first to populate `.task-runner/last-summary.json`.");
        } else {
            pail.error(`Run summary "${runId}" not found in .task-runner/runs/.`);
        }

        process.exitCode = 1;

        return;
    }

    const task = findTaskInSummary(summary, taskId);

    if (!task) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ error: "task-not-in-summary", runId: summary.id, taskId }, undefined, 2)}\n`);
            process.exitCode = 1;

            return;
        }

        pail.error(`Task "${taskId}" was not part of run ${summary.id}.`);
        pail.info(`Tasks in this run: ${summary.tasks.map((t) => t.taskId).join(", ") || "(none)"}`);
        process.exitCode = 1;

        return;
    }

    const previousSummary = await readPreviousRunSummary(workspaceRoot, summary.id);
    const previousTask = previousSummary ? findTaskInSummary(previousSummary, taskId) : undefined;
    const diff = diffHashDetails(task.hashDetails, previousTask?.hashDetails);

    if (format === "json") {
        process.stdout.write(
            `${JSON.stringify(
                {
                    diff,
                    previousRunId: previousSummary?.id ?? null,
                    previousTask: previousTask
                        ? {
                            cacheStatus: previousTask.cacheStatus,
                            hash: previousTask.hash ?? null,
                            hashDetails: previousTask.hashDetails ?? null,
                        }
                        : null,
                    runId: summary.id,
                    task: {
                        cacheStatus: task.cacheStatus,
                        hash: task.hash ?? null,
                        hashDetails: task.hashDetails ?? null,
                        taskId: task.taskId,
                    },
                },
                undefined,
                2,
            )}\n`,
        );

        return;
    }

    pail.info(`Why ${taskId}? (run ${summary.id})`);
    logger.info("");
    logger.info(`  status:  ${task.cacheStatus}`);
    logger.info(`  hash:    ${task.hash ?? "(none)"}`);

    if (previousTask) {
        logger.info(`  prev:    ${previousTask.hash ?? "(none)"}  [run ${previousSummary?.id ?? "?"}]`);
    } else {
        logger.info(`  prev:    (no prior run found)`);
    }

    logger.info("");

    if (!previousTask) {
        pail.info("No previous run to diff against — first time this task was recorded.");

        return;
    }

    const noChanges
        = !diff.commandChanged
            && diff.nodes.added.length === 0
            && diff.nodes.changed.length === 0
            && diff.nodes.removed.length === 0
            && diff.runtime.added.length === 0
            && diff.runtime.changed.length === 0
            && diff.runtime.removed.length === 0
            && diff.implicitDeps.added.length === 0
            && diff.implicitDeps.changed.length === 0
            && diff.implicitDeps.removed.length === 0;

    if (noChanges) {
        pail.success("No hash inputs changed since the previous run.");

        return;
    }

    logger.info("Hash inputs that changed since the previous run:");
    logger.info("");

    if (diff.commandChanged) {
        logger.info("  command:  changed");
    }

    for (const bucket of ["nodes", "runtime", "implicitDeps"] as const) {
        const bucketDiff = diff[bucket];

        if (bucketDiff.added.length === 0 && bucketDiff.changed.length === 0 && bucketDiff.removed.length === 0) {
            continue;
        }

        logger.info(`  ${bucket}:`);

        for (const key of bucketDiff.added) {
            logger.info(`    + ${key}`);
        }

        for (const key of bucketDiff.changed) {
            logger.info(`    ~ ${key}`);
        }

        for (const key of bucketDiff.removed) {
            logger.info(`    - ${key}`);
        }
    }

    logger.info("");
    pail.info(`Last summary file: ${getLastRunSummaryPath(workspaceRoot)}`);
};

interface RunHashOptions {
    format: string;
    runId: string | undefined;
    workspaceRoot: string;
}

export const runHash = async (taskId: string, options: RunHashOptions, logger: Console): Promise<void> => {
    const { format, runId, workspaceRoot } = options;

    const summary = runId === undefined ? await readLastRunSummary(workspaceRoot) : await readRunSummaryById(workspaceRoot, runId);

    if (!summary) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ error: "no-summary", runId: runId ?? null, taskId }, undefined, 2)}\n`);
            process.exitCode = 1;

            return;
        }

        if (runId === undefined) {
            pail.error("No previous run summary found. Run a task first to populate `.task-runner/last-summary.json`.");
        } else {
            pail.error(`Run summary "${runId}" not found in .task-runner/runs/.`);
        }

        process.exitCode = 1;

        return;
    }

    const task = findTaskInSummary(summary, taskId);

    if (!task) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ error: "task-not-in-summary", runId: summary.id, taskId }, undefined, 2)}\n`);
            process.exitCode = 1;

            return;
        }

        pail.error(`Task "${taskId}" was not part of run ${summary.id}.`);
        process.exitCode = 1;

        return;
    }

    if (format === "json") {
        process.stdout.write(
            `${JSON.stringify(
                {
                    cacheStatus: task.cacheStatus,
                    hash: task.hash ?? null,
                    hashDetails: task.hashDetails ?? null,
                    runId: summary.id,
                    taskId: task.taskId,
                },
                undefined,
                2,
            )}\n`,
        );

        return;
    }

    pail.info(`Hash for ${taskId} (run ${summary.id})`);
    logger.info("");
    logger.info(`  status:  ${task.cacheStatus}`);
    logger.info(`  hash:    ${task.hash ?? "(none)"}`);

    if (task.hashDetails) {
        logger.info("");
        logger.info(`  command: ${truncateHash(task.hashDetails.command)}`);
        renderHashDetailsBucket("nodes", task.hashDetails.nodes, logger);
        renderHashDetailsBucket("runtime", task.hashDetails.runtime, logger);
        renderHashDetailsBucket("implicitDeps", task.hashDetails.implicitDeps, logger);
    } else {
        logger.info("");
        pail.info("No hash details recorded for this task.");
    }
};

export const runSize = async (cacheDirectory: string, format: string): Promise<void> => {
    if (!isAccessibleSync(cacheDirectory)) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ directory: cacheDirectory, exists: false, totalBytes: 0, totalCount: 0 })}\n`);

            return;
        }

        pail.info(`No cache directory at ${cacheDirectory}`);

        return;
    }

    const entries = await collectCacheEntries(cacheDirectory);
    const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);

    if (format === "json") {
        process.stdout.write(
            `${JSON.stringify({
                directory: cacheDirectory,
                exists: true,
                totalBytes,
                totalCount: entries.length,
            })}\n`,
        );

        return;
    }

    pail.info(`Cache directory: ${cacheDirectory}`);
    pail.info(`Entries:         ${String(entries.length)}`);
    pail.info(`Total size:      ${formatBytes(totalBytes, { decimals: 1, space: false })}`);
};

interface RunVerifyOptions {
    /**
     * Ordered list of cache directories to consult. The first one
     * containing the requested task entry is used; the rest are
     * ignored. Use a single-element array for the common case.
     */
    cacheDirectories: string[];
    format: string;
    workspaceRoot: string;
}

interface CachedFileMeta {
    hash: string;
    mode: number;
    mtimeMs: number;
    relativePath: string;
    sizeBytes: number;
}

interface VerifyDiff {
    actual?: { hash?: string; mode?: number; mtimeMs?: number };
    expected?: { hash: string; mode: number; mtimeMs: number };
    issues: ReadonlyArray<"content" | "missing" | "mode" | "mtime">;
    relativePath: string;
}

const walkAndDigest = async (root: string): Promise<CachedFileMeta[]> => {
    const out: CachedFileMeta[] = [];

    const walk = async (absolute: string): Promise<void> => {
        const items = (await readdir(absolute, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));

        for (const item of items) {
            const childAbsolute = join(absolute, item.name);

            if (item.isDirectory()) {
                await walk(childAbsolute);

                continue;
            }

            if (!item.isFile()) {
                continue;
            }

            const [info, digest] = await Promise.all([stat(childAbsolute), digestFile(childAbsolute)]);

            out.push({
                hash: digest?.hash ?? "",
                // eslint-disable-next-line no-bitwise -- low 12 bits hold the rwx triplet
                mode: info.mode & 0o7777,
                mtimeMs: info.mtimeMs,
                relativePath: relative(root, childAbsolute).replaceAll("\\", "/"),
                sizeBytes: info.size,
            });
        }
    };

    await walk(root);

    return out;
};

const compareSecondsTruncated = (a: number, b: number): boolean => Math.floor(a / 1000) === Math.floor(b / 1000);

const VERIFY_DIFF_CONCURRENCY = 16;

const computeFileDiff = async (file: CachedFileMeta, workspaceRoot: string): Promise<VerifyDiff | undefined> => {
    const livePath = join(workspaceRoot, file.relativePath);
    const liveStat = await stat(livePath).catch(() => undefined);

    if (!liveStat) {
        return {
            expected: { hash: file.hash, mode: file.mode, mtimeMs: file.mtimeMs },
            issues: ["missing"],
            relativePath: file.relativePath,
        };
    }

    const liveDigest = await digestFile(livePath);

    const issues: ("content" | "mode" | "mtime")[] = [];

    if ((liveDigest?.hash ?? "") !== file.hash) {
        issues.push("content");
    }

    // eslint-disable-next-line no-bitwise -- low 12 bits hold the rwx triplet
    const liveMode = liveStat.mode & 0o7777;

    if (process.platform !== "win32" && liveMode !== file.mode) {
        issues.push("mode");
    }

    // Tar headers are second precision; a sub-second mismatch never
    // indicates a real problem.
    if (!compareSecondsTruncated(liveStat.mtimeMs, file.mtimeMs)) {
        issues.push("mtime");
    }

    if (issues.length === 0) {
        return undefined;
    }

    return {
        actual: { hash: liveDigest?.hash, mode: liveMode, mtimeMs: liveStat.mtimeMs },
        expected: { hash: file.hash, mode: file.mode, mtimeMs: file.mtimeMs },
        issues,
        relativePath: file.relativePath,
    };
};

// Logging convention in this command: `pail.error` / `pail.info` /
// `pail.success` carry the status banner (one-line summary, errors), and
// the cerebro `logger.info` carries body text (the per-file drift
// listing). Matches `runWhy` / `runHash`.
export const runVerify = async (taskId: string, options: RunVerifyOptions, logger: Console): Promise<void> => {
    const { cacheDirectories, format, workspaceRoot } = options;

    if (cacheDirectories.length === 0) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ error: "no-cache-directory", taskId }, undefined, 2)}\n`);
        } else {
            pail.error("No cache directory resolved — pass --cache-dir or run inside a workspace.");
        }

        process.exitCode = 1;

        return;
    }

    // Walk the resolved directories in order — the entry can only live
    // in one cache (task hashes are content-addressed), and we want the
    // first match to win so --scope=all has predictable semantics
    // (shared first, then worktree).
    let cacheDirectory: string | undefined;
    let cached: { hash: string } | undefined;

    for (const directory of cacheDirectories) {
        const found = await new Cache({ cacheDirectory: directory, workspaceRoot }).getByTaskId(taskId);

        if (found) {
            cacheDirectory = directory;
            cached = found;
            break;
        }
    }

    if (!cached || !cacheDirectory) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ error: "no-cached-entry", searchedCaches: cacheDirectories, taskId }, undefined, 2)}\n`);
        } else {
            pail.error(`No cached entry found for task "${taskId}". Run it once before verifying.`);
        }

        process.exitCode = 1;

        return;
    }

    const stagingRoot = await mkdtemp(join(tmpdir(), "vis-cache-verify-"));

    try {
        // Restore into a throwaway workspaceRoot so we can compare the
        // restored files against the live tree without disturbing it.
        const stagingCache = new Cache({ cacheDirectory, workspaceRoot: stagingRoot });
        const restored = await stagingCache.restoreOutputs(cached.hash);

        if (!restored) {
            if (format === "json") {
                process.stdout.write(`${JSON.stringify({ error: "restore-failed", hash: cached.hash, taskId }, undefined, 2)}\n`);
            } else {
                pail.error(`Cache restore failed for ${taskId} (hash ${cached.hash}).`);
            }

            process.exitCode = 1;

            return;
        }

        const cachedFiles = await walkAndDigest(stagingRoot);

        if (cachedFiles.length === 0) {
            if (format === "json") {
                process.stdout.write(`${JSON.stringify({ diffs: [], hash: cached.hash, status: "no-outputs", taskId }, undefined, 2)}\n`);
            } else {
                pail.info(`Cached entry for ${taskId} has no recorded outputs — nothing to verify.`);
            }

            return;
        }

        // Bounded parallel: per-file IO (stat + sha256 stream) is
        // independent across files, but unbounded parallelism on a
        // 10k-file output tree would exhaust fd limits on common Linux
        // setups (default 1024). 16 keeps us well below that while
        // still saturating typical SSD read throughput.
        const diffSlots: (VerifyDiff | undefined)[] = Array.from({ length: cachedFiles.length });

        for (let offset = 0; offset < cachedFiles.length; offset += VERIFY_DIFF_CONCURRENCY) {
            const chunk = cachedFiles.slice(offset, offset + VERIFY_DIFF_CONCURRENCY);

            const results = await Promise.all(chunk.map(async (file) => computeFileDiff(file, workspaceRoot)));

            for (const [index, result] of results.entries()) {
                diffSlots[offset + index] = result;
            }
        }

        const diffs: VerifyDiff[] = diffSlots.filter((slot): slot is VerifyDiff => slot !== undefined);

        if (format === "json") {
            process.stdout.write(
                `${JSON.stringify(
                    {
                        cachedFileCount: cachedFiles.length,
                        cacheDirectory,
                        diffs,
                        hash: cached.hash,
                        status: diffs.length === 0 ? "ok" : "drift",
                        taskId,
                    },
                    undefined,
                    2,
                )}\n`,
            );

            if (diffs.length > 0) {
                process.exitCode = 1;
            }

            return;
        }

        pail.info(`Verify ${taskId}  (hash ${cached.hash})`);
        logger.info("");
        logger.info(`  cache:      ${cacheDirectory}`);
        logger.info(`  files:      ${String(cachedFiles.length)}`);

        if (diffs.length === 0) {
            logger.info("");
            pail.success("Cache restore is faithful — all files match content, mode, and mtime.");

            return;
        }

        logger.info(`  drift:      ${String(diffs.length)} file(s)`);
        logger.info("");

        for (const diff of diffs) {
            const tag = diff.issues.includes("missing") ? "MISSING" : diff.issues.join(",").toUpperCase();

            logger.info(`  [${tag}] ${diff.relativePath}`);

            if (!diff.issues.includes("missing") && diff.expected && diff.actual) {
                if (diff.issues.includes("content")) {
                    logger.info(`    expected hash: ${diff.expected.hash || "(none)"}`);
                    logger.info(`    actual   hash: ${diff.actual.hash ?? "(unreadable)"}`);
                }

                if (diff.issues.includes("mode")) {
                    logger.info(`    expected mode: ${diff.expected.mode.toString(8)}`);
                    logger.info(`    actual   mode: ${(diff.actual.mode ?? 0).toString(8)}`);
                }

                if (diff.issues.includes("mtime")) {
                    logger.info(`    expected mtime: ${new Date(diff.expected.mtimeMs).toISOString()}`);
                    logger.info(`    actual   mtime: ${diff.actual.mtimeMs === undefined ? "(unreadable)" : new Date(diff.actual.mtimeMs).toISOString()}`);
                }
            }
        }

        process.exitCode = 1;
    } finally {
        await rm(stagingRoot, { force: true, recursive: true }).catch(() => {});
    }
};

// Which cache stores does an operation touch? "task" is the workspace task
// runner cache (resolved with --scope/--cache-dir), "ai" is the global AI
// response cache under ~/.vis/cache/ai, "socket" is the Socket.dev report
// cache under ~/.vis/cache/socket-security. "all" means every store.
type CacheTarget = "all" | "ai" | "socket" | "task";

const parseCacheTarget = (raw: string | undefined): CacheTarget => {
    if (raw === "task" || raw === "ai" || raw === "socket" || raw === "all") {
        return raw;
    }

    if (raw && raw.length > 0) {
        pail.warn(`Unknown --type value '${raw}'; falling back to 'all'.`);
    }

    return "all";
};

const includesTarget = (selected: CacheTarget, kind: Exclude<CacheTarget, "all">): boolean => selected === "all" || selected === kind;

interface AuxStats {
    entries: number;
    newestEntry: number | undefined;
    oldestEntry: number | undefined;
    totalSizeBytes: number;
}

const isoOrNull = (value: number | undefined): string | null => (value === undefined ? null : new Date(value).toISOString());

const printAuxStatsBlock = (label: string, stats: AuxStats): void => {
    pail.info(`${label}:`);
    pail.info(`  Entries:    ${String(stats.entries)}`);
    pail.info(`  Total size: ${formatBytes(stats.totalSizeBytes, { decimals: 1, space: false })}`);
    pail.info(`  Oldest:     ${stats.oldestEntry ? new Date(stats.oldestEntry).toISOString() : "N/A"}`);
    pail.info(`  Newest:     ${stats.newestEntry ? new Date(stats.newestEntry).toISOString() : "N/A"}`);
};

type CacheScope = "all" | "shared" | "worktree";

const parseScope = (raw: string | undefined): CacheScope => {
    if (raw === "worktree" || raw === "shared" || raw === "all") {
        return raw;
    }

    if (raw && raw.length > 0) {
        pail.warn(`Unknown --scope value '${raw}'; falling back to 'shared'.`);
    }

    return "shared";
};

interface ResolvedCacheContext {
    /** All paths the operation should touch (deduplicated). */
    cacheDirectories: string[];
    /** Primary directory selected by the chosen scope (shared by default). */
    cacheDirectory: string;
    scope: CacheScope;
    sharedWorktreeCache: boolean | undefined;
    workspaceRoot: string;
}

const resolveCacheDirectoryFromContext = (
    workspaceRoot: string | undefined,
    options: Record<string, unknown>,
    visConfig: Record<string, unknown> | undefined,
): ResolvedCacheContext => {
    const resolvedWorkspaceRoot = workspaceRoot ?? process.cwd();
    const cfg = (visConfig ?? {}) as { sharedWorktreeCache?: boolean; taskRunnerOptions?: { cacheDirectory?: string } };
    const taskRunnerOptions = cfg.taskRunnerOptions ?? {};
    const scope = parseScope(options.scope as string | undefined);
    const optionsCacheDir = options.cacheDir as string | undefined;

    // Worktree-local: this checkout's `.task-runner-cache`. Disable
    // worktree-share by passing `sharedWorktreeCache: false` so the
    // resolver returns the literal workspace_root path.
    const worktreeDirectory = resolveSharedCacheDirectory(resolvedWorkspaceRoot, optionsCacheDir, taskRunnerOptions.cacheDirectory, false);

    // Shared: the main worktree's cache (or workspace_root for primary checkouts).
    const sharedDirectory = resolveSharedCacheDirectory(resolvedWorkspaceRoot, optionsCacheDir, taskRunnerOptions.cacheDirectory, cfg.sharedWorktreeCache);

    let primary: string;
    let directories: string[];

    switch (scope) {
        case "all": {
            primary = sharedDirectory;
            directories = sharedDirectory === worktreeDirectory ? [sharedDirectory] : [sharedDirectory, worktreeDirectory];
            break;
        }
        case "worktree": {
            primary = worktreeDirectory;
            directories = [worktreeDirectory];
            break;
        }
        default: {
            primary = sharedDirectory;
            directories = [sharedDirectory];
        }
    }

    return {
        cacheDirectories: directories,
        cacheDirectory: primary,
        scope,
        sharedWorktreeCache: cfg.sharedWorktreeCache,
        workspaceRoot: resolvedWorkspaceRoot,
    };
};

export const cacheListExecute = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, CacheListOptions>): Promise<void> => {
    const { cacheDirectories } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);
    const format = options.format ?? "table";

    for (const directory of cacheDirectories) {
        if (cacheDirectories.length > 1) {
            pail.info(`# ${directory}`);
        }

        await runList(directory, format, logger);
    }
};

export const cacheCleanExecute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, CacheCleanOptions>): Promise<void> => {
    const target = parseCacheTarget(options.type);
    const dryRun = Boolean(options.dryRun);

    if (includesTarget(target, "task")) {
        const { cacheDirectory, workspaceRoot } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);

        // `runClean` already invokes `isCacheDirectoryInsideWorkspace` and
        // prompts for out-of-workspace targets — when the user is in a linked
        // worktree and the resolver landed on the *main* worktree's cache,
        // that path lives outside the current `workspaceRoot`, so the
        // existing prompt naturally requires `--force` (or interactive
        // confirmation) before nuking the shared store.
        await runClean(cacheDirectory, workspaceRoot, {
            dryRun,
            force: Boolean(options.force),
        });
    }

    if (includesTarget(target, "ai")) {
        if (dryRun) {
            const stats = getAiCacheStats();

            pail.info(`Would clear ${String(stats.entries)} cached AI response${stats.entries === 1 ? "" : "s"}.`);
        } else {
            clearAiCacheSafe();
        }
    }

    if (includesTarget(target, "socket")) {
        if (dryRun) {
            const stats = getSocketCacheStats();

            pail.info(`Would clear ${String(stats.entries)} cached Socket.dev report${stats.entries === 1 ? "" : "s"}.`);
        } else {
            clearSocketCacheSafe();
        }
    }
};

export const cachePruneExecute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, CachePruneOptions>): Promise<void> => {
    const { cacheDirectories, workspaceRoot } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);

    for (const directory of cacheDirectories) {
        if (cacheDirectories.length > 1) {
            pail.info(`# ${directory}`);
        }

        await runPrune(directory, workspaceRoot, {
            keepLast: typeof options.keepLast === "number" ? options.keepLast : undefined,
            maxCacheAgeDays: typeof options.maxAgeDays === "number" ? options.maxAgeDays : undefined,
            maxCacheSize: options.maxSize,
        });
    }
};

const resolveWorkspaceRoot = (workspaceRoot: string | undefined): string => workspaceRoot ?? process.cwd();

export const cacheWhyExecute = async ({ argument, logger, options, workspaceRoot: wsRoot }: Toolbox<Console, CacheWhyOptions>): Promise<void> => {
    const taskId = argument[0];

    if (!taskId) {
        pail.error("No task ID specified. Usage: vis cache why <project>:<target>");
        process.exitCode = 1;

        return;
    }

    await runWhy(
        taskId,
        {
            format: options.format ?? "table",
            runId: options.run,
            workspaceRoot: resolveWorkspaceRoot(wsRoot),
        },
        logger,
    );
};

export const cacheHashExecute = async ({ argument, logger, options, workspaceRoot: wsRoot }: Toolbox<Console, CacheHashOptions>): Promise<void> => {
    const taskId = argument[0];

    if (!taskId) {
        pail.error("No task ID specified. Usage: vis cache hash <project>:<target>");
        process.exitCode = 1;

        return;
    }

    await runHash(
        taskId,
        {
            format: options.format ?? "table",
            runId: options.run,
            workspaceRoot: resolveWorkspaceRoot(wsRoot),
        },
        logger,
    );
};

export const cacheSizeExecute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, CacheSizeOptions>): Promise<void> => {
    const target = parseCacheTarget(options.type);
    const format = options.format ?? "table";

    if (format === "json") {
        const payload: Record<string, unknown> = {};

        if (includesTarget(target, "task")) {
            const { cacheDirectories } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);

            payload.task = await Promise.all(
                cacheDirectories.map(async (directory) => {
                    const exists = isAccessibleSync(directory);
                    const entries = exists ? await collectCacheEntries(directory) : [];
                    const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);

                    return {
                        directory,
                        entries: entries.length,
                        exists,
                        newestEntry: isoOrNull(entries[0]?.mtimeMs),
                        oldestEntry: isoOrNull(entries.at(-1)?.mtimeMs),
                        totalBytes,
                    };
                }),
            );
        }

        if (includesTarget(target, "ai")) {
            const stats = getAiCacheStats();

            payload.ai = {
                entries: stats.entries,
                newestEntry: isoOrNull(stats.newestEntry),
                oldestEntry: isoOrNull(stats.oldestEntry),
                totalBytes: stats.totalSizeBytes,
            };
        }

        if (includesTarget(target, "socket")) {
            const stats = getSocketCacheStats();

            payload.socket = {
                entries: stats.entries,
                newestEntry: isoOrNull(stats.newestEntry),
                oldestEntry: isoOrNull(stats.oldestEntry),
                totalBytes: stats.totalSizeBytes,
            };
        }

        process.stdout.write(`${JSON.stringify(payload, undefined, 2)}\n`);

        return;
    }

    if (includesTarget(target, "task")) {
        const { cacheDirectories } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);

        for (const directory of cacheDirectories) {
            if (cacheDirectories.length > 1) {
                pail.info(`# ${directory}`);
            }

            await runSize(directory, "table");
        }
    }

    if (includesTarget(target, "ai")) {
        printAuxStatsBlock("AI response cache", getAiCacheStats());
    }

    if (includesTarget(target, "socket")) {
        printAuxStatsBlock("Socket.dev report cache", getSocketCacheStats());
    }
};

export const cacheVerifyExecute = async ({
    argument,
    logger,
    options,
    visConfig,
    workspaceRoot: wsRoot,
}: Toolbox<Console, CacheVerifyOptions>): Promise<void> => {
    const taskId = argument[0];

    if (!taskId) {
        pail.error("No task ID specified. Usage: vis cache verify <project>:<target>");
        process.exitCode = 1;

        return;
    }

    // Pass every directory the chosen --scope produced. With
    // `--scope=all`, that's [shared, worktree]; verify will look up the
    // task hash in each, in order, and use the first match. Other
    // scopes resolve to a single-element list.
    const { cacheDirectories, workspaceRoot } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);

    await runVerify(
        taskId,
        {
            cacheDirectories,
            format: options.format ?? "table",
            workspaceRoot,
        },
        logger,
    );
};
