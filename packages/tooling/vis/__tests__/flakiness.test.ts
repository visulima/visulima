import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { analyzeFlakiness, formatFlakinessTable } from "../src/report/flakiness";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "./test-helpers";

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

        mkdirSync(join(tmpDir, ".task-runner", "runs"), { recursive: true });

        expect(analyzeFlakiness(tmpDir)).toStrictEqual([]);
    });

    it("should return empty array for non-existent directory", () => {
        expect.assertions(1);

        expect(analyzeFlakiness(tmpDir)).toStrictEqual([]);
    });

    it("should compute correct flakiness stats from multiple runs", () => {
        expect.assertions(7);

        const runsDir = join(tmpDir, ".task-runner", "runs");

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

        const runsDir = join(tmpDir, ".task-runner", "runs");

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

        const runsDir = join(tmpDir, ".task-runner", "runs");

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
});
