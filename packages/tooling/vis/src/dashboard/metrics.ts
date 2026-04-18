import type { LoadedRunSummary } from "../run-report";

/**
 * High-level dashboard metrics derived from the persisted run history.
 * Everything here is cheap to compute from `.task-runner/runs/*.json` —
 * no filesystem walks beyond what the loader already does.
 */
export interface DashboardMetrics {
    totals: {
        runs: number;
        tasks: number;
        succeeded: number;
        failed: number;
        cached: number;
        skipped: number;
        totalDurationMs: number;
        estimatedTimeSavedMs: number;
    };
    cacheHitRate: number | undefined;
    averageRunDurationMs: number | undefined;
    medianRunDurationMs: number | undefined;
    slowestTasks: TaskMetric[];
    mostCachedTasks: TaskMetric[];
    mostInvalidatedTasks: TaskMetric[];
    hitRateOverTime: TimeSeriesPoint[];
    durationOverTime: TimeSeriesPoint[];
}

export interface TaskMetric {
    taskId: string;
    project: string;
    target: string;
    runs: number;
    hits: number;
    misses: number;
    failures: number;
    hitRate: number;
    averageDurationMs: number;
    timeSavedMs: number;
}

export interface TimeSeriesPoint {
    /** Run start time as ISO 8601. */
    timestamp: string;
    value: number;
}

interface TaskSummaryLike {
    cacheStatus?: string;
    duration?: number;
    exitCode?: number;
    target?: { project: string; target: string };
    taskId?: string;
}

interface RunSummaryShape {
    duration?: number;
    id?: string;
    startTime?: string;
    stats?: {
        cached?: number;
        failed?: number;
        skipped?: number;
        succeeded?: number;
        total?: number;
    };
    tasks?: TaskSummaryLike[];
}

const median = (values: number[]): number | undefined => {
    if (values.length === 0) {
        return undefined;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1]! + sorted[middle]!) / 2;
    }

    return sorted[middle]!;
};

/**
 * Aggregates per-task stats across every run in `summaries`. Each task
 * is keyed by its `taskId` (e.g. `"app:build"`) so stats accumulate
 * across configurations of the same target.
 *
 * `timeSavedMs` uses the task's own average non-cached duration as the
 * baseline for counting a hit's savings — this is a rough estimate but
 * good enough to rank tasks by cache value. Tasks that only ever hit
 * cache contribute zero (we have no baseline to measure against).
 */
const aggregateTaskStats = (summaries: RunSummaryShape[]): Map<string, TaskMetric> => {
    const byTask = new Map<
        string,
        {
            taskId: string;
            project: string;
            target: string;
            runs: number;
            hits: number;
            misses: number;
            failures: number;
            durations: number[];
        }
    >();

    for (const summary of summaries) {
        if (!Array.isArray(summary.tasks)) {
            continue;
        }

        for (const task of summary.tasks) {
            if (!task.taskId) {
                continue;
            }

            const existing = byTask.get(task.taskId) ?? {
                taskId: task.taskId,
                project: task.target?.project ?? "",
                target: task.target?.target ?? "",
                runs: 0,
                hits: 0,
                misses: 0,
                failures: 0,
                durations: [] as number[],
            };

            existing.runs += 1;

            if (task.cacheStatus === "HIT" || task.cacheStatus === "REMOTE_HIT") {
                existing.hits += 1;
            } else if (task.cacheStatus === "MISS") {
                existing.misses += 1;

                if (typeof task.duration === "number" && task.duration > 0) {
                    existing.durations.push(task.duration);
                }

                if (task.exitCode !== undefined && task.exitCode !== 0) {
                    existing.failures += 1;
                }
            }

            byTask.set(task.taskId, existing);
        }
    }

    const metrics = new Map<string, TaskMetric>();

    for (const [taskId, stats] of byTask) {
        const avg = stats.durations.length === 0 ? 0 : stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length;

        metrics.set(taskId, {
            taskId,
            project: stats.project,
            target: stats.target,
            runs: stats.runs,
            hits: stats.hits,
            misses: stats.misses,
            failures: stats.failures,
            hitRate: stats.runs === 0 ? 0 : stats.hits / stats.runs,
            averageDurationMs: avg,
            timeSavedMs: avg * stats.hits,
        });
    }

    return metrics;
};

/**
 * Computes all metrics the dashboard UI renders. The result is plain
 * JSON so it can be serialized straight to the browser without a
 * transform step.
 */
export const computeDashboardMetrics = (summaries: LoadedRunSummary[]): DashboardMetrics => {
    const runs = summaries as unknown as RunSummaryShape[];
    const sortedRuns = [...runs].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

    let totalTasks = 0;
    let succeeded = 0;
    let failed = 0;
    let cached = 0;
    let skipped = 0;
    let totalDurationMs = 0;

    const runDurations: number[] = [];
    const hitRateOverTime: TimeSeriesPoint[] = [];
    const durationOverTime: TimeSeriesPoint[] = [];

    for (const run of sortedRuns) {
        const stats = run.stats ?? {};

        totalTasks += stats.total ?? 0;
        succeeded += stats.succeeded ?? 0;
        failed += stats.failed ?? 0;
        cached += stats.cached ?? 0;
        skipped += stats.skipped ?? 0;

        if (typeof run.duration === "number" && run.duration > 0) {
            totalDurationMs += run.duration;
            runDurations.push(run.duration);

            if (run.startTime) {
                durationOverTime.push({ timestamp: run.startTime, value: run.duration });
            }
        }

        if ((stats.total ?? 0) > 0 && run.startTime) {
            hitRateOverTime.push({
                timestamp: run.startTime,
                value: (stats.cached ?? 0) / (stats.total ?? 1),
            });
        }
    }

    const taskMetrics = aggregateTaskStats(sortedRuns);
    const metricsList = [...taskMetrics.values()];

    const slowestTasks = metricsList
        .filter((t) => t.averageDurationMs > 0)
        .sort((a, b) => b.averageDurationMs - a.averageDurationMs)
        .slice(0, 10);

    const mostCachedTasks = metricsList
        .filter((t) => t.runs >= 2)
        .sort((a, b) => b.timeSavedMs - a.timeSavedMs || b.hitRate - a.hitRate)
        .slice(0, 10);

    const mostInvalidatedTasks = metricsList
        .filter((t) => t.runs >= 3 && t.hits > 0 && t.misses > 0)
        .sort((a, b) => b.misses / b.runs - a.misses / a.runs)
        .slice(0, 10);

    const estimatedTimeSavedMs = metricsList.reduce((sum, t) => sum + t.timeSavedMs, 0);

    return {
        totals: {
            runs: runs.length,
            tasks: totalTasks,
            succeeded,
            failed,
            cached,
            skipped,
            totalDurationMs,
            estimatedTimeSavedMs,
        },
        cacheHitRate: totalTasks === 0 ? undefined : cached / totalTasks,
        averageRunDurationMs: runDurations.length === 0 ? undefined : runDurations.reduce((a, b) => a + b, 0) / runDurations.length,
        medianRunDurationMs: median(runDurations),
        slowestTasks,
        mostCachedTasks,
        mostInvalidatedTasks,
        hitRateOverTime,
        durationOverTime,
    };
};
