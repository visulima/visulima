import type { TaskStatus } from "@visulima/task-runner";

/**
 * Shape of a persisted run summary — only the fields this module + the
 * flakiness analyzer consume. Kept narrow so both consumers can share
 * one loader without pulling in the full `RunSummary` type from
 * task-runner.
 */
export interface LoadedRunSummary {
    [key: string]: unknown;
    duration?: number;
    startTime?: string;
    tasks?: unknown[];
}

export interface HashBucketDiff {
    added: string[];
    changed: string[];
    removed: string[];
}

export interface HashDetailsDiff {
    commandChanged: boolean;
    implicitDeps: HashBucketDiff;
    nodes: HashBucketDiff;
    runtime: HashBucketDiff;
}

export interface FailureLogEntry {
    command: string | undefined;
    cwd: string | undefined;
    exitCode: number | undefined;
    hash: string | undefined;
    runId: string | undefined;
    status: TaskStatus;
    taskId: string;
    terminalOutput: string;
    timestamp: string;
}
