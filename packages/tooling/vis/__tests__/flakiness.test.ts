import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { analyzeFlakiness, formatFlakinessTable } from "../src/flakiness";

describe(analyzeFlakiness, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-flakiness-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should return an empty array for an empty runs directory", () => {
        expect.assertions(1);

        mkdirSync(join(tmpDir, ".task-runner", "runs"), { recursive: true });

        expect(analyzeFlakiness(tmpDir)).toStrictEqual([]);
    });

    it("should return an empty array for a non-existent directory", () => {
        expect.assertions(1);

        expect(analyzeFlakiness(join(tmpDir, "does-not-exist"))).toStrictEqual([]);
    });

    it("should compute correct flakiness stats from multiple runs", () => {
        expect.assertions(5);

        const runsDir = join(tmpDir, ".task-runner", "runs");

        mkdirSync(runsDir, { recursive: true });

        const run1 = {
            id: "run-1",
            startTime: "2026-01-01T00:00:00Z",
            tasks: [
                { taskId: "a:build", target: { project: "a", target: "build" }, exitCode: 0, cacheStatus: "MISS", startTime: "2026-01-01T00:00:01Z" },
                { taskId: "b:test", target: { project: "b", target: "test" }, exitCode: 1, cacheStatus: "MISS", startTime: "2026-01-01T00:00:02Z" },
            ],
        };

        const run2 = {
            id: "run-2",
            startTime: "2026-01-02T00:00:00Z",
            tasks: [
                { taskId: "a:build", target: { project: "a", target: "build" }, exitCode: 1, cacheStatus: "MISS", startTime: "2026-01-02T00:00:01Z" },
                { taskId: "b:test", target: { project: "b", target: "test" }, exitCode: 0, cacheStatus: "MISS", startTime: "2026-01-02T00:00:02Z" },
            ],
        };

        const run3 = {
            id: "run-3",
            startTime: "2026-01-03T00:00:00Z",
            tasks: [
                { taskId: "a:build", target: { project: "a", target: "build" }, exitCode: 0, cacheStatus: "MISS", startTime: "2026-01-03T00:00:01Z" },
                { taskId: "b:test", target: { project: "b", target: "test" }, exitCode: 1, cacheStatus: "MISS", startTime: "2026-01-03T00:00:02Z" },
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

        expect(aBuild.flakinessRate).toBeCloseTo(1 / 3);
    });

    it("should exclude tasks below the default minRuns threshold", () => {
        expect.assertions(1);

        const runsDir = join(tmpDir, ".task-runner", "runs");

        mkdirSync(runsDir, { recursive: true });

        const run1 = {
            id: "run-1",
            startTime: "2026-01-01T00:00:00Z",
            tasks: [
                { taskId: "c:lint", target: { project: "c", target: "lint" }, exitCode: 1, cacheStatus: "MISS", startTime: "2026-01-01T00:00:01Z" },
            ],
        };

        writeFileSync(join(runsDir, "run-1.json"), JSON.stringify(run1));

        const stats = analyzeFlakiness(tmpDir);

        expect(stats).toStrictEqual([]);
    });

    it("should exclude runs older than the since filter", () => {
        expect.assertions(1);

        const runsDir = join(tmpDir, ".task-runner", "runs");

        mkdirSync(runsDir, { recursive: true });

        const oldRun = {
            id: "run-old",
            startTime: "2025-01-01T00:00:00Z",
            tasks: [
                { taskId: "d:build", target: { project: "d", target: "build" }, exitCode: 1, cacheStatus: "MISS", startTime: "2025-01-01T00:00:01Z" },
            ],
        };

        const newRun = {
            id: "run-new",
            startTime: "2026-06-01T00:00:00Z",
            tasks: [
                { taskId: "d:build", target: { project: "d", target: "build" }, exitCode: 1, cacheStatus: "MISS", startTime: "2026-06-01T00:00:01Z" },
            ],
        };

        writeFileSync(join(runsDir, "run-old.json"), JSON.stringify(oldRun));
        writeFileSync(join(runsDir, "run-new.json"), JSON.stringify(newRun));

        const stats = analyzeFlakiness(tmpDir, { minRuns: 1, since: "2026-01-01T00:00:00Z" });

        expect(stats).toHaveLength(1);
    });
});

describe(formatFlakinessTable, () => {
    it("should return a single message for empty stats", () => {
        expect.assertions(1);

        expect(formatFlakinessTable([])).toStrictEqual(["No flaky tasks detected."]);
    });

    it("should produce a table with header containing Task, Runs, and Rate", () => {
        expect.assertions(3);

        const lines = formatFlakinessTable([
            {
                taskId: "x:build",
                project: "x",
                target: "build",
                totalRuns: 10,
                failures: 3,
                successes: 7,
                flakinessRate: 0.3,
                lastFailure: "2026-01-05T00:00:00Z",
            },
        ]);

        expect(lines[0]).toContain("Task");
        expect(lines[0]).toContain("Runs");
        expect(lines[0]).toContain("Rate");
    });
});
