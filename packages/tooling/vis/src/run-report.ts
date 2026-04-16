import { existsSync, readdirSync, readFileSync } from "node:fs";

import { join } from "@visulima/path";
import type { TaskResults } from "@visulima/task-runner";

/**
 * Formats a compact one-line timing summary for display after a run.
 * @param results Task execution results.
 * @param durationMs Total wall-clock duration in milliseconds.
 * @returns A formatted summary string, e.g. "3 succeeded · 1 cached · 0 failed · 2.4s"
 */
export const formatTimingSummary = (results: TaskResults, durationMs: number): string => {
    let succeeded = 0;
    let cached = 0;
    let failed = 0;

    for (const [, result] of results) {
        switch (result.status) {
            case "failure": {
                failed += 1;
                break;
            }

            case "local-cache":
            case "local-cache-kept-existing":
            case "remote-cache": {
                cached += 1;
                break;
            }

            case "success": {
                succeeded += 1;
                break;
            }

            default: {
                break;
            }
        }
    }

    const parts: string[] = [];

    if (succeeded > 0) {
        parts.push(`${String(succeeded)} succeeded`);
    }

    if (cached > 0) {
        parts.push(`${String(cached)} cached`);
    }

    if (failed > 0) {
        parts.push(`${String(failed)} failed`);
    }

    const seconds = (durationMs / 1000).toFixed(1);

    parts.push(`${seconds}s`);

    return parts.join(" · ");
};

interface HistoricalRun {
    duration: number;
    startTime: string;
}

/**
 * Loads durations from historical run summaries and computes the
 * average. Returns the comparison string or `undefined` if no history.
 * @param workspaceRoot Workspace root path.
 * @param currentDurationMs Duration of the current run in ms.
 * @returns A human-readable comparison, e.g. "(1.2s faster than avg)" or `undefined`.
 */
export const compareDuration = (workspaceRoot: string, currentDurationMs: number): string | undefined => {
    const runsDir = join(workspaceRoot, ".task-runner", "runs");

    if (!existsSync(runsDir)) {
        return undefined;
    }

    const files = readdirSync(runsDir).filter((f) => f.endsWith(".json"));

    if (files.length < 2) {
        return undefined;
    }

    let totalDuration = 0;
    let count = 0;

    for (const file of files) {
        try {
            const data = JSON.parse(readFileSync(join(runsDir, file), "utf8")) as HistoricalRun;

            if (typeof data.duration === "number" && data.duration > 0) {
                totalDuration += data.duration;
                count += 1;
            }
        } catch {
            continue;
        }
    }

    if (count < 2) {
        return undefined;
    }

    const avgMs = totalDuration / count;
    const diffMs = avgMs - currentDurationMs;
    const absDiffSeconds = Math.abs(diffMs / 1000).toFixed(1);

    if (Math.abs(diffMs) < 500) {
        return "(about average)";
    }

    return diffMs > 0 ? `(${absDiffSeconds}s faster than avg)` : `(${absDiffSeconds}s slower than avg)`;
};
