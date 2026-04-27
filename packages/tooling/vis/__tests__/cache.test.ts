import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collectCacheEntries, formatAge, runClean, runPrune } from "../src/commands/cache/handler";

describe(formatAge, () => {
    it("returns seconds for sub-minute ages", () => {
        expect.assertions(1);

        const now = 1_700_000_000_000;
        const mtime = now - 5 * 1000;

        expect(formatAge(mtime, now)).toBe("5s");
    });

    it("returns minutes between 1m and 1h", () => {
        expect.assertions(1);

        const now = 1_700_000_000_000;
        const mtime = now - 10 * 60 * 1000;

        expect(formatAge(mtime, now)).toBe("10m");
    });

    it("returns hours between 1h and 1d", () => {
        expect.assertions(1);

        const now = 1_700_000_000_000;
        const mtime = now - 5 * 60 * 60 * 1000;

        expect(formatAge(mtime, now)).toBe("5h");
    });

    it("returns days for older entries", () => {
        expect.assertions(1);

        const now = 1_700_000_000_000;
        const mtime = now - 3 * 24 * 60 * 60 * 1000;

        expect(formatAge(mtime, now)).toBe("3d");
    });

    it("uses Date.now() when no `now` is passed", () => {
        expect.assertions(1);

        const mtime = Date.now() - 2 * 1000;

        // Regex because the implicit clock read may give 2s or 3s.
        expect(formatAge(mtime)).toMatch(/^\ds$/u);
    });
});

describe(collectCacheEntries, () => {
    let cacheDirectory: string;

    beforeEach(() => {
        cacheDirectory = mkdtempSync(join(tmpdir(), "vis-cache-test-"));
    });

    afterEach(() => {
        rmSync(cacheDirectory, { force: true, recursive: true });
    });

    it("returns an empty list for a non-existent directory", async () => {
        expect.assertions(1);

        rmSync(cacheDirectory, { force: true, recursive: true });

        const entries = await collectCacheEntries(cacheDirectory);

        expect(entries).toStrictEqual([]);
    });

    it("returns an empty list for an empty cache directory", async () => {
        expect.assertions(1);

        const entries = await collectCacheEntries(cacheDirectory);

        expect(entries).toStrictEqual([]);
    });

    it("enumerates non-dotfile directories under the cache root", async () => {
        expect.assertions(3);

        mkdirSync(join(cacheDirectory, "abc123"));
        writeFileSync(join(cacheDirectory, "abc123", "code"), "0");
        writeFileSync(join(cacheDirectory, "abc123", "terminalOutput"), "hello world");

        mkdirSync(join(cacheDirectory, "def456"));
        writeFileSync(join(cacheDirectory, "def456", "code"), "0");

        const entries = await collectCacheEntries(cacheDirectory);

        expect(entries).toHaveLength(2);
        expect(entries.map((entry) => entry.hash).sort()).toStrictEqual(["abc123", "def456"]);
        expect(entries.every((entry) => entry.sizeBytes > 0)).toBe(true);
    });

    it("skips hidden entries (index files, temp dirs)", async () => {
        expect.assertions(1);

        writeFileSync(join(cacheDirectory, ".task-index.json"), "{}");
        mkdirSync(join(cacheDirectory, ".tmp-abc"));
        writeFileSync(join(cacheDirectory, ".tmp-abc", "x"), "y");

        mkdirSync(join(cacheDirectory, "abc"));
        writeFileSync(join(cacheDirectory, "abc", "code"), "0");

        const entries = await collectCacheEntries(cacheDirectory);

        expect(entries.map((entry) => entry.hash)).toStrictEqual(["abc"]);
    });

    it("skips plain files at the cache root", async () => {
        expect.assertions(1);

        writeFileSync(join(cacheDirectory, "stray.txt"), "not a cache entry");
        mkdirSync(join(cacheDirectory, "abc"));
        writeFileSync(join(cacheDirectory, "abc", "code"), "0");

        const entries = await collectCacheEntries(cacheDirectory);

        expect(entries.map((entry) => entry.hash)).toStrictEqual(["abc"]);
    });
});

/**
 * Writes a fully-formed cache entry — a directory with the files the task
 * runner expects (`code`, `terminalOutput`, `.commit`). Used to exercise the
 * `runClean` and `runPrune` subcommands against a realistic layout.
 */
const writeCacheEntry = (cacheDirectory: string, hash: string, options: { mtime?: Date } = {}): void => {
    const entry = join(cacheDirectory, hash);

    mkdirSync(entry, { recursive: true });
    writeFileSync(join(entry, "code"), "0");
    writeFileSync(join(entry, "terminalOutput"), `output for ${hash}`);
    writeFileSync(join(entry, ".commit"), "");

    if (options.mtime) {
        utimesSync(entry, options.mtime, options.mtime);
    }
};

describe(runClean, () => {
    let workspaceRoot: string;
    let cacheDirectory: string;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-cache-clean-ws-"));
        cacheDirectory = join(workspaceRoot, ".task-runner-cache");
        mkdirSync(cacheDirectory);
        writeCacheEntry(cacheDirectory, "hash1");
        writeCacheEntry(cacheDirectory, "hash2");
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("dry-run reports entries without deleting", async () => {
        expect.assertions(1);

        await runClean(cacheDirectory, workspaceRoot, { dryRun: true, force: false });

        const entries = await collectCacheEntries(cacheDirectory);

        expect(entries).toHaveLength(2);
    });

    it("clears all entries when the cache is inside the workspace", async () => {
        expect.assertions(1);

        await runClean(cacheDirectory, workspaceRoot, { dryRun: false, force: false });

        const entries = await collectCacheEntries(cacheDirectory);

        expect(entries).toStrictEqual([]);
    });

    it("is a no-op when the cache directory does not exist", async () => {
        expect.assertions(1);

        const missing = join(workspaceRoot, "does-not-exist");

        // Should not throw.
        await expect(runClean(missing, workspaceRoot, { dryRun: false, force: false })).resolves.toBeUndefined();
    });

    it("refuses to clean an out-of-workspace cache without --force on non-TTY", async () => {
        expect.assertions(2);

        const originalExitCode = process.exitCode;
        const originalIsTTY = process.stdin.isTTY;

        try {
            Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: false });

            // `workspaceRoot` is passed as a sibling dir — the cache lives
            // outside it, so the confirmation gate kicks in.
            const otherWorkspace = mkdtempSync(join(tmpdir(), "vis-cache-other-"));

            try {
                await runClean(cacheDirectory, otherWorkspace, { dryRun: false, force: false });

                expect(process.exitCode).toBe(1);

                // Entries should still be there since we refused.
                const entries = await collectCacheEntries(cacheDirectory);

                expect(entries).toHaveLength(2);
            } finally {
                rmSync(otherWorkspace, { force: true, recursive: true });
            }
        } finally {
            process.exitCode = originalExitCode;
            Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: originalIsTTY });
        }
    });

    it("cleans out-of-workspace cache when --force is set", async () => {
        expect.assertions(1);

        const otherWorkspace = mkdtempSync(join(tmpdir(), "vis-cache-other-force-"));

        try {
            await runClean(cacheDirectory, otherWorkspace, { dryRun: false, force: true });

            const entries = await collectCacheEntries(cacheDirectory);

            expect(entries).toStrictEqual([]);
        } finally {
            rmSync(otherWorkspace, { force: true, recursive: true });
        }
    });

    it("refuses to delete the workspace root even with --force", async () => {
        // Regression: `--cache-dir .` resolved to workspaceRoot. Without
        // this guard, `--force` would have nuked the entire repo.
        expect.assertions(2);

        const originalExitCode = process.exitCode;

        try {
            await runClean(workspaceRoot, workspaceRoot, { dryRun: false, force: true });

            expect(process.exitCode).toBe(1);

            // The workspace root must still exist.
            expect(existsSync(workspaceRoot)).toBe(true);
        } finally {
            process.exitCode = originalExitCode;
        }
    });
});

describe(runPrune, () => {
    let workspaceRoot: string;
    let cacheDirectory: string;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-cache-prune-ws-"));
        cacheDirectory = join(workspaceRoot, ".task-runner-cache");
        mkdirSync(cacheDirectory);
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("is a no-op when the cache directory does not exist", async () => {
        expect.assertions(1);

        const missing = join(workspaceRoot, "no-cache");

        await expect(runPrune(missing, workspaceRoot, {})).resolves.toBeUndefined();
    });

    it("rejects an invalid --max-size string and sets exit code 1", async () => {
        expect.assertions(2);

        const originalExitCode = process.exitCode;

        try {
            writeCacheEntry(cacheDirectory, "hash1");

            await runPrune(cacheDirectory, workspaceRoot, { maxCacheSize: "definitely-not-a-size" });

            expect(process.exitCode).toBe(1);

            // Entries should still be there since validation failed early.
            const entries = await collectCacheEntries(cacheDirectory);

            expect(entries).toHaveLength(1);
        } finally {
            process.exitCode = originalExitCode;
        }
    });

    it("rejects a negative --max-size and sets exit code 1", async () => {
        // Regression: parseCacheSize accepted "-500MB" → negative byte count →
        // Cache.removeOldEntries() evicted everything.
        expect.assertions(2);

        const originalExitCode = process.exitCode;

        try {
            writeCacheEntry(cacheDirectory, "hash1");

            await runPrune(cacheDirectory, workspaceRoot, { maxCacheSize: "-500MB" });

            expect(process.exitCode).toBe(1);

            const entries = await collectCacheEntries(cacheDirectory);

            expect(entries).toHaveLength(1);
        } finally {
            process.exitCode = originalExitCode;
        }
    });

    it("evicts entries older than --max-age-days", async () => {
        expect.assertions(2);

        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

        writeCacheEntry(cacheDirectory, "fresh");
        writeCacheEntry(cacheDirectory, "stale", { mtime: twoDaysAgo });

        await runPrune(cacheDirectory, workspaceRoot, { maxCacheAgeDays: 1 });

        const entries = await collectCacheEntries(cacheDirectory);
        const hashes = entries.map((entry) => entry.hash);

        expect(hashes).toContain("fresh");
        expect(hashes).not.toContain("stale");
    });

    it("does nothing when no entries exceed the configured limits", async () => {
        expect.assertions(1);

        writeCacheEntry(cacheDirectory, "fresh1");
        writeCacheEntry(cacheDirectory, "fresh2");

        await runPrune(cacheDirectory, workspaceRoot, { maxCacheAgeDays: 30 });

        const entries = await collectCacheEntries(cacheDirectory);

        expect(entries).toHaveLength(2);
    });

    it("rejects negative --max-age-days and sets exit code 1", async () => {
        // Regression: a negative value caused maxCacheAge to be negative,
        // making `now - mtime > negativeValue` always true — everything
        // was evicted.
        expect.assertions(2);

        const originalExitCode = process.exitCode;

        try {
            writeCacheEntry(cacheDirectory, "hash1");

            await runPrune(cacheDirectory, workspaceRoot, { maxCacheAgeDays: -5 });

            expect(process.exitCode).toBe(1);

            const entries = await collectCacheEntries(cacheDirectory);

            expect(entries).toHaveLength(1);
        } finally {
            process.exitCode = originalExitCode;
        }
    });

    it("rejects NaN --max-age-days and sets exit code 1", async () => {
        expect.assertions(2);

        const originalExitCode = process.exitCode;

        try {
            writeCacheEntry(cacheDirectory, "hash1");

            await runPrune(cacheDirectory, workspaceRoot, { maxCacheAgeDays: Number.NaN });

            expect(process.exitCode).toBe(1);

            const entries = await collectCacheEntries(cacheDirectory);

            expect(entries).toHaveLength(1);
        } finally {
            process.exitCode = originalExitCode;
        }
    });
});
