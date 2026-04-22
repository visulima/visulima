import { readdir, realpath, rm, stat } from "node:fs/promises";
import { createInterface } from "node:readline";

import type { Command } from "@visulima/cerebro";
import { isAccessibleSync } from "@visulima/fs";
import { formatBytes } from "@visulima/humanizer";
import { join } from "@visulima/path";
import { Cache, parseCacheSize } from "@visulima/task-runner";

import { isCacheDirectoryInsideWorkspace, resolveCacheDirectory } from "../cache-directory";
import { failure, info, success, warn } from "../output";

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

/**
 * Recursively sums the byte size of all files under `directory`.
 * Internal-use only — not exported to keep the public surface small.
 */
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

/**
 * Reads the cache directory and returns one entry per cached task hash.
 * Skips any file/directory starting with `.` (index files, temp dirs).
 * @param cacheDirectory Absolute path to the cache root directory.
 * @returns Array of cache entries sorted newest-first by modification time.
 * Returns an empty array when the directory does not exist or is empty.
 */
const collectCacheEntries = async (cacheDirectory: string): Promise<CacheEntry[]> => {
    const entries: CacheEntry[] = [];

    let dirents: string[];

    try {
        dirents = (await readdir(cacheDirectory)) as unknown as string[];
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

    // Newest first for easier reading.
    entries.sort((a, b) => b.mtimeMs - a.mtimeMs);

    return entries;
};

/**
 * Formats the difference between `now` and `mtimeMs` as a short age string:
 * "3m", "2h", "4d". The caller passes a shared `now` so rows in the same
 * listing use a consistent baseline.
 * @param mtimeMs File modification time in milliseconds since epoch.
 * @param now Reference timestamp in milliseconds since epoch. Defaults to `Date.now()`.
 * @returns A compact age string such as `"5s"`, `"10m"`, `"2h"`, or `"3d"`.
 */
const formatAge = (mtimeMs: number, now: number = Date.now()): string => {
    const seconds = Math.floor((now - mtimeMs) / 1000);

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

/**
 * Prompts the user with a yes/no question. Returns `true` for `y`/`yes`.
 * Mirrors the helper used by `vis hook install` so prompts stay consistent.
 */
const confirmPrompt = (question: string): Promise<boolean> =>
    new Promise((resolvePromise) => {
        const rl = createInterface({ input: process.stdin, output: process.stderr });

        rl.question(`${question} (y/N) `, (answer) => {
            rl.close();
            const trimmed = answer.trim().toLowerCase();

            resolvePromise(trimmed === "y" || trimmed === "yes");
        });
    });

/**
 * `list` subcommand — prints a table of cached task entries.
 * @param cacheDirectory Absolute path to the cache directory to enumerate.
 * @param format Output format: `"table"` for a human-readable table, `"json"` for machine-readable JSON.
 * @param logger Console instance used for non-prefixed table rows.
 * @returns Resolves when output has been written.
 */
const runList = async (cacheDirectory: string, format: string, logger: Console): Promise<void> => {
    if (!isAccessibleSync(cacheDirectory)) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ directory: cacheDirectory, entries: [], totalBytes: 0, totalCount: 0 }, undefined, 2)}\n`);

            return;
        }

        info(`No cache directory found at ${cacheDirectory}`);

        return;
    }

    const entries = await collectCacheEntries(cacheDirectory);

    if (entries.length === 0) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ directory: cacheDirectory, entries: [], totalBytes: 0, totalCount: 0 }, undefined, 2)}\n`);

            return;
        }

        info(`Cache directory is empty: ${cacheDirectory}`);

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

    info(`Cache directory: ${cacheDirectory}`);
    info(`Entries: ${String(entries.length)} (${formatBytes(totalBytes, { decimals: 1, space: false })})`);
    logger.info("");

    // Plain text table without pulling in the TUI renderer — keeps startup
    // fast and avoids React for a simple listing.
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

/**
 * `clean` subcommand — removes the entire cache directory.
 *
 * Uses `Cache.clear()` when the directory is inside `workspaceRoot` so we
 * match the task runner's own cleanup semantics. For custom `--cache-dir`
 * paths that live outside the workspace we fall back to `rm -r`, but only
 * after prompting for confirmation: users pointing at a shared location
 * (e.g. `~/.cache/...`) shouldn't lose unrelated data without an opt-in.
 * The prompt is skipped in non-TTY / CI contexts and when `--force` is set.
 *
 * Refuses outright when `cacheDirectory` resolves to the workspace root.
 * @param cacheDirectory Absolute path to the cache directory to remove.
 * @param workspaceRoot Absolute path to the workspace root (used for containment checks and `Cache` construction).
 * @param options `dryRun` previews without deleting; `force` skips the out-of-workspace confirmation prompt.
 * @returns Resolves when the operation completes (or is skipped / aborted).
 */
const runClean = async (cacheDirectory: string, workspaceRoot: string, options: { dryRun: boolean; force: boolean }): Promise<void> => {
    if (!isAccessibleSync(cacheDirectory)) {
        info(`No cache directory to clean at ${cacheDirectory}`);

        return;
    }

    if (options.dryRun) {
        const entries = await collectCacheEntries(cacheDirectory);
        const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);

        info(
            `Would remove ${String(entries.length)} cache entr${entries.length === 1 ? "y" : "ies"} `
            + `(${formatBytes(totalBytes, { decimals: 1, space: false })}) from ${cacheDirectory}`,
        );

        return;
    }

    const insideWorkspace = isCacheDirectoryInsideWorkspace(cacheDirectory, workspaceRoot);

    // Hard stop: never `rm -r` the workspace root itself, regardless of
    // --force. Compare canonical paths via `realpath()` so the guard holds
    // even when one side is reached through a symlink.
    try {
        const realCache = await realpath(cacheDirectory);
        const realWorkspace = await realpath(workspaceRoot);

        if (realCache === realWorkspace) {
            failure("Refusing to delete the workspace root. The cache directory resolved to the same path as the workspace.");
            process.exitCode = 1;

            return;
        }
    } catch {
        // One of the paths doesn't exist on disk (which `isAccessibleSync`
        // already checked for `cacheDirectory`). Proceed — the deletion
        // branches handle missing paths safely.
    }

    if (!insideWorkspace && !options.force) {
        warn(`Cache directory is outside the workspace root: ${cacheDirectory}`);
        warn("This will recursively delete the entire directory, including anything stored there by other tools.");

        if (!process.stdin.isTTY) {
            failure("Refusing to clean an out-of-workspace cache without --force (stdin is not a TTY).");
            process.exitCode = 1;

            return;
        }

        const confirmed = await confirmPrompt("  Continue?");

        if (!confirmed) {
            info("Aborted.");

            return;
        }
    }

    if (insideWorkspace) {
        // `Cache.clear()` honors the task-runner layout (index files,
        // `.commit` markers, etc.).
        const cache = new Cache({ cacheDirectory, workspaceRoot });

        await cache.clear();
    } else {
        await rm(cacheDirectory, { force: true, recursive: true });
    }

    success(`Cleared cache: ${cacheDirectory}`);
};

/**
 * `prune` subcommand — removes stale entries (age + size) without nuking
 * everything. Mirrors `Cache.removeOldEntries()` which the runner invokes
 * automatically on each run.
 *
 * Both `--max-age-days` and `--max-size` are validated up-front so
 * malformed values produce a friendly CLI error instead of a stack trace
 * from inside `Cache`. The before/after count is a best-effort estimate —
 * a concurrent `vis run` could skew it, but the cache state remains correct.
 * @param cacheDirectory Absolute path to the cache directory to prune.
 * @param workspaceRoot Absolute path to the workspace root (passed to the `Cache` constructor).
 * @param options `maxCacheAgeDays` evicts entries older than N days; `maxCacheSize` (e.g. `"500MB"`)
 * evicts oldest entries until the total size is under the limit.
 * @returns Resolves when pruning completes or is skipped.
 */
const runPrune = async (cacheDirectory: string, workspaceRoot: string, options: { maxCacheAgeDays?: number; maxCacheSize?: string }): Promise<void> => {
    if (!isAccessibleSync(cacheDirectory)) {
        info(`No cache directory to prune at ${cacheDirectory}`);

        return;
    }

    if (options.maxCacheAgeDays !== undefined && (!Number.isFinite(options.maxCacheAgeDays) || options.maxCacheAgeDays < 0)) {
        failure(`Invalid --max-age-days value: expected a finite number >= 0, got ${String(options.maxCacheAgeDays)}`);
        process.exitCode = 1;

        return;
    }

    if (options.maxCacheSize !== undefined) {
        let parsedBytes: number;

        try {
            parsedBytes = parseCacheSize(options.maxCacheSize);
        } catch (error: unknown) {
            failure(`Invalid --max-size value: ${error instanceof Error ? error.message : String(error)}`);
            process.exitCode = 1;

            return;
        }

        if (!Number.isFinite(parsedBytes) || parsedBytes <= 0) {
            failure(`Invalid --max-size value: expected a positive size, got "${options.maxCacheSize}" (${String(parsedBytes)} bytes)`);
            process.exitCode = 1;

            return;
        }
    }

    const maxCacheAge = options.maxCacheAgeDays === undefined ? undefined : options.maxCacheAgeDays * 24 * 60 * 60 * 1000;

    const before = await collectCacheEntries(cacheDirectory);
    const beforeBytes = before.reduce((sum, entry) => sum + entry.sizeBytes, 0);

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
        info("Nothing to prune — all entries are within the configured limits.");

        return;
    }

    success(`Pruned ${String(removed)} entr${removed === 1 ? "y" : "ies"}, ` + `freed ${formatBytes(reclaimedBytes, { decimals: 1, space: false })}.`);
};

/**
 * `size` subcommand — prints the cache directory's on-disk footprint without
 * the per-entry table.
 * @param cacheDirectory Absolute path to the cache directory to measure.
 * @param format `"table"` for human-readable output, `"json"` for machine-readable JSON.
 * @returns Resolves when output has been written.
 */
const runSize = async (cacheDirectory: string, format: string): Promise<void> => {
    if (!isAccessibleSync(cacheDirectory)) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ directory: cacheDirectory, exists: false, totalBytes: 0, totalCount: 0 })}\n`);

            return;
        }

        info(`No cache directory at ${cacheDirectory}`);

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

    info(`Cache directory: ${cacheDirectory}`);
    info(`Entries:         ${String(entries.length)}`);
    info(`Total size:      ${formatBytes(totalBytes, { decimals: 1, space: false })}`);
};

/**
 * Shared option describing the cache-directory override. Used by every
 * subcommand so `--cache-dir` is accepted consistently.
 */
const cacheDirectoryOption = {
    description: "Cache directory (overrides config and default). Relative paths are resolved against the workspace root.",
    name: "cache-dir",
    type: String,
} as const;

/**
 * Resolves the cache directory for a subcommand, honouring `--cache-dir`,
 * `visConfig.taskRunnerOptions.cacheDirectory`, and the default.
 */
const resolveCacheDirectoryFromContext = (
    workspaceRoot: string | undefined,
    options: Record<string, unknown>,
    visConfig: Record<string, unknown> | undefined,
): { cacheDirectory: string; workspaceRoot: string } => {
    const resolvedWorkspaceRoot = workspaceRoot ?? process.cwd();
    const taskRunnerOptions = ((visConfig ?? {}) as { taskRunnerOptions?: { cacheDirectory?: string } }).taskRunnerOptions ?? {};

    return {
        cacheDirectory: resolveCacheDirectory(resolvedWorkspaceRoot, options.cacheDir as string | undefined, taskRunnerOptions.cacheDirectory),
        workspaceRoot: resolvedWorkspaceRoot,
    };
};

const cacheList: Command = {
    commandPath: ["cache"],
    description: "List all cache entries",
    examples: [["vis cache list", "List all cache entries"]],
    execute: async ({ logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const { cacheDirectory } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);
        const format = (options.format as string) ?? "table";

        await runList(cacheDirectory, format, logger);
    },
    group: "Workspace",
    name: "list",
    options: [
        cacheDirectoryOption,
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
    ],
};

const cacheClean: Command = {
    commandPath: ["cache"],
    description: "Remove all cache entries",
    examples: [
        ["vis cache clean", "Remove all cache entries"],
        ["vis cache clean --dry-run", "Preview what clean would remove"],
    ],
    execute: async ({ options, visConfig, workspaceRoot: wsRoot }) => {
        const { cacheDirectory, workspaceRoot } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);

        await runClean(cacheDirectory, workspaceRoot, {
            dryRun: Boolean(options.dryRun),
            force: Boolean(options.force),
        });
    },
    group: "Workspace",
    name: "clean",
    options: [
        cacheDirectoryOption,
        {
            defaultValue: false,
            description: "Preview without deleting",
            name: "dry-run",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip the confirmation prompt for out-of-workspace cache directories",
            name: "force",
            type: Boolean,
        },
    ],
};

const cachePrune: Command = {
    commandPath: ["cache"],
    description: "Remove old and oversized cache entries",
    examples: [
        ["vis cache prune", "Remove old and oversized entries"],
        ["vis cache prune --max-age-days=3 --max-size=500MB", "Prune with custom limits"],
    ],
    execute: async ({ options, visConfig, workspaceRoot: wsRoot }) => {
        const { cacheDirectory, workspaceRoot } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);

        await runPrune(cacheDirectory, workspaceRoot, {
            maxCacheAgeDays: typeof options.maxAgeDays === "number" ? options.maxAgeDays : undefined,
            maxCacheSize: options.maxSize as string | undefined,
        });
    },
    group: "Workspace",
    name: "prune",
    options: [
        cacheDirectoryOption,
        {
            description: "Remove entries older than N days",
            name: "max-age-days",
            type: Number,
        },
        {
            description: "Evict oldest entries until cache is under this size (e.g. 500MB)",
            name: "max-size",
            type: String,
        },
    ],
};

const cacheSize: Command = {
    commandPath: ["cache"],
    description: "Print the cache directory's on-disk footprint",
    examples: [["vis cache size --format=json", "Print total size as JSON"]],
    execute: async ({ options, visConfig, workspaceRoot: wsRoot }) => {
        const { cacheDirectory } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);
        const format = (options.format as string) ?? "table";

        await runSize(cacheDirectory, format);
    },
    group: "Workspace",
    name: "size",
    options: [
        cacheDirectoryOption,
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
    ],
};

const cacheCommands: Command[] = [cacheList, cacheClean, cachePrune, cacheSize];

export default cacheCommands;
// Internals exposed for unit tests. `DEFAULT_CACHE_DIRECTORY_NAME`,
// `resolveCacheDirectory`, and `isCacheDirectoryInsideWorkspace` live in
// `../cache-directory` — import them from there instead of re-exporting here.
export { collectCacheEntries, formatAge, runClean, runList, runPrune, runSize };
