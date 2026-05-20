import type { LoadedRunSummary } from "../report/types";

/**
 * A single field that changed between two task hash inputs.
 * `kind` identifies which hash bucket the change originated from
 * (`nodes` is file contents, `implicitDeps` is lockfile/package deps,
 * `runtime` is env vars and similar runtime values, `command` is the
 * resolved shell command).
 */
export interface HashDiffEntry {
    change: "added" | "removed" | "modified";
    current: string | undefined;
    key: string;
    kind: "command" | "implicitDeps" | "nodes" | "runtime";
    previous: string | undefined;
}

/**
 * Result of comparing why a task re-ran instead of hitting cache.
 * `reason` explains at a glance whether there was no prior run, whether
 * the command itself changed, or which bucket accumulated the most
 * changes.
 */
export interface CacheMissAnalysis {
    currentHash: string | undefined;
    entries: HashDiffEntry[];
    previousHash: string | undefined;
    previousRunId: string | undefined;
    previousRunStartTime: string | undefined;
    reason: string;
    taskId: string;
}

interface TaskSummaryLike {
    cacheStatus?: string;
    hash?: string;
    hashDetails?: {
        command?: string;
        implicitDeps?: Record<string, string>;
        nodes?: Record<string, string>;
        runtime?: Record<string, string>;
    };
    target?: { project: string; target: string };
    taskId?: string;
}

interface RunSummaryShape {
    id?: string;
    startTime?: string;
    tasks?: TaskSummaryLike[];
}

const diffRecords = (
    kind: "implicitDeps" | "nodes" | "runtime",
    previous: Record<string, string> | undefined,
    current: Record<string, string> | undefined,
): HashDiffEntry[] => {
    const entries: HashDiffEntry[] = [];
    const previousMap = previous ?? {};
    const currentMap = current ?? {};
    const keys = new Set([...Object.keys(previousMap), ...Object.keys(currentMap)]);

    for (const key of keys) {
        const p = previousMap[key];
        const c = currentMap[key];

        if (p === c) {
            continue;
        }

        if (p === undefined) {
            entries.push({ change: "added", current: c, key, kind, previous: undefined });
        } else if (c === undefined) {
            entries.push({ change: "removed", current: undefined, key, kind, previous: p });
        } else {
            entries.push({ change: "modified", current: c, key, kind, previous: p });
        }
    }

    entries.sort((a, b) => a.key.localeCompare(b.key));

    return entries;
};

const summarize = (entries: HashDiffEntry[]): string => {
    if (entries.length === 0) {
        return "No input changes detected. The cache may have been evicted or was never stored.";
    }

    const commandChanged = entries.some((e) => e.kind === "command");

    if (commandChanged) {
        return "The resolved command changed.";
    }

    const buckets = new Map<string, number>();

    for (const entry of entries) {
        buckets.set(entry.kind, (buckets.get(entry.kind) ?? 0) + 1);
    }

    const [topKind] = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["nodes", 0];
    const label: Record<string, string> = {
        command: "command",
        implicitDeps: "lockfile or dependency",
        nodes: "input file",
        runtime: "runtime value",
    };

    return `${String(entries.length)} ${label[topKind] ?? topKind} change(s) detected.`;
};

/**
 * Returns the most recent run that recorded a cache HIT for `taskId`
 * (i.e. the cached inputs that a later MISS should be compared against).
 * Falls back to the last successful execution when no HIT exists — a
 * first-time run still produces a useful "what inputs did we see last
 * time" view.
 */
const findReferenceTask = (
    summaries: RunSummaryShape[],
    taskId: string,
    excludeRunId: string | undefined,
): { run: RunSummaryShape; task: TaskSummaryLike } | undefined => {
    const currentStart = summaries.find((s) => s.id === excludeRunId)?.startTime;
    const sorted = [...summaries].sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? ""));
    const candidates = sorted.filter((run) => {
        if (run.id !== undefined && run.id === excludeRunId) {
            return false;
        }

        if (currentStart !== undefined && run.startTime !== undefined && run.startTime > currentStart) {
            return false;
        }

        return true;
    });

    for (const run of candidates) {
        const task = run.tasks?.find((t) => t.taskId === taskId);

        if (task && (task.cacheStatus === "HIT" || task.cacheStatus === "REMOTE_HIT")) {
            return { run, task };
        }
    }

    for (const run of candidates) {
        const task = run.tasks?.find((t) => t.taskId === taskId);

        if (task?.hashDetails) {
            return { run, task };
        }
    }

    return undefined;
};

/**
 * Explains why `task` did not hit cache by comparing its hash inputs
 * against the most recent cached execution of the same task from the
 * run history.
 *
 * The analysis walks the four hash buckets recorded by task-runner
 * (`command`, `nodes`, `implicitDeps`, `runtime`) and reports every
 * key that was added, removed, or modified. Callers render the list
 * as a diff view so users can see exactly which input invalidated the
 * cache entry.
 */
export const analyzeCacheMiss = (
    summaries: LoadedRunSummary[],
    currentRunId: string | undefined,
    task: TaskSummaryLike,
): CacheMissAnalysis => {
    const runs = summaries as unknown as RunSummaryShape[];
    const taskId = task.taskId ?? "";
    const reference = findReferenceTask(runs, taskId, currentRunId);

    if (!reference) {
        return {
            currentHash: task.hash,
            entries: [],
            previousHash: undefined,
            previousRunId: undefined,
            previousRunStartTime: undefined,
            reason: "No previous run recorded this task — first observation.",
            taskId,
        };
    }

    const entries: HashDiffEntry[] = [];

    const previousCommand = reference.task.hashDetails?.command;
    const currentCommand = task.hashDetails?.command;

    if (previousCommand !== currentCommand) {
        entries.push({
            change: previousCommand === undefined ? "added" : currentCommand === undefined ? "removed" : "modified",
            current: currentCommand,
            key: "command",
            kind: "command",
            previous: previousCommand,
        });
    }

    entries.push(...diffRecords("nodes", reference.task.hashDetails?.nodes, task.hashDetails?.nodes));
    entries.push(...diffRecords("implicitDeps", reference.task.hashDetails?.implicitDeps, task.hashDetails?.implicitDeps));
    entries.push(...diffRecords("runtime", reference.task.hashDetails?.runtime, task.hashDetails?.runtime));

    return {
        currentHash: task.hash,
        entries,
        previousHash: reference.task.hash,
        previousRunId: reference.run.id,
        previousRunStartTime: reference.run.startTime,
        reason: summarize(entries),
        taskId,
    };
};
