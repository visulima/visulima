import { Box } from "@visulima/tui";
import type { Task, TaskResult } from "@visulima/task-runner";
import { useSyncExternalStore } from "react";

import { formatMs } from "../pretty-time";
import CommandSummary from "./CommandSummary";
import type { TaskRowData } from "./TaskRow";
import TaskTable from "./TaskTable";

// ── Task Store ──────────────────────────────────────────────────────────

interface TaskState {
    cached: number;
    completed: number;
    done: boolean;
    failed: number;
    outputs: Map<string, string>;
    rows: TaskRowData[];
    startTime: number;
    succeeded: number;
}

type Listener = () => void;

export class TaskStore {
    #state: TaskState;
    #listeners = new Set<Listener>();
    #hrtimeStarts = new Map<string, [number, number]>();

    public constructor(tasks: Task[]) {
        this.#state = {
            cached: 0,
            completed: 0,
            done: false,
            failed: 0,
            outputs: new Map(),
            rows: tasks.map((t) => ({ status: "pending" as const, taskId: t.id })),
            startTime: Date.now(),
            succeeded: 0,
        };
    }

    public getSnapshot = (): TaskState => this.#state;

    public subscribe = (listener: Listener): (() => void) => {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    };

    public startTasks(started: Task[]): void {
        const rows = [...this.#state.rows];

        for (const t of started) {
            const index = rows.findIndex((r) => r.taskId === t.id);

            if (index !== -1) {
                rows[index] = { ...rows[index]!, status: "running", elapsed: 0 };
                this.#hrtimeStarts.set(t.id, process.hrtime());
            }
        }

        this.#emit({ ...this.#state, rows });
    }

    public endTasks(results: TaskResult[]): void {
        const rows = [...this.#state.rows];
        let { cached, completed, failed, succeeded } = this.#state;
        const outputs = new Map(this.#state.outputs);

        for (const res of results) {
            const index = rows.findIndex((r) => r.taskId === res.task.id);

            if (index !== -1) {
                rows[index] = {
                    ...rows[index]!,
                    duration: res.startTime && res.endTime ? res.endTime - res.startTime : undefined,
                    status: res.status,
                };
            }

            completed++;

            switch (res.status) {
                case "failure": {
                    failed++;
                    break;
                }
                case "local-cache":
                case "local-cache-kept-existing":
                case "remote-cache": {
                    cached++;
                    break;
                }
                case "success": {
                    succeeded++;
                    break;
                }
                // no default
            }

            if (res.terminalOutput) {
                outputs.set(res.task.id, res.terminalOutput);
            }

            this.#hrtimeStarts.delete(res.task.id);
        }

        this.#emit({ ...this.#state, cached, completed, failed, outputs, rows, succeeded });
    }

    public addOutput(taskId: string, output: string): void {
        if (!output.trim()) {
            return;
        }

        const outputs = new Map(this.#state.outputs);

        outputs.set(taskId, (outputs.get(taskId) ?? "") + output);
        this.#emit({ ...this.#state, outputs });
    }

    public markDone(): void {
        this.#emit({ ...this.#state, done: true });
    }

    /**
     * Update elapsed times for running tasks. Called on each render tick.
     */
    public tick(): void {
        let changed = false;
        const rows = [...this.#state.rows];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]!;

            if (row.status === "running") {
                const start = this.#hrtimeStarts.get(row.taskId);

                if (start) {
                    const d = process.hrtime(start);
                    const ms = d[0] * 1000 + d[1] / 1_000_000;

                    rows[i] = { ...row, elapsed: ms };
                    changed = true;
                }
            }
        }

        if (changed) {
            this.#emit({ ...this.#state, rows });
        }
    }

    #emit(newState: TaskState): void {
        this.#state = newState;

        for (const listener of this.#listeners) {
            listener();
        }
    }
}

// ── React Component ─────────────────────────────────────────────────────

interface DynamicTaskRunnerProps {
    parallelSlots?: number;
    projectNames: string[];
    store: TaskStore;
    targets: string[];
    tasks: Task[];
}

const DynamicTaskRunner = ({ parallelSlots, projectNames, store, targets, tasks }: DynamicTaskRunnerProps): React.JSX.Element => {
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    if (state.done) {
        const took = formatMs(Date.now() - state.startTime);
        const failedIds = state.rows.filter((r: TaskRowData) => r.status === "failure").map((r: TaskRowData) => r.taskId);

        return (
            <Box flexDirection="column">
                <CommandSummary
                    cached={state.cached}
                    failed={state.failed}
                    failedIds={failedIds}
                    projectNames={projectNames}
                    succeeded={state.succeeded}
                    targets={targets}
                    tasks={tasks}
                    took={took}
                />
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            <TaskTable
                parallelSlots={parallelSlots}
                rows={state.rows}
                totalCompleted={state.completed}
                totalRows={state.rows.length}
            />
        </Box>
    );
};

export default DynamicTaskRunner;
