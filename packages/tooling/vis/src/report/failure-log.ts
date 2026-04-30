import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { join } from "@visulima/path";
import type { LifeCycleInterface, Task, TaskStatus } from "@visulima/task-runner";

import type { FailureLogEntry } from "./types";

const FAILURE_LOG_DIRNAME = "last-failures";

export const getFailureLogDirectory = (workspaceRoot: string): string => join(workspaceRoot, ".task-runner", FAILURE_LOG_DIRNAME);

export const getFailureLogPath = (workspaceRoot: string, taskId: string): string =>
    join(getFailureLogDirectory(workspaceRoot), `${encodeURIComponent(taskId)}.json`);

/**
 * Lifecycle hook that persists failed-task terminal output to disk.
 *
 * The task-runner cache is gated on `code === 0`, so failed-task
 * terminal output is dropped between runs. The AI-fix pipeline needs
 * the failure logs after the run is over (especially in CI where the
 * scrollback is on a different machine), so this lifecycle writes one
 * file per failing task to `.task-runner/last-failures/`.
 *
 * Files are overwritten on each new failure of the same task so the
 * directory stays bounded — there's only ever one entry per task ID.
 */
export class FailureLogLifeCycle implements LifeCycleInterface {
    readonly #workspaceRoot: string;

    readonly #runId: string | undefined;

    public constructor(workspaceRoot: string, runId?: string) {
        this.#workspaceRoot = workspaceRoot;
        this.#runId = runId;
    }

    public printTaskTerminalOutput(task: Task, status: TaskStatus, terminalOutput: string): void {
        if (status !== "failure") {
            return;
        }

        const directory = getFailureLogDirectory(this.#workspaceRoot);

        try {
            mkdirSync(directory, { recursive: true });
        } catch {
            return;
        }

        const command = task.overrides["command"] as string | undefined;
        const cwd = task.projectRoot;

        const entry: FailureLogEntry = {
            command,
            cwd,
            exitCode: undefined,
            hash: task.hash,
            runId: this.#runId,
            status,
            taskId: task.id,
            terminalOutput,
            timestamp: new Date().toISOString(),
        };

        try {
            writeFileSync(getFailureLogPath(this.#workspaceRoot, task.id), `${JSON.stringify(entry, undefined, 2)}\n`, "utf8");
        } catch {
            // Best-effort. Failure logs are diagnostic; we don't want
            // disk errors to interfere with the actual run reporting.
        }
    }
}

/**
 * Reads a previously written failure log for a task, if one exists.
 *
 * Returns `undefined` when the file is missing or unreadable so the
 * caller can render a friendly error rather than crash.
 */
export const loadFailureLog = async (workspaceRoot: string, taskId: string): Promise<FailureLogEntry | undefined> => {
    const path = getFailureLogPath(workspaceRoot, taskId);

    try {
        const content = await readFile(path, "utf8");

        return JSON.parse(content) as FailureLogEntry;
    } catch {
        return undefined;
    }
};

/**
 * Lists the task IDs that currently have a failure log on disk.
 * Used by `vis ai fix` to surface available failures when the user
 * runs the command without an explicit task ID.
 */
export const listFailureLogs = (workspaceRoot: string): string[] => {
    const directory = getFailureLogDirectory(workspaceRoot);

    let entries: string[];

    try {
        entries = readdirSync(directory);
    } catch {
        return [];
    }

    const taskIds: string[] = [];

    for (const name of entries) {
        if (!name.endsWith(".json")) {
            continue;
        }

        try {
            taskIds.push(decodeURIComponent(name.slice(0, -".json".length)));
        } catch {
            // Filename isn't a valid percent-encoded sequence; skip.
        }
    }

    return taskIds;
};

export type { FailureLogEntry } from "./types";
