import { describe, expect, it } from "vitest";

import { computeDashboardMetrics } from "../src/dashboard/metrics";

const makeRun = (id: string, startTime: string, duration: number, stats: Record<string, number>, tasks: unknown[] = []): any => ({
    id,
    startTime,
    duration,
    stats,
    tasks,
});

describe(computeDashboardMetrics, () => {
    it("returns zeroed totals for an empty history", () => {
        expect.assertions(3);

        const metrics = computeDashboardMetrics([]);

        expect(metrics.totals.runs).toBe(0);
        expect(metrics.cacheHitRate).toBeNull();
        expect(metrics.slowestTasks).toStrictEqual([]);
    });

    it("computes cache hit rate across runs", () => {
        expect.assertions(2);

        const metrics = computeDashboardMetrics([
            makeRun("r1", "2026-01-01", 1000, { total: 4, cached: 2, succeeded: 2, failed: 0, skipped: 0 }),
            makeRun("r2", "2026-01-02", 1200, { total: 6, cached: 4, succeeded: 2, failed: 0, skipped: 0 }),
        ]);

        expect(metrics.totals.tasks).toBe(10);
        expect(metrics.cacheHitRate).toBeCloseTo(0.6, 2);
    });

    it("orders slowest tasks by average duration", () => {
        expect.assertions(2);

        const runs = [
            makeRun("r1", "2026-01-01", 5000, { total: 2, cached: 0 }, [
                { taskId: "a:build", cacheStatus: "MISS", duration: 4000, target: { project: "a", target: "build" } },
                { taskId: "b:build", cacheStatus: "MISS", duration: 1000, target: { project: "b", target: "build" } },
            ]),
            makeRun("r2", "2026-01-02", 5000, { total: 2, cached: 0 }, [
                { taskId: "a:build", cacheStatus: "MISS", duration: 4200, target: { project: "a", target: "build" } },
                { taskId: "b:build", cacheStatus: "MISS", duration: 1200, target: { project: "b", target: "build" } },
            ]),
        ];

        const metrics = computeDashboardMetrics(runs);

        expect(metrics.slowestTasks[0]?.taskId).toBe("a:build");
        expect(metrics.slowestTasks[1]?.taskId).toBe("b:build");
    });

    it("estimates time saved by caching using average MISS duration as the baseline", () => {
        expect.assertions(1);

        const runs = [
            makeRun("r1", "2026-01-01", 3000, { total: 1, cached: 0 }, [
                { taskId: "a:build", cacheStatus: "MISS", duration: 2000, target: { project: "a", target: "build" } },
            ]),
            makeRun("r2", "2026-01-02", 100, { total: 1, cached: 1 }, [
                { taskId: "a:build", cacheStatus: "HIT", duration: 10, target: { project: "a", target: "build" } },
            ]),
            makeRun("r3", "2026-01-03", 100, { total: 1, cached: 1 }, [
                { taskId: "a:build", cacheStatus: "HIT", duration: 12, target: { project: "a", target: "build" } },
            ]),
        ];

        const metrics = computeDashboardMetrics(runs);

        // 2 hits × 2000 ms baseline = 4000ms saved
        expect(metrics.totals.estimatedTimeSavedMs).toBeCloseTo(4000, 0);
    });

    it("produces time-series points sorted by run start time", () => {
        expect.assertions(2);

        const runs = [
            makeRun("r2", "2026-01-02", 1200, { total: 4, cached: 2 }),
            makeRun("r1", "2026-01-01", 1000, { total: 2, cached: 1 }),
        ];

        const metrics = computeDashboardMetrics(runs);

        expect(metrics.hitRateOverTime[0]?.timestamp).toBe("2026-01-01");
        expect(metrics.hitRateOverTime[1]?.timestamp).toBe("2026-01-02");
    });

    it("identifies most invalidated tasks", () => {
        expect.assertions(1);

        const runs = Array.from({ length: 5 }, (_, i) =>
            makeRun(`r${String(i)}`, `2026-01-0${String(i + 1)}`, 1000, { total: 2, cached: 0 }, [
                {
                    taskId: "flaky:build",
                    cacheStatus: i % 2 === 0 ? "MISS" : "HIT",
                    duration: 500,
                    target: { project: "flaky", target: "build" },
                },
                {
                    taskId: "stable:build",
                    cacheStatus: i === 0 ? "MISS" : "HIT",
                    duration: 500,
                    target: { project: "stable", target: "build" },
                },
            ]),
        );

        const metrics = computeDashboardMetrics(runs);

        expect(metrics.mostInvalidatedTasks[0]?.taskId).toBe("flaky:build");
    });
});
