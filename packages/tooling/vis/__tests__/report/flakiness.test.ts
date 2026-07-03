import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { analyzeFlakiness, formatFlakinessTable } from "../../src/report/flakiness";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

describe(analyzeFlakiness, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-flakiness-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    it("should return empty array for empty runs directory", () => {
        expect.assertions(1);

        mkdirSync(join(tmpDir, ".vis", "runs"), { recursive: true });

        expect(analyzeFlakiness(tmpDir)).toStrictEqual([]);
    });

    it("should return empty array for non-existent directory", () => {
        expect.assertions(1);

        expect(analyzeFlakiness(tmpDir)).toStrictEqual([]);
    });

    it("should compute correct flakiness stats from multiple runs", () => {
        expect.assertions(7);

        const runsDir = join(tmpDir, ".vis", "runs");

        mkdirSync(runsDir, { recursive: true });

        const run1 = {
            id: "run-1",
            startTime: "2026-01-01T00:00:00Z",
            tasks: [
                { cacheStatus: "MISS", exitCode: 0, startTime: "2026-01-01T00:00:01Z", target: { project: "a", target: "build" }, taskId: "a:build" },
                { cacheStatus: "MISS", exitCode: 1, startTime: "2026-01-01T00:00:02Z", target: { project: "b", target: "test" }, taskId: "b:test" },
            ],
        };

        const run2 = {
            id: "run-2",
            startTime: "2026-01-02T00:00:00Z",
            tasks: [
                { cacheStatus: "MISS", exitCode: 1, startTime: "2026-01-02T00:00:01Z", target: { project: "a", target: "build" }, taskId: "a:build" },
                { cacheStatus: "MISS", exitCode: 0, startTime: "2026-01-02T00:00:02Z", target: { project: "b", target: "test" }, taskId: "b:test" },
            ],
        };

        const run3 = {
            id: "run-3",
            startTime: "2026-01-03T00:00:00Z",
            tasks: [
                { cacheStatus: "MISS", exitCode: 0, startTime: "2026-01-03T00:00:01Z", target: { project: "a", target: "build" }, taskId: "a:build" },
                { cacheStatus: "MISS", exitCode: 1, startTime: "2026-01-03T00:00:02Z", target: { project: "b", target: "test" }, taskId: "b:test" },
            ],
        };

        writeFileSync(join(runsDir, "run-1.json"), JSON.stringify(run1));
        writeFileSync(join(runsDir, "run-2.json"), JSON.stringify(run2));
        writeFileSync(join(runsDir, "run-3.json"), JSON.stringify(run3));

        const stats = analyzeFlakiness(tmpDir);

        expect(stats).toHaveLength(2);

        const bTest = stats.find((s) => s.taskId === "b:test")!;

        expect(bTest.totalRuns).toBe(3);
        expect(bTest.failures).toBe(2);
        expect(bTest.flakinessRate).toBeCloseTo(2 / 3);

        const aBuild = stats.find((s) => s.taskId === "a:build")!;

        expect(aBuild.totalRuns).toBe(3);
        expect(aBuild.failures).toBe(1);
        expect(aBuild.flakinessRate).toBeCloseTo(1 / 3);
    });

    it("should exclude tasks below the default minRuns threshold", () => {
        expect.assertions(1);

        const runsDir = join(tmpDir, ".vis", "runs");

        mkdirSync(runsDir, { recursive: true });

        const run1 = {
            id: "run-1",
            startTime: "2026-01-01T00:00:00Z",
            tasks: [{ cacheStatus: "MISS", exitCode: 1, startTime: "2026-01-01T00:00:01Z", target: { project: "x", target: "lint" }, taskId: "x:lint" }],
        };

        writeFileSync(join(runsDir, "run-1.json"), JSON.stringify(run1));

        const stats = analyzeFlakiness(tmpDir);

        expect(stats).toStrictEqual([]);
    });

    it("should exclude runs older than the since filter", () => {
        expect.assertions(2);

        const runsDir = join(tmpDir, ".vis", "runs");

        mkdirSync(runsDir, { recursive: true });

        const oldRun = {
            id: "run-old",
            startTime: "2025-01-01T00:00:00Z",
            tasks: [{ cacheStatus: "MISS", exitCode: 1, startTime: "2025-01-01T00:00:01Z", target: { project: "a", target: "build" }, taskId: "a:build" }],
        };

        const newRun1 = {
            id: "run-new-1",
            startTime: "2026-06-01T00:00:00Z",
            tasks: [{ cacheStatus: "MISS", exitCode: 1, startTime: "2026-06-01T00:00:01Z", target: { project: "a", target: "build" }, taskId: "a:build" }],
        };

        const newRun2 = {
            id: "run-new-2",
            startTime: "2026-06-02T00:00:00Z",
            tasks: [{ cacheStatus: "MISS", exitCode: 0, startTime: "2026-06-02T00:00:01Z", target: { project: "a", target: "build" }, taskId: "a:build" }],
        };

        writeFileSync(join(runsDir, "run-old.json"), JSON.stringify(oldRun));
        writeFileSync(join(runsDir, "run-new-1.json"), JSON.stringify(newRun1));
        writeFileSync(join(runsDir, "run-new-2.json"), JSON.stringify(newRun2));

        const stats = analyzeFlakiness(tmpDir, { since: "2026-01-01T00:00:00Z" });

        expect(stats).toHaveLength(1);
        expect(stats[0]!.totalRuns).toBe(2);
    });
});

describe(formatFlakinessTable, () => {
    it("should return no-flaky message for empty stats", () => {
        expect.assertions(1);

        expect(formatFlakinessTable([])).toStrictEqual(["No flaky tasks detected."]);
    });

    it("should produce a table with header containing Task, Runs, and Rate", () => {
        expect.assertions(4);

        const lines = formatFlakinessTable([
            {
                failures: 3,
                flakinessRate: 0.3,
                lastFailure: "2026-01-05T00:00:00Z",
                project: "x",
                retriedSuccesses: 0,
                successes: 7,
                target: "build",
                taskId: "x:build",
                totalRuns: 10,
            },
        ]);

        expect(lines.length).toBeGreaterThanOrEqual(3);
        expect(lines[0]).toContain("Task");
        expect(lines[0]).toContain("Runs");
        expect(lines[0]).toContain("Rate");
    });

    it("should include the Retried column when retriedSuccesses are present", () => {
        expect.assertions(2);

        const lines = formatFlakinessTable([
            {
                failures: 1,
                flakinessRate: 0.25,
                lastRetry: "2026-01-06T00:00:00Z",
                project: "x",
                retriedSuccesses: 2,
                successes: 6,
                target: "test",
                taskId: "x:test",
                totalRuns: 8,
            },
        ]);

        expect(lines[0]).toContain("Retried");
        expect(lines.some((line) => line.includes(" 2 "))).toBe(true);
    });
});

describe("analyzeFlakiness with retried-but-passed runs", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-flakiness-retry-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    it("should flag a task as flaky when it passes only after retries", () => {
        expect.assertions(5);

        const runsDir = join(tmpDir, ".vis", "runs");

        mkdirSync(runsDir, { recursive: true });

        // Both runs pass cleanly from the user's perspective, but one needed
        // a restart to get there — the report should still surface this.
        const run1 = {
            id: "run-1",
            startTime: "2026-02-01T00:00:00Z",
            tasks: [
                {
                    cacheStatus: "MISS",
                    exitCode: 0,
                    retryAttempts: 2,
                    startTime: "2026-02-01T00:00:01Z",
                    target: { project: "z", target: "test" },
                    taskId: "z:test",
                },
            ],
        };

        const run2 = {
            id: "run-2",
            startTime: "2026-02-02T00:00:00Z",
            tasks: [
                {
                    cacheStatus: "MISS",
                    exitCode: 0,
                    startTime: "2026-02-02T00:00:01Z",
                    target: { project: "z", target: "test" },
                    taskId: "z:test",
                },
            ],
        };

        writeFileSync(join(runsDir, "run-1.json"), JSON.stringify(run1));
        writeFileSync(join(runsDir, "run-2.json"), JSON.stringify(run2));

        const stats = analyzeFlakiness(tmpDir);

        expect(stats).toHaveLength(1);
        expect(stats[0]!.failures).toBe(0);
        expect(stats[0]!.retriedSuccesses).toBe(1);
        expect(stats[0]!.successes).toBe(2);
        // Half-weighted: (0 failures + 0.5 * 1 retry) / 2 runs = 0.25
        expect(stats[0]!.flakinessRate).toBeCloseTo(0.25);
    });

    it("should not flag a task with only clean (zero-retry) runs", () => {
        expect.assertions(1);

        const runsDir = join(tmpDir, ".vis", "runs");

        mkdirSync(runsDir, { recursive: true });

        const run1 = {
            id: "run-1",
            startTime: "2026-02-01T00:00:00Z",
            tasks: [
                {
                    cacheStatus: "MISS",
                    exitCode: 0,
                    startTime: "2026-02-01T00:00:01Z",
                    target: { project: "z", target: "test" },
                    taskId: "z:test",
                },
            ],
        };

        const run2 = {
            id: "run-2",
            startTime: "2026-02-02T00:00:00Z",
            tasks: [
                {
                    cacheStatus: "MISS",
                    exitCode: 0,
                    startTime: "2026-02-02T00:00:01Z",
                    target: { project: "z", target: "test" },
                    taskId: "z:test",
                },
            ],
        };

        writeFileSync(join(runsDir, "run-1.json"), JSON.stringify(run1));
        writeFileSync(join(runsDir, "run-2.json"), JSON.stringify(run2));

        expect(analyzeFlakiness(tmpDir)).toStrictEqual([]);
    });
});
