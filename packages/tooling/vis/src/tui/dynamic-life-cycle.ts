import type { LifeCycleInterface, Task, TaskResult, TaskStatus } from "@visulima/task-runner";
import type { Instance } from "@visulima/tui";
import { render, renderToString } from "@visulima/tui";
import { Text } from "@visulima/tui/components/text";
import React from "react";

import CommandSummary from "./components/command-summary";
import type { ServiceDockStore } from "./components/service-dock/service-dock-store";
import { TaskStore } from "./components/task-store";
import VisTaskRunnerApp from "./components/vis-task-runner-app";
import { formatMs } from "./pretty-time";
import type { OutputStyle } from "./static-life-cycle";
import { getStatusInfo } from "./status-utils";
import { CROSS } from "./symbols";
import type { StdinEntry } from "./types";

interface DynamicOutputOptions {
    args: {
        parallel?: boolean | number;
        targets: string[];
    };
    /** Auto-exit config: false = stay open, true = 3s countdown, number = custom seconds */
    autoExit?: boolean | number;

    /** Optional retry callback for the service dock. Fires on R against a crashed/failed row. */
    onRetryService?: (id: string) => Promise<void> | void;

    /**
     * Mirrors the static lifecycle's `outputStyle`. Dynamic mode already
     * buffers all output into the TUI (the user inspects logs via panel
     * navigation, not a stdout stream), so `quiet` only affects the
     * post-exit auto-dump of failed task output. With `quiet`, even
     * failures stay in the TUI scrollback rather than being re-printed
     * below the summary. Defaults to `normal`.
     */
    outputStyle?: OutputStyle;
    projectNames: string[];
    /** Optional dock store; when provided and non-empty, the service dock is rendered. */
    serviceDockStore?: ServiceDockStore | null;
    /** Registry of writable stdin entries keyed by task ID, for interactive input. */
    stdinRegistry?: Map<string, StdinEntry>;
    tasks: Task[];
}

interface DynamicOutputResult {
    lifeCycle: LifeCycleInterface;
    renderIsDone: Promise<void>;
    store: TaskStore;
}

export const createDynamicOutputRenderer = (options: DynamicOutputOptions): DynamicOutputResult => {
    const { args, autoExit = false, onRetryService, outputStyle = "normal", projectNames, serviceDockStore, stdinRegistry, tasks } = options;

    const store = new TaskStore(tasks);
    const parallelSlots = typeof args.parallel === "number" ? args.parallel : 3;
    const autoExitSeconds = autoExit === true ? 3 : typeof autoExit === "number" ? autoExit : 0;

    let instance: Instance | undefined;
    let resolveDone: () => void;
    const renderIsDone = new Promise<void>((resolve) => {
        resolveDone = resolve;
    });

    // Tick interval for updating elapsed times on running tasks
    let tickTimer: ReturnType<typeof setInterval> | undefined;

    const cleanup = (): void => {
        if (tickTimer) {
            clearInterval(tickTimer);
            tickTimer = undefined;
        }
    };

    /**
     * Reverse the explicit `process.stdin.ref()` / `setRawMode(true)` /
     * `resume()` we did in `startCommand`. Without this the event loop
     * stays alive after the TUI unmounts and the `vis` CLI hangs at
     * "tasks complete" without returning to the shell prompt — Ink's own
     * unmount restores some stdin state but does not undo our `ref()`.
     */
    const releaseStdin = (): void => {
        if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
            try {
                process.stdin.setRawMode(false);
            } catch {
                // setRawMode can throw on a stdin that's already been
                // reset — ignore, the goal is just to release the loop.
            }
        }

        process.stdin.pause();
        process.stdin.unref();
    };

    const killAllPtyProcesses = (): void => {
        if (stdinRegistry) {
            for (const entry of stdinRegistry.values()) {
                entry.kill?.();
            }

            stdinRegistry.clear();
        }
    };

    const onSignal = (): void => {
        cleanup();
        clearKeepAlive();
        killAllPtyProcesses();
        releaseStdin();

        // Force restore terminal: leave alternate screen, show cursor
        process.stdout.write("\u001B[?1049l\u001B[?25h");
        instance?.cleanup();
        // eslint-disable-next-line unicorn/no-process-exit -- signal handler must terminate immediately to release the terminal; setting exitCode would let pending tasks keep running
        process.exit(1);
    };

    const printExitSummary = (): void => {
        const state = store.getSnapshot();
        const took = formatMs(Date.now() - state.startTime);
        const failedIds = state.rows.filter((r) => r.status === "failure").map((r) => r.taskId);
        const columns = process.stdout.columns || 80;

        // 1. Print full task list with status icons (like Nx exit output)
        process.stdout.write("\n");

        for (const row of state.rows) {
            const { persistent, status, taskId } = row;
            const isInFlight = status === "running" || status === "pending";

            // Persistent tasks (dev/serve/watch) that were still running
            // when the user quit aren't "incomplete" — they were alive and
            // healthy, then asked to stop. Render that as `■ (stopped)`
            // instead of the default `?` for unknown status.
            const info = getStatusInfo(status as TaskStatus);
            const icon = isInFlight && persistent ? "■" : info.icon;
            const color = isInFlight && persistent ? "gray" : info.color;

            let cacheLabel = "";

            switch (status) {
                case "local-cache":
                case "local-cache-kept-existing": {
                    cacheLabel = " [local cache]";

                    break;
                }
                case "remote-cache": {
                    cacheLabel = " [remote cache]";

                    break;
                }
                case "skipped": {
                    cacheLabel = " [skipped]";

                    break;
                }
                default: {
                    if (isInFlight && persistent) {
                        cacheLabel = " [stopped]";
                    } else if (isInFlight) {
                        cacheLabel = " [skipped]";
                    }

                    break;
                }
            }

            const retryLabel = row.retryAttempts && row.retryAttempts > 0 ? ` [retried ${row.retryAttempts}x]` : "";

            const line = renderToString(
                React.createElement(
                    Text,
                    null,
                    "   ",
                    React.createElement(Text, { color }, icon),
                    `  vis run ${taskId}`,
                    cacheLabel ? React.createElement(Text, { dimColor: true }, `  ${cacheLabel}`) : null,
                    retryLabel ? React.createElement(Text, { color: "yellow" }, retryLabel) : null,
                ),
                { columns },
            );

            process.stdout.write(`${line}\n`);
        }

        // 2. Print summary banner
        process.stdout.write("\n");

        const summary = renderToString(
            React.createElement(CommandSummary, {
                cached: state.cached,
                failed: state.failed,
                failedIds,
                projectNames,
                retriedIds: state.retriedIds.length > 0 ? state.retriedIds : undefined,
                succeeded: state.succeeded,
                targets: args.targets,
                tasks,
                took,
            }),
            { columns },
        );

        process.stdout.write(`${summary}\n`);

        // 3. Print failed task output so the user can copy/inspect errors.
        //    `quiet` keeps the dump out of stdout — the logs are still in
        //    the TUI's scrollback, just not re-emitted below the summary.
        if (failedIds.length > 0 && outputStyle !== "quiet") {
            for (const taskId of failedIds) {
                const output = state.outputs.get(taskId);

                if (output?.trim()) {
                    const header = renderToString(
                        React.createElement(Text, null, "\n", React.createElement(Text, { bold: true, color: "red" }, `  ${CROSS}  vis run ${taskId}`)),
                        { columns },
                    );

                    process.stdout.write(`${header}\n\n`);
                    // Indent each output line for readability
                    const indented = output
                        .trim()
                        .split("\n")
                        .map((line) => `     ${line}`)
                        .join("\n");

                    process.stdout.write(`${indented}\n`);
                }
            }
        }
    };

    // Keepalive timer to prevent the event loop from draining after tasks complete
    let keepAliveTimer: ReturnType<typeof setInterval> | undefined;

    const clearKeepAlive = (): void => {
        if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
            keepAliveTimer = undefined;
        }
    };

    const lifeCycle: LifeCycleInterface = {
        endCommand(): void {
            cleanup();
            store.markDone();

            // The keepAliveTimer (already set by startCommand) is what holds
            // the loop open until the user quits. We deliberately do NOT
            // re-ref stdin here — Ink's `useInput` already maintains raw
            // mode and a stdin ref while the React tree is mounted, and
            // any extra `process.stdin.ref()` calls leak past Ink's
            // single `disableRawMode` unref on exit, hanging the CLI
            // after the TUI unmounts.
            if (!keepAliveTimer) {
                keepAliveTimer = setInterval(() => {}, 1000);
            }
        },

        endTasks(results: TaskResult[]): void {
            store.endTasks(results);
        },

        printCacheDisabledByTask(task: Task): void {
            // Surface the skip in the task's output buffer (shown in the
            // TUI output panel) — appending is layout-safe, unlike writing
            // to stdout while the React tree is mounted.
            store.addOutput(task.id, "ⓘ caching disabled by task via disableCache()\n");
        },

        printEmptyFingerprintWarning(task: Task, reason: string): void {
            store.addOutput(task.id, `ⓘ caching skipped — ${reason}\n`);
        },

        printSelfModifyingSkip(task: Task, modifiedFiles: string[]): void {
            store.addOutput(task.id, `ⓘ caching skipped — task modified its own input${modifiedFiles.length === 1 ? "" : "s"} (${modifiedFiles.join(", ")})\n`);
        },

        printTaskTerminalOutput(task: Task, _status: TaskStatus, output: string): void {
            // Only add if endTasks didn't already set it (avoids double output)
            if (!store.getSnapshot().outputs.has(task.id)) {
                store.addOutput(task.id, output);
            }
        },

        startCommand(): void {
            process.on("SIGINT", onSignal);
            process.on("SIGTERM", onSignal);

            // Keep event loop alive from the start to prevent beforeExit
            // from unmounting the TUI before tasks begin. Ink's `useInput`
            // owns stdin raw-mode + ref counting; do not duplicate it here
            // — extra refs would outlive Ink's single unref on exit and
            // hang the CLI when the user quits.
            if (!keepAliveTimer) {
                keepAliveTimer = setInterval(() => {}, 1000);
            }

            // Start the full-screen interactive TUI
            instance = render(
                React.createElement(VisTaskRunnerApp, {
                    autoExitSeconds,
                    onRetryService,
                    parallelSlots,
                    projectNames,
                    serviceDockStore,
                    stdinRegistry: stdinRegistry ?? new Map(),
                    store,
                    targets: args.targets,
                    tasks,
                }),
                {
                    alternateScreen: true,
                    exitOnCtrlC: false,
                    interactive: true,
                    patchConsole: true,
                },
            );

            instance
                .waitUntilExit()
                .then(() => {
                    clearKeepAlive();
                    killAllPtyProcesses();
                    releaseStdin();
                    process.removeListener("SIGINT", onSignal);
                    process.removeListener("SIGTERM", onSignal);

                    printExitSummary();
                    resolveDone();

                    return undefined;
                })
                .catch(() => {
                    clearKeepAlive();
                    killAllPtyProcesses();
                    releaseStdin();
                    process.removeListener("SIGINT", onSignal);
                    process.removeListener("SIGTERM", onSignal);
                    resolveDone();
                });
        },

        startTasks(started: Task[]): void {
            store.startTasks(started);

            if (!tickTimer) {
                tickTimer = setInterval(() => {
                    store.tick();
                }, 100);
            }
        },
    };

    return { lifeCycle, renderIsDone, store };
};
