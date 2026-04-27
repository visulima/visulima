import { readdir, realpath, rm, stat } from "node:fs/promises";
import { createInterface } from "node:readline";

import type { Toolbox } from "@visulima/cerebro";
import { isAccessibleSync } from "@visulima/fs";
import { formatBytes } from "@visulima/humanizer";
import { join } from "@visulima/path";
import { Cache, parseCacheSize } from "@visulima/task-runner";

import { isCacheDirectoryInsideWorkspace, resolveCacheDirectory } from "../../cache-directory";
import { failure, info, success, warn } from "../../output";
import type { CacheCleanOptions, CacheListOptions, CachePruneOptions, CacheSizeOptions } from "./index";

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

    entries.sort((a, b) => b.mtimeMs - a.mtimeMs);

    return entries;
};

export const formatAge = (mtimeMs: number, now: number = Date.now()): string => {
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

export const runClean = async (cacheDirectory: string, workspaceRoot: string, options: { dryRun: boolean; force: boolean }): Promise<void> => {
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

    try {
        const realCache = await realpath(cacheDirectory);
        const realWorkspace = await realpath(workspaceRoot);

        if (realCache === realWorkspace) {
            failure("Refusing to delete the workspace root. The cache directory resolved to the same path as the workspace.");
            process.exitCode = 1;

            return;
        }
    } catch {
        // Path may not exist on disk; deletion branches handle missing paths safely.
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
        const cache = new Cache({ cacheDirectory, workspaceRoot });

        await cache.clear();
    } else {
        await rm(cacheDirectory, { force: true, recursive: true });
    }

    success(`Cleared cache: ${cacheDirectory}`);
};

export const runPrune = async (cacheDirectory: string, workspaceRoot: string, options: { maxCacheAgeDays?: number; maxCacheSize?: string }): Promise<void> => {
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

export const runSize = async (cacheDirectory: string, format: string): Promise<void> => {
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

export const cacheListExecute = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, CacheListOptions>): Promise<void> => {
    const { cacheDirectory } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);
    const format = options.format ?? "table";

    await runList(cacheDirectory, format, logger);
};

export const cacheCleanExecute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, CacheCleanOptions>): Promise<void> => {
    const { cacheDirectory, workspaceRoot } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);

    await runClean(cacheDirectory, workspaceRoot, {
        dryRun: Boolean(options.dryRun),
        force: Boolean(options.force),
    });
};

export const cachePruneExecute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, CachePruneOptions>): Promise<void> => {
    const { cacheDirectory, workspaceRoot } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);

    await runPrune(cacheDirectory, workspaceRoot, {
        maxCacheAgeDays: typeof options.maxAgeDays === "number" ? options.maxAgeDays : undefined,
        maxCacheSize: options.maxSize,
    });
};

export const cacheSizeExecute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, CacheSizeOptions>): Promise<void> => {
    const { cacheDirectory } = resolveCacheDirectoryFromContext(wsRoot, options, visConfig as Record<string, unknown> | undefined);
    const format = options.format ?? "table";

    await runSize(cacheDirectory, format);
};
