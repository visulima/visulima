import { readdirSync } from "node:fs";

import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import type { TaskResults } from "@visulima/task-runner";

import type { LoadedRunSummary } from "./types";

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

/**
 * Reads every `.task-runner/runs/*.json` once and returns the parsed
 * array. Callers that need to iterate historical runs (timing average,
 * flakiness analysis) should call this once per command and feed the
 * result into the downstream helpers rather than re-reading the
 * directory multiple times.
 *
 * Corrupt or unreadable files are skipped silently — a single bad
 * summary shouldn't take down the whole analysis.
 */
export const loadRunSummaries = (workspaceRoot: string): LoadedRunSummary[] => {
    const runsDir = join(workspaceRoot, ".task-runner", "runs");

    if (!isAccessibleSync(runsDir)) {
        return [];
    }

    const files = readdirSync(runsDir).filter((f) => f.endsWith(".json"));
    const summaries: LoadedRunSummary[] = [];

    for (const file of files) {
        try {
            summaries.push(readJsonSync(join(runsDir, file)) as LoadedRunSummary);
        } catch {
            // Corrupt summary — skip.
        }
    }

    return summaries;
};

/**
 * Loads durations from historical run summaries and computes the
 * average. Returns the comparison string or `undefined` if no history.
 *
 * Pass `summaries` (from {@link loadRunSummaries}) when the caller
 * has already loaded the history for another purpose (e.g. flakiness
 * analysis on a failing run) to avoid re-reading the same files.
 */
export const compareDuration = (workspaceRoot: string, currentDurationMs: number, summaries?: LoadedRunSummary[]): string | undefined => {
    const history = summaries ?? loadRunSummaries(workspaceRoot);

    if (history.length < 2) {
        return undefined;
    }

    let totalDuration = 0;
    let count = 0;

    for (const data of history) {
        if (typeof data.duration === "number" && data.duration > 0) {
            totalDuration += data.duration;
            count += 1;
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
