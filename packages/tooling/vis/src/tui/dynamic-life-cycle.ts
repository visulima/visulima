import type { LifeCycleInterface, Task, TaskResult, TaskStatus } from "@visulima/task-runner";
import type { Instance } from "@visulima/tui";
import { render, renderToString } from "@visulima/tui";
import { Text } from "@visulima/tui/components/text";
import React from "react";

import CommandSummary from "./components/command-summary";
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
    const { args, autoExit = false, outputStyle = "normal", projectNames, stdinRegistry, tasks } = options;

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
            const { status, taskId } = row;
            const info = getStatusInfo(status as TaskStatus);

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
                    break;
                }
            }

            const line = renderToString(
                React.createElement(
                    Text,
                    null,
                    "   ",
                    React.createElement(Text, { color: info.color }, info.icon),
                    `  vis run ${taskId}`,
                    cacheLabel ? React.createElement(Text, { dimColor: true }, `  ${cacheLabel}`) : null,
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

            // Keep event loop alive + ensure stdin stays in raw mode for keyboard input
            if (!keepAliveTimer) {
                keepAliveTimer = setInterval(() => {}, 1000);
            }

            if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
                process.stdin.setRawMode(true);
                process.stdin.ref();
                process.stdin.resume();
            }
        },

        endTasks(results: TaskResult[]): void {
            store.endTasks(results);
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
            // from unmounting the TUI before tasks begin
            if (!keepAliveTimer) {
                keepAliveTimer = setInterval(() => {}, 1000);
            }

            // Ensure stdin stays in raw mode for keyboard interaction
            if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
                process.stdin.setRawMode(true);
                process.stdin.ref();
                process.stdin.resume();
            }

            // Start the full-screen interactive TUI
            instance = render(
                React.createElement(VisTaskRunnerApp, {
                    autoExitSeconds,
                    parallelSlots,
                    projectNames,
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
                    process.removeListener("SIGINT", onSignal);
                    process.removeListener("SIGTERM", onSignal);

                    printExitSummary();
                    resolveDone();

                    return undefined;
                })
                .catch(() => {
                    clearKeepAlive();
                    killAllPtyProcesses();
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
