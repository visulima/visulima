import { existsSync, readdirSync, readFileSync } from "node:fs";

import { join } from "@visulima/path";

/**
 * Per-task flakiness statistics aggregated across multiple run summaries.
 */
export interface TaskFlakiness {
    taskId: string;
    project: string;
    target: string;
    /** Total number of times this task appeared in runs. */
    totalRuns: number;
    /** Number of runs where this task failed (exitCode !== 0). */
    failures: number;
    /** Number of runs where this task succeeded. */
    successes: number;
    /** Flakiness rate: failures / totalRuns. */
    flakinessRate: number;
    /** Most recent failure time (ISO 8601), if any. */
    lastFailure?: string;
}

interface RunSummaryFile {
    id: string;
    startTime: string;
    tasks: {
        taskId: string;
        target: { project: string; target: string };
        exitCode?: number;
        cacheStatus: string;
        startTime?: string;
    }[];
}

/**
 * Reads all run summary files from `.task-runner/runs/` and computes
 * per-task flakiness statistics.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @param options - Filtering options.
 * @returns Flakiness stats sorted by rate (most flaky first).
 */
export const analyzeFlakiness = (workspaceRoot: string, options: { minRuns?: number; since?: string } = {}): TaskFlakiness[] => {
    const runsDir = join(workspaceRoot, ".task-runner", "runs");

    if (!existsSync(runsDir)) {
        return [];
    }

    const files = readdirSync(runsDir)
        .filter((f) => f.endsWith(".json"))
        .sort();

    if (files.length === 0) {
        return [];
    }

    const stats = new Map<string, { failures: number; lastFailure?: string; project: string; successes: number; target: string; totalRuns: number }>();

    for (const file of files) {
        let summary: RunSummaryFile;

        try {
            summary = JSON.parse(readFileSync(join(runsDir, file), "utf8")) as RunSummaryFile;
        } catch {
            continue;
        }

        if (options.since && summary.startTime < options.since) {
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
            flakinessRate: data.failures / data.totalRuns,
            failures: data.failures,
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
 *
 * @param stats - Flakiness statistics to format.
 * @returns Lines of formatted output (including header).
 */
export const formatFlakinessTable = (stats: TaskFlakiness[]): string[] => {
    if (stats.length === 0) {
        return ["No flaky tasks detected."];
    }

    const header = ["Task", "Runs", "Failures", "Rate", "Last Failure"];

    const rows = stats.map((s) => [s.taskId, String(s.totalRuns), String(s.failures), `${(s.flakinessRate * 100).toFixed(1)}%`, s.lastFailure ?? "—"]);

    const widths = header.map((h, i) => {
        const maxDataWidth = rows.reduce((max, row) => Math.max(max, (row[i] ?? "").length), 0);

        return Math.max(h.length, maxDataWidth);
    });

    const pad = (str: string, width: number): string => str.padEnd(width);
    const separator = widths.map((w) => "─".repeat(w)).join("──");

    const lines: string[] = [];

    lines.push(header.map((h, i) => pad(h, widths[i]!)).join("  "));
    lines.push(separator);

    for (const row of rows) {
        lines.push(row.map((cell, i) => pad(cell, widths[i]!)).join("  "));
    }

    return lines;
};
