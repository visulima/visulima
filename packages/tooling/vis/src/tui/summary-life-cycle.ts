import type { LifeCycleInterface, Task, TaskResult, TaskStatus } from "@visulima/task-runner";
import { renderToString } from "@visulima/tui";
import React from "react";

import TaskSummaryView from "./components/task-summary-view";

interface TaskSummaryEntry {
    output: string;
    result?: TaskResult;
    taskId: string;
}

/**
 * Collects task data throughout execution and prints a comprehensive summary
 * at the end. Can be used as a companion lifecycle alongside dynamic or static lifecycles.
 */
export class SummaryLifeCycle implements LifeCycleInterface {
    readonly #entries = new Map<string, TaskSummaryEntry>();

    public startTasks(tasks: Task[]): void {
        for (const task of tasks) {
            if (!this.#entries.has(task.id)) {
                this.#entries.set(task.id, { output: "", taskId: task.id });
            }
        }
    }

    public endTasks(taskResults: TaskResult[]): void {
        for (const result of taskResults) {
            const entry = this.#entries.get(result.task.id);

            if (entry) {
                entry.result = result;
            } else {
                this.#entries.set(result.task.id, {
                    output: result.terminalOutput ?? "",
                    result,
                    taskId: result.task.id,
                });
            }
        }
    }

    /**
     * Appends output for a task (for streaming output collection).
     */
    public appendTaskOutput(taskId: string, output: string): void {
        const entry = this.#entries.get(taskId);

        if (entry) {
            entry.output += output;
        } else {
            this.#entries.set(taskId, { output, taskId });
        }
    }

    public printTaskTerminalOutput(task: Task, _status: TaskStatus, terminalOutput: string): void {
        this.appendTaskOutput(task.id, terminalOutput);
    }

    public endCommand(): void {
        if (this.#entries.size === 0) {
            return;
        }

        // Sort: failures first, then skipped, then success, then cached, then unknown
        const sorted = [...this.#entries.values()].sort((a, b) => getStatusOrder(a.result?.status) - getStatusOrder(b.result?.status));

        const entries = sorted.map((entry) => {
            return {
                elapsed: entry.result?.startTime && entry.result.endTime ? entry.result.endTime - entry.result.startTime : undefined,
                status: entry.result?.status,
                taskId: entry.taskId,
            };
        });

        const columns = process.stdout.columns || 80;
        const output = renderToString(React.createElement(TaskSummaryView, { entries }), { columns });

        process.stdout.write(`\n${output}\n`);
    }
}

const getStatusOrder = (status?: TaskStatus): number => {
    switch (status) {
        case "failure": {
            return 0;
        }
        case "local-cache":
        case "local-cache-kept-existing":
        case "remote-cache": {
            return 3;
        }
        case "skipped": {
            return 1;
        }
        case "success": {
            return 2;
        }
        default: {
            return 4;
        }
    }
};
