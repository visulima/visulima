import type { RunSummary, TaskHashDetails, TaskStatus } from "@visulima/task-runner";
import { readLastRunSummary } from "@visulima/task-runner";

import { loadFailureLog } from "../report/failure-log";
import type { HashDetailsDiff } from "../report/run-summary-utils";
import { diffHashDetails, findTaskInSummary, readPreviousRunSummary, readRunSummaryById } from "../report/run-summary-utils";
import { getVisWorkspaceDataDir } from "../util/vis-paths";

/**
 * The single struct passed to the AI fix-proposal flow.
 *
 * Composes data from three sources:
 * - {@link loadFailureLog} for the actual stdout/stderr (the
 *   task-runner cache drops failed-task output, so a separate
 *   per-task log file is the only source of the error text).
 * - {@link readLastRunSummary} for hash, hashDetails, dependencies,
 *   project/target metadata.
 * - {@link diffHashDetails} for the input-rotation diagnosis (which
 *   input changed since the last run that didn't fail).
 *
 * `terminalOutput` is empty when no failure log has been written —
 * either the task was never run, or it ran before the
 * `FailureLogLifeCycle` was added. Callers should surface a friendly
 * "re-run with vis run to capture logs" message in that case.
 */
export interface FailureContext {
    command: string | undefined;
    cwd: string | undefined;
    dependencies: string[];
    duration: number | undefined;
    exitCode: number | undefined;
    hash: string | undefined;
    hashDetails: TaskHashDetails | undefined;
    hashDiff: HashDetailsDiff | undefined;
    previousRunId: string | undefined;
    project: string | undefined;
    runId: string | undefined;
    status: TaskStatus | undefined;
    target: string | undefined;
    taskId: string;
    terminalOutput: string;
    terminalOutputCaptured: boolean;
    timestamp: string | undefined;
}

export interface AggregateFailureContextOptions {
    /**
     * Specific run ID from `.vis/runs/` to use instead of the
     * latest. Mirrors the `--run` flag on `vis cache why`.
     */
    runId?: string;

    /**
     * Maximum bytes of `terminalOutput` to include in the context.
     * Truncated from the head — the bottom of the log is usually
     * where the actual error message is, so the tail is preserved.
     * Defaults to 32 KB which fits comfortably in a single
     * Anthropic prompt without dominating the context window.
     */
    terminalOutputLimit?: number;
}

const DEFAULT_TERMINAL_OUTPUT_LIMIT = 32 * 1024;

const truncateHead = (output: string, limit: number): string => {
    if (output.length <= limit) {
        return output;
    }

    const tail = output.slice(-limit);
    const dropped = output.length - tail.length;

    return `[…${String(dropped)} bytes truncated from head…]\n${tail}`;
};

const loadSummary = async (workspaceRoot: string, runId: string | undefined): Promise<RunSummary | undefined> => {
    if (runId === undefined) {
        return readLastRunSummary(workspaceRoot, { dataDirectory: getVisWorkspaceDataDir(workspaceRoot) });
    }

    return readRunSummaryById(workspaceRoot, runId);
};

/**
 * Builds the {@link FailureContext} struct for a failed task.
 *
 * Returns `undefined` only when neither the failure log nor the run
 * summary mention the task — i.e., we have nothing useful to feed the
 * AI. Otherwise returns a partially-populated struct (with
 * `terminalOutputCaptured: false` if logs are missing) so callers can
 * still surface the structured data they do have.
 */
export const aggregateFailureContext = async (
    workspaceRoot: string,
    taskId: string,
    options: AggregateFailureContextOptions = {},
): Promise<FailureContext | undefined> => {
    const limit = options.terminalOutputLimit ?? DEFAULT_TERMINAL_OUTPUT_LIMIT;

    const [failureLog, summary] = await Promise.all([loadFailureLog(workspaceRoot, taskId), loadSummary(workspaceRoot, options.runId)]);

    const summaryTask = summary ? findTaskInSummary(summary, taskId) : undefined;

    if (!failureLog && !summaryTask) {
        return undefined;
    }

    let hashDiff: HashDetailsDiff | undefined;
    let previousRunId: string | undefined;

    if (summary && summaryTask) {
        const previousSummary = await readPreviousRunSummary(workspaceRoot, summary.id);
        const previousTask = previousSummary ? findTaskInSummary(previousSummary, taskId) : undefined;

        hashDiff = diffHashDetails(summaryTask.hashDetails, previousTask?.hashDetails);
        previousRunId = previousSummary?.id;
    }

    const terminalOutput = failureLog?.terminalOutput ?? "";

    return {
        command: failureLog?.command ?? undefined,
        cwd: failureLog?.cwd ?? undefined,
        dependencies: summaryTask?.dependencies ?? [],
        duration: summaryTask?.duration,
        exitCode: failureLog?.exitCode ?? summaryTask?.exitCode,
        hash: summaryTask?.hash ?? failureLog?.hash,
        hashDetails: summaryTask?.hashDetails,
        hashDiff,
        previousRunId,
        project: summaryTask?.target.project,
        runId: summary?.id ?? failureLog?.runId,
        status: failureLog?.status ?? (summaryTask ? mapCacheStatusToTaskStatus(summaryTask) : undefined),
        target: summaryTask?.target.target,
        taskId,
        terminalOutput: truncateHead(terminalOutput, limit),
        terminalOutputCaptured: Boolean(failureLog),
        timestamp: failureLog?.timestamp ?? summaryTask?.endTime ?? summaryTask?.startTime,
    };
};

/**
 * Heuristic mapping from the run-summary `cacheStatus` field back to
 * the orchestrator's `TaskStatus` enum. The summary doesn't persist
 * the raw status (just whether the result was a cache hit), but for
 * AI fix purposes we mainly care about distinguishing failure from
 * success.
 */
const mapCacheStatusToTaskStatus = (summaryTask: { cacheStatus: string; exitCode?: number }): TaskStatus | undefined => {
    if (summaryTask.exitCode !== undefined && summaryTask.exitCode !== 0) {
        return "failure";
    }

    switch (summaryTask.cacheStatus) {
        case "HIT": {
            return "local-cache";
        }
        case "REMOTE_HIT": {
            return "remote-cache";
        }
        case "SKIPPED": {
            return "skipped";
        }
        default: {
            return summaryTask.exitCode === 0 ? "success" : undefined;
        }
    }
};
