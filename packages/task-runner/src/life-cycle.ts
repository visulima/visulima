import type { LifeCycleInterface, Task, TaskResult, TaskStatus } from "./types";

/**
 * Combines multiple lifecycle handlers into one.
 * Each event is forwarded to all registered handlers.
 */
export class CompositeLifeCycle implements LifeCycleInterface {
    readonly #lifeCycles: LifeCycleInterface[];

    constructor(lifeCycles: LifeCycleInterface[]) {
        this.#lifeCycles = lifeCycles;
    }

    startCommand(): void {
        for (const lc of this.#lifeCycles) {
            lc.startCommand?.();
        }
    }

    endCommand(): void {
        for (const lc of this.#lifeCycles) {
            lc.endCommand?.();
        }
    }

    scheduleTask(task: Task): void {
        for (const lc of this.#lifeCycles) {
            lc.scheduleTask?.(task);
        }
    }

    startTasks(tasks: Task[]): void {
        for (const lc of this.#lifeCycles) {
            lc.startTasks?.(tasks);
        }
    }

    endTasks(taskResults: TaskResult[]): void {
        for (const lc of this.#lifeCycles) {
            lc.endTasks?.(taskResults);
        }
    }

    printTaskTerminalOutput(
        task: Task,
        status: TaskStatus,
        terminalOutput: string,
    ): void {
        for (const lc of this.#lifeCycles) {
            lc.printTaskTerminalOutput?.(task, status, terminalOutput);
        }
    }
}

/**
 * A lifecycle handler that logs task progress to the console.
 */
export class ConsoleLifeCycle implements LifeCycleInterface {
    readonly #verbose: boolean;

    constructor(verbose = false) {
        this.#verbose = verbose;
    }

    startCommand(): void {
        if (this.#verbose) {
            console.log("[task-runner] Starting command execution");
        }
    }

    endCommand(): void {
        if (this.#verbose) {
            console.log("[task-runner] Command execution complete");
        }
    }

    scheduleTask(task: Task): void {
        if (this.#verbose) {
            console.log(`[task-runner] Scheduled: ${task.id}`);
        }
    }

    startTasks(tasks: Task[]): void {
        for (const task of tasks) {
            console.log(`> ${task.id}`);
        }
    }

    endTasks(taskResults: TaskResult[]): void {
        for (const result of taskResults) {
            const duration =
                result.startTime && result.endTime
                    ? ` (${result.endTime - result.startTime}ms)`
                    : "";

            const statusIcon = getStatusIcon(result.status);

            console.log(`${statusIcon} ${result.task.id}${duration}`);
        }
    }

    printTaskTerminalOutput(
        _task: Task,
        _status: TaskStatus,
        terminalOutput: string,
    ): void {
        if (terminalOutput.trim()) {
            console.log(terminalOutput);
        }
    }
}

/**
 * A no-op lifecycle handler. Useful as a default.
 */
export class EmptyLifeCycle implements LifeCycleInterface {}

const getStatusIcon = (status: TaskStatus): string => {
    switch (status) {
        case "success":
        case "local-cache":
        case "local-cache-kept-existing":
        case "remote-cache": {
            return "[success]";
        }

        case "failure": {
            return "[failure]";
        }

        case "skipped": {
            return "[skipped]";
        }

        default: {
            return "[unknown]";
        }
    }
};
