import { writeFile } from "node:fs/promises";

import type { RunSummary } from "./run-summary";

/* eslint-disable no-secrets/no-secrets -- Google Docs URL fragment has high entropy but is a public spec link. */

/**
 * A single event in the Chrome Tracing JSON format. Chrome's
 * chrome://tracing viewer and Perfetto both accept an array of these.
 *
 * Fields track the subset we actually emit:
 * - `ph: "X"` — "complete" span (has duration)
 * - `ph: "s"` / `ph: "f"` — flow start / finish (connects two spans)
 *
 * See the Chrome Trace Event Format spec on docs.google.com
 * (document id: 1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU)
 * for the full specification.
 */
/* eslint-enable no-secrets/no-secrets */
export interface ChromeTraceEvent {
    args?: Record<string, unknown>;
    /** Event category — grouped in the viewer's search/filter UI. */
    cat: string;
    /** Duration in microseconds — only set for `ph: "X"` events. */
    dur?: number;
    /** Flow ID — used to draw an arrow from flow-start to flow-finish. */
    id?: number;
    /** Human label shown on the timeline. */
    name: string;

    /**
     * Event phase:
     * - `"X"` — complete (span with duration)
     * - `"s"` — flow start
     * - `"f"` — flow finish
     * - `"M"` — metadata
     */
    ph: "f" | "M" | "s" | "X";
    pid: number;
    tid: number;
    /** Timestamp in microseconds. */
    ts: number;
}

const TASK_CATEGORY = "task";
const FLOW_CATEGORY = "dep";
const PID = 1;

/**
 * Converts a {@link RunSummary} into a Chrome Tracing event list that
 * renders as a gantt chart in chrome://tracing or Perfetto.
 *
 * Each task becomes a `"X"` span; dependency edges become flow arrows
 * from the dependency's finish to the dependent task's start.
 * Parallel tasks are assigned synthetic `tid` values (lane 0, 1, 2, …)
 * based on the smallest free lane at the task's start time, so the
 * timeline clearly shows concurrency without requiring real thread IDs.
 */
export const toChromeTrace = (summary: RunSummary): ChromeTraceEvent[] => {
    const events: ChromeTraceEvent[] = [];
    const traceStartMs = Date.parse(summary.startTime);

    // Pack tasks into non-overlapping lanes using a sweep-line approach.
    // `lanes[i]` holds the end time of the task currently occupying lane i;
    // a new task picks the lowest-indexed lane whose end time is ≤ the
    // task's start time, otherwise opens a new lane.
    const tasksByStart = [...summary.tasks].sort((a, b) => {
        const aStart = a.startTime ? Date.parse(a.startTime) : Number.POSITIVE_INFINITY;
        const bStart = b.startTime ? Date.parse(b.startTime) : Number.POSITIVE_INFINITY;

        return aStart - bStart;
    });

    const lanes: number[] = [];
    const taskLane = new Map<string, number>();

    for (const task of tasksByStart) {
        if (!task.startTime || !task.endTime) {
            continue;
        }

        const startMs = Date.parse(task.startTime);
        const endMs = Date.parse(task.endTime);
        let lane = lanes.findIndex((laneEnd) => laneEnd <= startMs);

        if (lane === -1) {
            lane = lanes.length;
            lanes.push(endMs);
        } else {
            lanes[lane] = endMs;
        }

        taskLane.set(task.taskId, lane);
        events.push({
            args: {
                cacheStatus: task.cacheStatus,
                exitCode: task.exitCode,
                hash: task.hash,
                project: task.target.project,
                target: task.target.target,
            },
            cat: TASK_CATEGORY,
            dur: Math.max(0, (endMs - startMs) * 1000),
            name: task.taskId,
            ph: "X",
            pid: PID,
            tid: lane,
            ts: (startMs - traceStartMs) * 1000,
        });
    }

    // Flow arrows from each dependency's finish to this task's start.
    // The viewer draws a line only when both endpoints exist.
    let flowId = 1;

    for (const task of summary.tasks) {
        if (!task.startTime || !task.endTime) {
            continue;
        }

        const dependents = task.dependencies ?? [];

        for (const depId of dependents) {
            const dep = summary.tasks.find((t) => t.taskId === depId);

            if (!dep?.endTime || !task.startTime) {
                continue;
            }

            const depEndUs = (Date.parse(dep.endTime) - traceStartMs) * 1000;
            const taskStartUs = (Date.parse(task.startTime) - traceStartMs) * 1000;
            const id = flowId;

            flowId += 1;

            events.push(
                {
                    cat: FLOW_CATEGORY,
                    id,
                    name: `${depId} → ${task.taskId}`,
                    ph: "s",
                    pid: PID,
                    tid: taskLane.get(depId) ?? 0,
                    ts: depEndUs,
                },
                {
                    cat: FLOW_CATEGORY,
                    id,
                    name: `${depId} → ${task.taskId}`,
                    ph: "f",
                    pid: PID,
                    tid: taskLane.get(task.taskId) ?? 0,
                    ts: taskStartUs,
                },
            );
        }
    }

    // Metadata event so the viewer displays the run's name.
    events.unshift({
        args: { name: `vis run (${summary.id})` },
        cat: "__metadata",
        name: "process_name",
        ph: "M",
        pid: PID,
        tid: 0,
        ts: 0,
    });

    return events;
};

/**
 * Writes a Chrome Tracing JSON file at `outputPath`. Consumers (e.g.
 * a CLI `--profile out.json` flag) call this after the run completes
 * with a RunSummary produced by the task orchestrator.
 */
export const writeChromeTrace = async (summary: RunSummary, outputPath: string): Promise<void> => {
    const events = toChromeTrace(summary);

    await writeFile(outputPath, JSON.stringify({ traceEvents: events }));
};
