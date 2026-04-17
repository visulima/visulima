/* eslint-disable max-classes-per-file */
import type { LifeCycleInterface, Task, TaskResult, TaskStatus } from "./types";

const getStatusIcon = (status: TaskStatus): string => {
    switch (status) {
        case "failure": {
            return "[failure]";
        }
        case "local-cache":
        case "local-cache-kept-existing":
        case "remote-cache": {
            return "[cache]";
        }
        case "skipped": {
            return "[skipped]";
        }
        case "success": {
            return "[success]";
        }

        default: {
            return "[unknown]";
        }
    }
};

/**
 * Combines multiple lifecycle handlers into one.
 * Each event is forwarded to all registered handlers.
 */
class CompositeLifeCycle implements LifeCycleInterface {
    readonly #lifeCycles: LifeCycleInterface[];

    public constructor(lifeCycles: LifeCycleInterface[]) {
        this.#lifeCycles = lifeCycles;
    }

    public startCommand(): void {
        for (const lc of this.#lifeCycles) {
            lc.startCommand?.();
        }
    }

    public endCommand(): void {
        for (const lc of this.#lifeCycles) {
            lc.endCommand?.();
        }
    }

    public scheduleTask(task: Task): void {
        for (const lc of this.#lifeCycles) {
            lc.scheduleTask?.(task);
        }
    }

    public startTasks(tasks: Task[]): void {
        for (const lc of this.#lifeCycles) {
            lc.startTasks?.(tasks);
        }
    }

    public endTasks(taskResults: TaskResult[]): void {
        for (const lc of this.#lifeCycles) {
            lc.endTasks?.(taskResults);
        }
    }

    public printTaskTerminalOutput(task: Task, status: TaskStatus, terminalOutput: string): void {
        for (const lc of this.#lifeCycles) {
            lc.printTaskTerminalOutput?.(task, status, terminalOutput);
        }
    }

    public printCacheMiss(task: Task, reasons: string): void {
        for (const lc of this.#lifeCycles) {
            lc.printCacheMiss?.(task, reasons);
        }
    }

    public onTaskStdout(task: Task, chunk: string): void {
        for (const lc of this.#lifeCycles) {
            lc.onTaskStdout?.(task, chunk);
        }
    }

    public onTaskStderr(task: Task, chunk: string): void {
        for (const lc of this.#lifeCycles) {
            lc.onTaskStderr?.(task, chunk);
        }
    }
}

/**
 * A lifecycle handler that logs task progress to the console.
 */
class ConsoleLifeCycle implements LifeCycleInterface {
    readonly #verbose: boolean;

    public constructor(verbose = false) {
        this.#verbose = verbose;
    }

    public startCommand(): void {
        if (this.#verbose) {
            // eslint-disable-next-line no-console
            console.log("[task-runner] Starting command execution");
        }
    }

    public endCommand(): void {
        if (this.#verbose) {
            // eslint-disable-next-line no-console
            console.log("[task-runner] Command execution complete");
        }
    }

    public scheduleTask(task: Task): void {
        if (this.#verbose) {
            // eslint-disable-next-line no-console
            console.log(`[task-runner] Scheduled: ${task.id}`);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public startTasks(tasks: Task[]): void {
        for (const task of tasks) {
            // eslint-disable-next-line no-console
            console.log(`> ${task.id}`);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public endTasks(taskResults: TaskResult[]): void {
        for (const result of taskResults) {
            const duration = result.startTime && result.endTime ? ` (${result.endTime - result.startTime}ms)` : "";

            const statusIcon = getStatusIcon(result.status);

            // eslint-disable-next-line no-console
            console.log(`${statusIcon} ${result.task.id}${duration}`);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public printTaskTerminalOutput(_task: Task, _status: TaskStatus, terminalOutput: string): void {
        if (terminalOutput.trim()) {
            // eslint-disable-next-line no-console
            console.log(terminalOutput);
        }
    }

    public printCacheMiss(task: Task, reasons: string): void {
        if (this.#verbose) {
            // eslint-disable-next-line no-console
            console.log(`[task-runner] ${task.id}: ${reasons}`);
        }
    }
}

/**
 * A no-op lifecycle handler. Useful as a default.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class EmptyLifeCycle implements LifeCycleInterface {}

export { CompositeLifeCycle, ConsoleLifeCycle, EmptyLifeCycle };
