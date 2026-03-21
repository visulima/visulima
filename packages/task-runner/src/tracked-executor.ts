import type { Task, TaskExecutionOptions } from "./types";
import type { FileAccess } from "./file-access-tracker";

import { FileAccessTracker } from "./file-access-tracker";

/**
 * Result of a tracked task execution.
 */
export interface TrackedExecutionResult {
    /** The command exit code */
    code: number;
    /** The command stdout + stderr output */
    terminalOutput: string;
    /** File accesses recorded during execution */
    accesses: FileAccess[];
}

/**
 * A task executor that tracks file accesses during command execution.
 *
 * Uses strace on Linux to intercept syscalls and record which files
 * the process reads. On unsupported platforms, executes the command
 * without tracking (accesses array will be empty).
 *
 * This executor requires tasks to have a `command` in their target
 * configuration. For tasks using custom executors, file accesses
 * cannot be tracked automatically.
 */
export class TrackedTaskExecutor {
    readonly #tracker: FileAccessTracker;
    readonly #workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.#workspaceRoot = workspaceRoot;
        this.#tracker = new FileAccessTracker(workspaceRoot);
    }

    /**
     * Returns true if file access tracking is supported on the current platform.
     */
    get isTrackingSupported(): boolean {
        return this.#tracker.isSupported();
    }

    /**
     * Executes a task command and tracks all file system accesses.
     *
     * Resolves the command from the task's target configuration.
     * The command can be specified directly via `task.target` metadata
     * or derived from package.json scripts.
     */
    async execute(
        task: Task,
        options: TaskExecutionOptions,
        command: string,
    ): Promise<TrackedExecutionResult> {
        const cwd = options.cwd
            ?? (task.projectRoot
                ? `${this.#workspaceRoot}/${task.projectRoot}`
                : this.#workspaceRoot);

        const trackingResult = await this.#tracker.track(command, {
            cwd,
            env: options.env as Record<string, string | undefined>,
        });

        return {
            code: trackingResult.code,
            terminalOutput: trackingResult.output,
            accesses: trackingResult.accesses,
        };
    }
}
