import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Cache } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cacheHashExecute, cacheVerifyExecute, cacheWhyExecute, collectCacheEntries, formatAge, runClean, runHash, runPrune, runWhy } from "../src/commands/cache/handler";

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

    it("returns 0s when mtime is in the future (clock skew)", () => {
        expect.assertions(1);

        // Cache files written with mtimes in the future (e.g. after a clock
        // resync, or when a network-mounted cache straddles timezones) must
        // not render as "-Ns" — clamp to 0s so the table column stays clean.
        const now = 1_700_000_000_000;
        const mtime = now + 60 * 1000;

        expect(formatAge(mtime, now)).toBe("0s");
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

    it("keeps only the N most recent entries when --keep-last is set", async () => {
        expect.assertions(2);

        const now = Date.now();

        // mtimes spaced one minute apart so sort is deterministic.
        writeCacheEntry(cacheDirectory, "oldest", { mtime: new Date(now - 4 * 60 * 1000) });
        writeCacheEntry(cacheDirectory, "old", { mtime: new Date(now - 3 * 60 * 1000) });
        writeCacheEntry(cacheDirectory, "newer", { mtime: new Date(now - 2 * 60 * 1000) });
        writeCacheEntry(cacheDirectory, "newest", { mtime: new Date(now - 1 * 60 * 1000) });

        await runPrune(cacheDirectory, workspaceRoot, { keepLast: 2 });

        const entries = await collectCacheEntries(cacheDirectory);
        const hashes = entries.map((entry) => entry.hash).sort();

        expect(entries).toHaveLength(2);
        expect(hashes).toStrictEqual(["newer", "newest"]);
    });

    it("does nothing when --keep-last exceeds entry count", async () => {
        expect.assertions(1);

        writeCacheEntry(cacheDirectory, "a");
        writeCacheEntry(cacheDirectory, "b");

        await runPrune(cacheDirectory, workspaceRoot, { keepLast: 10 });

        const entries = await collectCacheEntries(cacheDirectory);

        expect(entries).toHaveLength(2);
    });

    it("rejects negative --keep-last and sets exit code 1", async () => {
        expect.assertions(2);

        const originalExitCode = process.exitCode;

        try {
            writeCacheEntry(cacheDirectory, "hash1");

            await runPrune(cacheDirectory, workspaceRoot, { keepLast: -1 });

            expect(process.exitCode).toBe(1);

            const entries = await collectCacheEntries(cacheDirectory);

            expect(entries).toHaveLength(1);
        } finally {
            process.exitCode = originalExitCode;
        }
    });

    it("rejects non-integer --keep-last and sets exit code 1", async () => {
        expect.assertions(2);

        const originalExitCode = process.exitCode;

        try {
            writeCacheEntry(cacheDirectory, "hash1");

            await runPrune(cacheDirectory, workspaceRoot, { keepLast: 2.5 });

            expect(process.exitCode).toBe(1);

            const entries = await collectCacheEntries(cacheDirectory);

            expect(entries).toHaveLength(1);
        } finally {
            process.exitCode = originalExitCode;
        }
    });

    it("combines --keep-last with --max-age-days (keep-last applies first)", async () => {
        // Keep-last carves the cache down by recency before age eviction
        // runs, so a young entry below the count cap survives even if
        // older siblings would have been evicted by age.
        expect.assertions(1);

        const now = Date.now();
        const fortyDaysAgo = new Date(now - 40 * 24 * 60 * 60 * 1000);

        writeCacheEntry(cacheDirectory, "ancient", { mtime: fortyDaysAgo });
        writeCacheEntry(cacheDirectory, "recent");

        await runPrune(cacheDirectory, workspaceRoot, { keepLast: 1, maxCacheAgeDays: 7 });

        const entries = await collectCacheEntries(cacheDirectory);
        const hashes = entries.map((entry) => entry.hash);

        expect(hashes).toStrictEqual(["recent"]);
    });
});

/**
 * Minimal mock console capturing stdout/stderr so test assertions can
 * inspect what the command rendered. Production handlers use the
 * `Console` shape from cerebro for `logger.info` calls.
 */
const createMockLogger = (): { info: (message: string) => void; lines: string[] } => {
    const lines: string[] = [];

    return {
        info: (message: string) => lines.push(message),
        lines,
    };
};

const writeRunSummary = (workspaceRoot: string, summary: { duration?: number; endTime?: string; environment?: Record<string, unknown>; id: string; startTime?: string; stats?: Record<string, number>; taskGraph?: Record<string, unknown>; tasks: unknown[] }): void => {
    const runsDir = join(workspaceRoot, ".task-runner", "runs");

    mkdirSync(runsDir, { recursive: true });

    const filled = {
        duration: 1000,
        endTime: new Date().toISOString(),
        environment: { arch: "x64", nodeVersion: "v22.0.0", platform: "linux" },
        startTime: new Date().toISOString(),
        stats: { cached: 0, failed: 0, skipped: 0, succeeded: 1, total: 1 },
        taskGraph: { dependencies: {}, roots: [] },
        ...summary,
    };

    writeFileSync(join(runsDir, `${summary.id}.json`), JSON.stringify(filled));
};

const writeLastSummary = (workspaceRoot: string, summary: Parameters<typeof writeRunSummary>[1]): void => {
    const dir = join(workspaceRoot, ".task-runner");

    mkdirSync(dir, { recursive: true });

    const filled = {
        duration: 1000,
        endTime: new Date().toISOString(),
        environment: { arch: "x64", nodeVersion: "v22.0.0", platform: "linux" },
        startTime: new Date().toISOString(),
        stats: { cached: 0, failed: 0, skipped: 0, succeeded: 1, total: 1 },
        taskGraph: { dependencies: {}, roots: [] },
        ...summary,
    };

    writeFileSync(join(dir, "last-summary.json"), JSON.stringify(filled));
};

const buildTaskSummary = (overrides: Partial<{ cacheStatus: "HIT" | "MISS" | "REMOTE_HIT" | "SKIPPED"; hash: string; hashDetails: { command: string; implicitDeps?: Record<string, string>; nodes: Record<string, string>; runtime?: Record<string, string> }; taskId: string }> = {}): Record<string, unknown> => {
    return {
        cacheable: true,
        cacheStatus: "MISS",
        dependencies: [],
        duration: 100,
        endTime: new Date().toISOString(),
        exitCode: 0,
        hash: "hashA",
        hashDetails: {
            command: "cmdA",
            nodes: { "src/index.ts": "node1" },
            runtime: {},
        },
        outputs: [],
        startTime: new Date().toISOString(),
        target: { project: "app", target: "build" },
        taskId: "app:build",
        ...overrides,
    };
};

describe(runWhy, () => {
    let workspaceRoot: string;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-cache-why-ws-"));
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
        stdoutSpy.mockRestore();
        process.exitCode = 0;
    });

    it("exits with 1 when no last summary exists", async () => {
        expect.assertions(1);

        const logger = createMockLogger();

        await runWhy("app:build", { format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        expect(process.exitCode).toBe(1);
    });

    it("emits JSON error when --json + no summary", async () => {
        expect.assertions(2);

        const logger = createMockLogger();

        await runWhy("app:build", { format: "json", runId: undefined, workspaceRoot }, logger as unknown as Console);

        expect(process.exitCode).toBe(1);

        const written = (stdoutSpy.mock.calls[0]?.[0] ?? "") as string;
        const parsed = JSON.parse(written);

        expect(parsed).toMatchObject({ error: "no-summary", taskId: "app:build" });
    });

    it("exits with 1 when task is not in summary", async () => {
        expect.assertions(1);

        writeLastSummary(workspaceRoot, { id: "run-1", tasks: [buildTaskSummary({ taskId: "app:build" })] });

        const logger = createMockLogger();

        await runWhy("missing:test", { format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        expect(process.exitCode).toBe(1);
    });

    it("renders task hash + status when summary has only one run", async () => {
        expect.assertions(2);

        writeLastSummary(workspaceRoot, { id: "run-1", tasks: [buildTaskSummary({ hash: "abc123def456", taskId: "app:build" })] });

        const logger = createMockLogger();

        await runWhy("app:build", { format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        const text = logger.lines.join("\n");

        expect(text).toContain("abc123def456");
        expect(text).toContain("MISS");
    });

    it("diffs hash inputs against the previous run", async () => {
        expect.assertions(3);

        // Previous run: command=cmdA, node=node1
        writeRunSummary(workspaceRoot, {
            id: "run-old",
            tasks: [
                buildTaskSummary({
                    hash: "old",
                    hashDetails: { command: "cmdA", nodes: { "src/index.ts": "node1" }, runtime: {} },
                    taskId: "app:build",
                }),
            ],
        });

        // Sleep tiny bit to ensure mtime ordering between run files.
        const now = Date.now();

        utimesSync(join(workspaceRoot, ".task-runner", "runs", "run-old.json"), new Date(now - 60 * 1000), new Date(now - 60 * 1000));

        // Current run: command changed, node value rotated, new node added
        writeLastSummary(workspaceRoot, {
            id: "run-new",
            tasks: [
                buildTaskSummary({
                    hash: "new",
                    hashDetails: {
                        command: "cmdB",
                        nodes: { "src/added.ts": "node-new", "src/index.ts": "node1-changed" },
                        runtime: { NODE_ENV: "envHash" },
                    },
                    taskId: "app:build",
                }),
            ],
        });

        const logger = createMockLogger();

        await runWhy("app:build", { format: "json", runId: undefined, workspaceRoot }, logger as unknown as Console);

        const written = (stdoutSpy.mock.calls.at(-1)?.[0] ?? "") as string;
        const parsed = JSON.parse(written);

        expect(parsed.diff.commandChanged).toBe(true);
        expect(parsed.diff.nodes.changed).toContain("src/index.ts");
        expect(parsed.diff.nodes.added).toContain("src/added.ts");
    });

    it("loads a specific run via --run", async () => {
        expect.assertions(1);

        writeRunSummary(workspaceRoot, { id: "run-target", tasks: [buildTaskSummary({ hash: "target-hash", taskId: "app:build" })] });

        const logger = createMockLogger();

        await runWhy("app:build", { format: "json", runId: "run-target", workspaceRoot }, logger as unknown as Console);

        const written = (stdoutSpy.mock.calls.at(-1)?.[0] ?? "") as string;
        const parsed = JSON.parse(written);

        expect(parsed.task.hash).toBe("target-hash");
    });
});

describe(runHash, () => {
    let workspaceRoot: string;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-cache-hash-ws-"));
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
        stdoutSpy.mockRestore();
        process.exitCode = 0;
    });

    it("exits with 1 when no last summary exists", async () => {
        expect.assertions(1);

        const logger = createMockLogger();

        await runHash("app:build", { format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        expect(process.exitCode).toBe(1);
    });

    it("renders hash + per-bucket details for a known task", async () => {
        expect.assertions(3);

        writeLastSummary(workspaceRoot, {
            id: "run-1",
            tasks: [
                buildTaskSummary({
                    hash: "fullhash",
                    hashDetails: {
                        command: "commandhash",
                        implicitDeps: { lockfile: "lockhash" },
                        nodes: { "src/a.ts": "nodeA" },
                        runtime: { NODE_ENV: "envhash" },
                    },
                    taskId: "app:build",
                }),
            ],
        });

        const logger = createMockLogger();

        await runHash("app:build", { format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        const text = logger.lines.join("\n");

        expect(text).toContain("fullhash");
        expect(text).toContain("src/a.ts");
        expect(text).toContain("NODE_ENV");
    });

    it("emits JSON with hashDetails when --json is set", async () => {
        expect.assertions(2);

        writeLastSummary(workspaceRoot, {
            id: "run-1",
            tasks: [
                buildTaskSummary({
                    hash: "h1",
                    hashDetails: { command: "c1", nodes: { "f.ts": "n1" }, runtime: {} },
                    taskId: "app:build",
                }),
            ],
        });

        const logger = createMockLogger();

        await runHash("app:build", { format: "json", runId: undefined, workspaceRoot }, logger as unknown as Console);

        const written = (stdoutSpy.mock.calls.at(-1)?.[0] ?? "") as string;
        const parsed = JSON.parse(written);

        expect(parsed.hash).toBe("h1");
        expect(parsed.hashDetails.nodes["f.ts"]).toBe("n1");
    });

    it("indicates truncation on long hash values with a trailing ellipsis", async () => {
        expect.assertions(2);

        // 64-char hex hash — render path should slice to 16 + "…"
        writeLastSummary(workspaceRoot, {
            id: "run-1",
            tasks: [
                buildTaskSummary({
                    hash: "fullhash",
                    hashDetails: {
                        command: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                        nodes: { "src/index.ts": "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210" },
                        runtime: {},
                    },
                    taskId: "app:build",
                }),
            ],
        });

        const logger = createMockLogger();

        await runHash("app:build", { format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        const text = logger.lines.join("\n");

        expect(text).toContain("0123456789abcdef…");
        expect(text).toContain("fedcba9876543210…");
    });

    it("does not append ellipsis to short hash values", async () => {
        expect.assertions(1);

        writeLastSummary(workspaceRoot, {
            id: "run-1",
            tasks: [
                buildTaskSummary({
                    hash: "short",
                    hashDetails: { command: "tinycmd", nodes: { "f.ts": "tiny" }, runtime: {} },
                    taskId: "app:build",
                }),
            ],
        });

        const logger = createMockLogger();

        await runHash("app:build", { format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        const text = logger.lines.join("\n");

        expect(text).not.toContain("…");
    });
});

describe(cacheWhyExecute, () => {
    let workspaceRoot: string;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-cache-why-exec-"));
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
        stdoutSpy.mockRestore();
        process.exitCode = 0;
    });

    it("exits with 1 when no task ID is provided", async () => {
        expect.assertions(1);

        const logger = createMockLogger();

        await cacheWhyExecute({
            argument: [],
            logger: logger as unknown as Console,
            options: { format: undefined, run: undefined },
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(process.exitCode).toBe(1);
    });

    it("forwards a known task ID to runWhy and renders human output by default", async () => {
        expect.assertions(1);

        writeLastSummary(workspaceRoot, { id: "run-1", tasks: [buildTaskSummary({ hash: "fwd-hash", taskId: "app:build" })] });

        const logger = createMockLogger();

        await cacheWhyExecute({
            argument: ["app:build"],
            logger: logger as unknown as Console,
            options: { format: undefined, run: undefined },
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(logger.lines.join("\n")).toContain("fwd-hash");
    });
});

describe(cacheHashExecute, () => {
    let workspaceRoot: string;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-cache-hash-exec-"));
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
        stdoutSpy.mockRestore();
        process.exitCode = 0;
    });

    it("exits with 1 when no task ID is provided", async () => {
        expect.assertions(1);

        const logger = createMockLogger();

        await cacheHashExecute({
            argument: [],
            logger: logger as unknown as Console,
            options: { format: undefined, run: undefined },
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(process.exitCode).toBe(1);
    });

    it("forwards a known task ID to runHash and emits JSON when --json is set", async () => {
        expect.assertions(1);

        writeLastSummary(workspaceRoot, { id: "run-1", tasks: [buildTaskSummary({ hash: "exec-hash", taskId: "app:build" })] });

        const logger = createMockLogger();

        await cacheHashExecute({
            argument: ["app:build"],
            logger: logger as unknown as Console,
            options: { format: "json", run: undefined },
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const written = (stdoutSpy.mock.calls.at(-1)?.[0] ?? "") as string;
        const parsed = JSON.parse(written);

        expect(parsed.hash).toBe("exec-hash");
    });
});

describe(cacheVerifyExecute, () => {
    let workspaceRoot: string;
    let cacheDirectory: string;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    /**
     * Build a real cache entry from a `dist/` tree under `workspaceRoot`,
     * captured at a pinned mtime so verify has a stable baseline. Returns
     * the hash so callers can later restore-and-diff against it.
     */
    const seedCacheEntry = async (taskId: string, hash: string, fileBody: string, mtimeSeconds = 1_700_000_000): Promise<void> => {
        const distributable = join(workspaceRoot, "dist");

        mkdirSync(distributable, { recursive: true });

        await writeFile(join(distributable, "artifact.bin"), fileBody);

        const pinned = new Date(mtimeSeconds * 1000);

        utimesSync(join(distributable, "artifact.bin"), pinned, pinned);

        const cache = new Cache({ cacheDirectory, workspaceRoot });

        await cache.put(hash, "built", ["dist"], 0);
        await cache.setTaskIndex(taskId, hash);
    };

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-cache-verify-exec-"));
        cacheDirectory = join(workspaceRoot, ".task-runner-cache");
        mkdirSync(cacheDirectory, { recursive: true });
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
        stdoutSpy.mockRestore();
        process.exitCode = 0;
    });

    it("exits with 1 when no task ID is provided", async () => {
        expect.assertions(1);

        const logger = createMockLogger();

        await cacheVerifyExecute({
            argument: [],
            logger: logger as unknown as Console,
            options: { "cache-dir": cacheDirectory, format: undefined, scope: undefined },
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(process.exitCode).toBe(1);
    });

    it("emits a JSON 'no-cached-entry' error when the task is unknown", async () => {
        expect.assertions(2);

        const logger = createMockLogger();

        await cacheVerifyExecute({
            argument: ["app:build"],
            logger: logger as unknown as Console,
            options: { "cache-dir": cacheDirectory, format: "json", scope: undefined },
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(process.exitCode).toBe(1);

        const written = (stdoutSpy.mock.calls.at(-1)?.[0] ?? "") as string;
        const parsed = JSON.parse(written);

        expect(parsed).toMatchObject({ error: "no-cached-entry", taskId: "app:build" });
    });

    it("reports status: 'ok' when the cached entry matches the workspace", async () => {
        expect.assertions(3);

        await seedCacheEntry("app:build", "verify-ok", "hello");

        const logger = createMockLogger();

        await cacheVerifyExecute({
            argument: ["app:build"],
            logger: logger as unknown as Console,
            options: { "cache-dir": cacheDirectory, format: "json", scope: undefined },
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const written = (stdoutSpy.mock.calls.at(-1)?.[0] ?? "") as string;
        const parsed = JSON.parse(written);

        // Surface the per-file diffs on failure so any future regression
        // points directly at the broken column instead of just "drift".
        expect(parsed.diffs).toStrictEqual([]);
        expect(parsed.status).toBe("ok");
        // Ok path leaves exit code untouched (0 / undefined).
        expect(process.exitCode === 0 || process.exitCode === undefined).toBe(true);
    });

    it("reports status: 'drift' and exit 1 when a workspace file is mutated post-cache", async () => {
        expect.assertions(3);

        await seedCacheEntry("app:build", "verify-drift", "original");

        // Mutate the live file so verify sees content drift.
        await writeFile(join(workspaceRoot, "dist", "artifact.bin"), "tampered");

        const logger = createMockLogger();

        await cacheVerifyExecute({
            argument: ["app:build"],
            logger: logger as unknown as Console,
            options: { "cache-dir": cacheDirectory, format: "json", scope: undefined },
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(process.exitCode).toBe(1);

        const written = (stdoutSpy.mock.calls.at(-1)?.[0] ?? "") as string;
        const parsed = JSON.parse(written);

        expect(parsed.status).toBe("drift");
        expect(parsed.diffs.some((diff: { issues: string[] }) => diff.issues.includes("content"))).toBe(true);
    });

    it("reports a 'missing' diff when a cached output was deleted from the workspace", async () => {
        expect.assertions(3);

        await seedCacheEntry("app:build", "verify-missing", "x");

        rmSync(join(workspaceRoot, "dist", "artifact.bin"), { force: true });

        const logger = createMockLogger();

        await cacheVerifyExecute({
            argument: ["app:build"],
            logger: logger as unknown as Console,
            options: { "cache-dir": cacheDirectory, format: "json", scope: undefined },
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(process.exitCode).toBe(1);

        const written = (stdoutSpy.mock.calls.at(-1)?.[0] ?? "") as string;
        const parsed = JSON.parse(written);

        expect(parsed.status).toBe("drift");
        expect(parsed.diffs.some((diff: { issues: string[] }) => diff.issues.includes("missing"))).toBe(true);
    });
});
