import type { Task, TaskResult } from "@visulima/task-runner";

import type { TaskRowData } from "./TaskRow";

// ── State Shape ─────────────────────────────────────────────────────────

export interface TaskState {
    /** Auto-exit countdown in seconds. null = not counting. */
    autoExitCountdown: number | null;
    /** Number of tasks completed from cache. */
    cached: number;
    /** Total completed tasks. */
    completed: number;
    /** All tasks finished — triggers summary/countdown. */
    done: boolean;
    /** Number of failed tasks. */
    failed: number;
    /** Whether the filter input bar is active. */
    filterActive: boolean;
    /** Current filter text (empty = no filter). */
    filterText: string;
    /** Which panel currently has keyboard focus. */
    focusedPanel: "output" | "tasks";
    /** Accumulated terminal output per task. */
    outputs: Map<string, string>;
    /** Up to 2 pinned task IDs for output panes. */
    pinnedTaskIds: [string | null, string | null];
    /** All task rows with current status. */
    rows: TaskRowData[];
    /** Whether a rerun has been requested by the user. */
    rerunRequested: boolean;
    /** Currently highlighted task index in the list. */
    selectedIndex: number;
    /** Command start timestamp (Date.now). */
    startTime: number;
    /** Number of successfully completed tasks. */
    succeeded: number;
}

type Listener = () => void;

// ── TaskStore ───────────────────────────────────────────────────────────

export class TaskStore {
    #state: TaskState;
    #listeners = new Set<Listener>();
    #hrtimeStarts = new Map<string, [number, number]>();

    public constructor(tasks: Task[]) {
        this.#state = {
            autoExitCountdown: null,
            cached: 0,
            completed: 0,
            done: false,
            failed: 0,
            filterActive: false,
            filterText: "",
            focusedPanel: "tasks",
            outputs: new Map(),
            pinnedTaskIds: [null, null],
            rerunRequested: false,
            rows: tasks.map((t) => ({ status: "pending" as const, taskId: t.id })),
            selectedIndex: 0,
            startTime: Date.now(),
            succeeded: 0,
        };
    }

    // ── React integration ───────────────────────────────────────────

    public getSnapshot = (): TaskState => this.#state;

    public subscribe = (listener: Listener): (() => void) => {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    };

    // ── Lifecycle methods (called by task runner) ───────────────────

    public startTasks(started: Task[]): void {
        const rows = [...this.#state.rows];

        for (const t of started) {
            const index = rows.findIndex((r) => r.taskId === t.id);

            if (index !== -1) {
                rows[index] = { ...rows[index]!, elapsed: 0, status: "running" };
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

        // Mutate in-place to avoid copying the entire Map on every streaming chunk.
        // A new state shell triggers useSyncExternalStore re-render.
        this.#state.outputs.set(taskId, (this.#state.outputs.get(taskId) ?? "") + output);
        this.#emit({ ...this.#state });
    }

    public markDone(): void {
        this.#emit({ ...this.#state, done: true });
    }

    /** Update elapsed times for running tasks. Called every 100ms. */
    public tick(): void {
        if (this.#hrtimeStarts.size === 0) {
            return;
        }

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

    // ── UI state methods (called by React components) ───────────────

    public setSelectedIndex(index: number): void {
        if (index !== this.#state.selectedIndex) {
            this.#emit({ ...this.#state, selectedIndex: index });
        }
    }

    public setFocusedPanel(panel: "output" | "tasks"): void {
        if (panel !== this.#state.focusedPanel) {
            this.#emit({ ...this.#state, focusedPanel: panel });
        }
    }

    public setFilter(text: string): void {
        this.#emit({ ...this.#state, filterText: text, selectedIndex: 0 });
    }

    public setFilterActive(active: boolean): void {
        if (active !== this.#state.filterActive) {
            this.#emit({
                ...this.#state,
                filterActive: active,
                filterText: active ? this.#state.filterText : "",
                selectedIndex: 0,
            });
        }
    }

    public pinTask(slot: 0 | 1, taskId: string | null): void {
        const pins: [string | null, string | null] = [...this.#state.pinnedTaskIds];

        pins[slot] = taskId;
        this.#emit({ ...this.#state, pinnedTaskIds: pins });
    }

    public clearPins(): void {
        this.#emit({ ...this.#state, pinnedTaskIds: [null, null] });
    }

    /** Request a rerun — resets all task state back to pending. */
    public requestRerun(): void {
        this.#hrtimeStarts.clear();
        this.#emit({
            ...this.#state,
            autoExitCountdown: null,
            cached: 0,
            completed: 0,
            done: false,
            failed: 0,
            outputs: new Map(),
            rerunRequested: true,
            rows: this.#state.rows.map((r) => ({ status: "pending" as const, taskId: r.taskId })),
            startTime: Date.now(),
            succeeded: 0,
        });
    }

    /** Acknowledge the rerun request (called by lifecycle after re-launching tasks). */
    public acknowledgeRerun(): void {
        if (this.#state.rerunRequested) {
            this.#emit({ ...this.#state, rerunRequested: false });
        }
    }

    // ── Internal ────────────────────────────────────────────────────

    #emit(newState: TaskState): void {
        this.#state = newState;

        for (const listener of this.#listeners) {
            try {
                listener();
            } catch {
                // Isolate listener errors to prevent one failure from blocking others
            }
        }
    }
}
