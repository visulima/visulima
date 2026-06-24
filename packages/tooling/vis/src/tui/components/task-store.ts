import type { Task, TaskResult } from "@visulima/task-runner";

import type { VisTargetOptions } from "../../task/target-options";
import type { TaskRowData } from "./task-row";

export interface TaskState {
    /** Auto-exit countdown in seconds. null = not counting. */
    autoExitCountdown: number | null;
    /** Number of tasks completed from cache. */
    cached: number;
    /** Total completed tasks. */
    completed: number;
    /** All tasks finished — triggers summary/countdown. */
    done: boolean;
    /** Timestamp when all tasks completed (Date.now). null while running. */
    endTime: number | null;
    /** Number of failed tasks. */
    failed: number;
    /** Whether the filter input bar is active. */
    filterActive: boolean;

    /** Current filter text (empty = no filter). */
    filterText: string;
    /** Which panel currently has keyboard focus. */
    focusedPanel: "dock" | "output" | "tasks";
    /** Whether interactive input mode is active for the current task. */
    interactiveMode: boolean;
    /** Accumulated terminal output per task. */
    outputs: Map<string, string>;
    /** Up to 2 pinned task IDs for output panes. */
    pinnedTaskIds: [string | null, string | null];
    /** Whether a rerun has been requested by the user. */
    rerunRequested: boolean;

    /**
     * IDs of tasks that finished after at least one retry. A task can appear
     * here whether it ultimately succeeded or failed — any non-zero retry
     * attempt is a flake observation worth surfacing.
     */
    retriedIds: string[];
    /** Task ID requested for single-task retry (null = none). */
    retryTaskId: string | null;
    /** All task rows with current status. */
    rows: TaskRowData[];

    /**
     * Number of tasks currently in flight across the whole executed graph
     * (requested tasks plus their `dependsOn` dependencies), not just the
     * rows shown in the table. Kept in sync via start/end so the status-bar
     * spinner count shares the same scope as the succeeded/failed counters.
     */
    running: number;
    /** Currently highlighted task index in the list. */
    selectedIndex: number;
    /** Command start timestamp (Date.now). */
    startTime: number;
    /** Status filter for task list: "all", "failed", "running", "passed". */
    statusFilter: "all" | "failed" | "passed" | "running";
    /** Number of successfully completed tasks. */
    succeeded: number;

    /**
     * Total number of tasks that will be executed across the whole graph —
     * the requested tasks plus every `dependsOn` dependency pulled in. This
     * is the denominator behind the "N total" status-bar label and matches
     * the `succeeded + cached` figure the final summary reports, unlike
     * `rows.length`, which only counts the directly-requested tasks shown in
     * the table.
     */
    totalTasks: number;
    /** Current view mode: list (full width), split (list + output), fullscreen (output only). */
    viewMode: "fullscreen" | "list" | "split";
}

type Listener = () => void;

export class TaskStore {
    #state: TaskState;

    #listeners = new Set<Listener>();

    #hrtimeStarts = new Map<string, [number, number]>();

    /**
     * @param tasks The directly-requested tasks rendered as table rows.
     * @param totalTasks The size of the full executed graph (requested tasks plus their `dependsOn`
     * dependencies). Defaults to `tasks.length` when the caller can't supply the graph count, keeping
     * the old rows-scoped behaviour.
     */
    public constructor(tasks: Task[], totalTasks?: number) {
        this.#state = {
            autoExitCountdown: null,
            cached: 0,
            completed: 0,
            done: false,
            endTime: null,
            failed: 0,
            filterActive: false,
            filterText: "",
            focusedPanel: "tasks",
            interactiveMode: false,
            outputs: new Map(),
            pinnedTaskIds: [null, null],
            rerunRequested: false,
            retriedIds: [],
            retryTaskId: null,
            rows: tasks.map((t) => {
                const visOptions = t.overrides["visOptions"] as VisTargetOptions | undefined;

                return { persistent: Boolean(visOptions?.persistent), status: "pending" as const, taskId: t.id };
            }),
            running: 0,
            selectedIndex: 0,
            startTime: Date.now(),
            statusFilter: "all",
            succeeded: 0,
            totalTasks: totalTasks ?? tasks.length,
            viewMode: "list",
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
                rows[index] = { ...rows[index]!, elapsed: 0, status: "running" };
                this.#hrtimeStarts.set(t.id, process.hrtime());
            }
        }

        // Count every started task — including `dependsOn` deps that have no
        // row — so the spinner count spans the same graph as the counters.
        this.#emit({ ...this.#state, rows, running: this.#state.running + started.length });
    }

    public endTasks(results: TaskResult[]): void {
        const rows = [...this.#state.rows];
        let { cached, completed, failed, succeeded } = this.#state;
        const outputs = new Map(this.#state.outputs);
        const retriedIds = [...this.#state.retriedIds];

        for (const res of results) {
            const index = rows.findIndex((r) => r.taskId === res.task.id);

            if (index !== -1) {
                rows[index] = {
                    ...rows[index]!,
                    duration: res.startTime && res.endTime ? res.endTime - res.startTime : undefined,
                    retryAttempts: res.retryAttempts,
                    status: res.status,
                };
            }

            // A task that ultimately passed but burned retries is the
            // exact "succeeded after retry" signal we want to surface
            // — without this, the run looks fully clean even when a
            // flake was masked.
            if (res.retryAttempts && res.retryAttempts > 0) {
                retriedIds.push(res.task.id);
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

            // Only set output if not already streamed (avoids replacing
            // incremental output). Raw output is stored as-is; the
            // OutputPanel applies `renderFailureOutput` lazily for failed
            // tasks so a synthetic retry endTasks call (handler.ts) doesn't
            // re-render an already-rendered string.
            if (res.terminalOutput && !outputs.has(res.task.id)) {
                outputs.set(res.task.id, res.terminalOutput);
            }

            this.#hrtimeStarts.delete(res.task.id);
        }

        // Auto-scroll to first failed task so the user sees it immediately
        let { selectedIndex } = this.#state;

        if (failed > this.#state.failed) {
            const firstFailureIndex = rows.findIndex((r) => r.status === "failure");

            if (firstFailureIndex !== -1) {
                selectedIndex = firstFailureIndex;
            }
        }

        // Clamp at zero: cache hits may report through endTasks without a
        // matching startTasks, which would otherwise drive the counter negative.
        const running = Math.max(0, this.#state.running - results.length);

        this.#emit({ ...this.#state, cached, completed, failed, outputs, retriedIds, rows, running, selectedIndex, succeeded });
    }

    /** Maximum output stored per task (256 KB). Prevents OOM with long-running dev servers. */
    static readonly #MAX_OUTPUT_BYTES = 256 * 1024;

    public addOutput(taskId: string, output: string): void {
        if (!output.trim()) {
            return;
        }

        // Mutate in-place to avoid copying the entire Map on every streaming chunk.
        // A new state shell triggers useSyncExternalStore re-render.
        let current = (this.#state.outputs.get(taskId) ?? "") + output;

        // Cap output to prevent unbounded memory growth with long-running tasks
        if (current.length > TaskStore.#MAX_OUTPUT_BYTES) {
            current = current.slice(-TaskStore.#MAX_OUTPUT_BYTES);
        }

        this.#state.outputs.set(taskId, current);
        this.#emit({ ...this.#state });
    }

    /** Replace the full output for a task (used by PTY mode where ANSI sequences update in place). */
    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
    public setOutput(taskId: string, content: string): void {
        this.#state.outputs.set(taskId, content);
        this.#emit({ ...this.#state });
    }

    public markDone(): void {
        this.#emit({ ...this.#state, done: true, endTime: Date.now() });
    }

    /**
     * Reverse a prior {@link markDone} so the UI keeps showing the task
     * table instead of the summary. Used when persistent tasks (servers,
     * watchers) start running after the regular task graph completes —
     * the run isn't really "done" until they exit too.
     */
    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
    public unmarkDone(): void {
        this.#emit({ ...this.#state, autoExitCountdown: null, done: false, endTime: null });
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

    public setSelectedIndex(index: number): void {
        if (index !== this.#state.selectedIndex) {
            this.#emit({ ...this.#state, selectedIndex: index });
        }
    }

    public setFocusedPanel(panel: "dock" | "output" | "tasks"): void {
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

    /** Request retry of a single failed task. */
    public requestRetry(taskId: string): void {
        // Reset the task to "running" state
        const rows = [...this.#state.rows];
        const index = rows.findIndex((r) => r.taskId === taskId);
        let { completed, failed, succeeded } = this.#state;

        if (index !== -1) {
            const previousStatus = rows[index]!.status;

            // Adjust counters to undo the previous terminal state
            if (previousStatus === "failure") {
                failed = Math.max(0, failed - 1);
                completed = Math.max(0, completed - 1);
            } else if (previousStatus === "success") {
                succeeded = Math.max(0, succeeded - 1);
                completed = Math.max(0, completed - 1);
            }

            rows[index] = { ...rows[index]!, elapsed: 0, retryAttempts: undefined, status: "running" };
            this.#hrtimeStarts.set(taskId, process.hrtime());
        }

        this.#emit({
            ...this.#state,
            completed,
            done: false,
            endTime: null,
            failed,
            interactiveMode: false,
            // Strip the prior run's retry observation for this task
            // — the upcoming attempt may pass cleanly; if it doesn't,
            // endTasks will re-record the new count.
            retriedIds: this.#state.retriedIds.filter((id) => id !== taskId),
            retryTaskId: taskId,
            rows,
            succeeded,
        });
    }

    /** Acknowledge the retry request (called by lifecycle after re-launching). */
    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
    public acknowledgeRetry(): string | null {
        const id = this.#state.retryTaskId;

        if (id) {
            this.#emit({ ...this.#state, retryTaskId: null });
        }

        return id;
    }

    /** Toggle interactive input mode for the current task. */
    public setInteractiveMode(active: boolean): void {
        if (active !== this.#state.interactiveMode) {
            this.#emit({ ...this.#state, interactiveMode: active });
        }
    }

    /** Set the current view mode. */
    public setViewMode(mode: "fullscreen" | "list" | "split"): void {
        if (mode !== this.#state.viewMode) {
            this.#emit({ ...this.#state, viewMode: mode });
        }
    }

    /** Set status filter for the task list. */
    public setStatusFilter(filter: "all" | "failed" | "passed" | "running"): void {
        this.#emit({ ...this.#state, selectedIndex: 0, statusFilter: filter });
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
            endTime: null,
            failed: 0,
            interactiveMode: false,
            outputs: new Map(),
            rerunRequested: true,
            // Drop retry counters from the prior run — when the user
            // re-runs we want a fresh observation, not stacked history.
            retriedIds: [],
            rows: this.#state.rows.map((r) => {
                return { persistent: r.persistent, status: "pending" as const, taskId: r.taskId };
            }),
            running: 0,
            startTime: Date.now(),
            succeeded: 0,
            viewMode: "list",
        });
    }

    /** Acknowledge the rerun request (called by lifecycle after re-launching tasks). */
    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
    public acknowledgeRerun(): void {
        if (this.#state.rerunRequested) {
            this.#emit({ ...this.#state, rerunRequested: false });
        }
    }

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
