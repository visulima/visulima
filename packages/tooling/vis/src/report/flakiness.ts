import { loadRunSummaries } from "./run-report";
import type { LoadedRunSummary } from "./types";

/**
 * Per-task flakiness statistics aggregated across multiple run summaries.
 */
export interface TaskFlakiness {
    /** Number of runs where this task failed (exitCode !== 0). */
    failures: number;
    /** Flakiness rate: failures / totalRuns. */
    flakinessRate: number;
    /** Most recent failure time (ISO 8601), if any. */
    lastFailure?: string;
    project: string;
    /** Number of runs where this task succeeded. */
    successes: number;
    target: string;
    taskId: string;
    /** Total number of times this task appeared in runs. */
    totalRuns: number;
}

interface RunSummaryFile {
    id?: string;
    startTime?: string;
    tasks?: {
        cacheStatus: string;
        exitCode?: number;
        startTime?: string;
        target: { project: string; target: string };
        taskId: string;
    }[];
}

/**
 * Reads all run summary files from `.vis/runs/` and computes
 * per-task flakiness statistics.
 *
 * Pass `summaries` (from {@link loadRunSummaries}) when the caller
 * already loaded the history — avoids re-reading every JSON off disk
 * just to get the same data.
 * @param workspaceRoot Absolute path to the workspace root.
 * @param options Filtering options.
 * @param options.minRuns Only include tasks with at least this many runs (default 1).
 * @param options.since ISO date string; ignore runs older than this.
 * @returns Flakiness stats sorted by rate (most flaky first).
 */
export const analyzeFlakiness = (
    workspaceRoot: string,
    options: { minRuns?: number; since?: string } = {},
    summaries?: LoadedRunSummary[],
): TaskFlakiness[] => {
    const history = (summaries ?? loadRunSummaries(workspaceRoot)) as unknown as RunSummaryFile[];

    if (history.length === 0) {
        return [];
    }

    const stats = new Map<string, { failures: number; lastFailure?: string; project: string; successes: number; target: string; totalRuns: number }>();

    for (const summary of history) {
        if (options.since && (summary.startTime === undefined || summary.startTime < options.since)) {
            continue;
        }

        if (!Array.isArray(summary.tasks)) {
            continue;
        }

        for (const task of summary.tasks) {
            // Skip cached tasks — they didn't actually execute
            if (task.cacheStatus === "HIT" || task.cacheStatus === "REMOTE_HIT" || task.cacheStatus === "SKIPPED") {
                continue;
            }

            const existing = stats.get(task.taskId) ?? {
                failures: 0,
                project: task.target.project,
                successes: 0,
                target: task.target.target,
                totalRuns: 0,
            };

            existing.totalRuns += 1;

            if (task.exitCode !== undefined && task.exitCode !== 0) {
                existing.failures += 1;
                existing.lastFailure = task.startTime ?? summary.startTime;
            } else {
                existing.successes += 1;
            }

            stats.set(task.taskId, existing);
        }
    }

    const minRuns = options.minRuns ?? 2;

    const results: TaskFlakiness[] = [];

    for (const [taskId, data] of stats) {
        if (data.totalRuns < minRuns) {
            continue;
        }

        if (data.failures === 0) {
            continue;
        }

        results.push({
            failures: data.failures,
            flakinessRate: data.failures / data.totalRuns,
            lastFailure: data.lastFailure,
            project: data.project,
            successes: data.successes,
            target: data.target,
            taskId,
            totalRuns: data.totalRuns,
        });
    }

    results.sort((a, b) => b.flakinessRate - a.flakinessRate);

    return results;
};

/**
 * Formats flakiness stats as an ASCII table.
 * @param stats Flakiness statistics to format.
 * @returns Lines of formatted output (including header).
 */
export const formatFlakinessTable = (stats: TaskFlakiness[]): string[] => {
    if (stats.length === 0) {
        return ["No flaky tasks detected."];
    }

    const header = ["Task", "Runs", "Failures", "Rate", "Last Failure"];

    const rows = stats.map((s) => [s.taskId, String(s.totalRuns), String(s.failures), `${(s.flakinessRate * 100).toFixed(1)}%`, s.lastFailure ?? "—"]);

    const widths = header.map((h, i) => {
        let maxDataWidth = 0;

        for (const row of rows) {
            maxDataWidth = Math.max(maxDataWidth, (row[i] ?? "").length);
        }

        return Math.max(h.length, maxDataWidth);
    });

    const pad = (str: string, width: number): string => str.padEnd(width);
    const separator = widths.map((w) => "─".repeat(w)).join("──");

    const lines: string[] = [header.map((h, i) => pad(h, widths[i]!)).join("  "), separator];

    for (const row of rows) {
        lines.push(row.map((cell, i) => pad(cell, widths[i]!)).join("  "));
    }

    return lines;
};
