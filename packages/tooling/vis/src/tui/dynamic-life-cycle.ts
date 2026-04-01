import React from "react";
import type { Instance } from "@visulima/tui";
import { render, renderToString } from "@visulima/tui";
import type { LifeCycleInterface, Task, TaskResult, TaskStatus } from "@visulima/task-runner";

import DynamicTaskRunner, { TaskStore } from "./components/DynamicTaskRunner";
import Header from "./components/Header";
import { formatTargetsAndProjects } from "./formatting-utils";

interface DynamicOutputOptions {
    args: {
        parallel?: boolean | number;
        targets: string[];
    };
    projectNames: string[];
    tasks: Task[];
}

interface DynamicOutputResult {
    lifeCycle: LifeCycleInterface;
    renderIsDone: Promise<void>;
}

export const createDynamicOutputRenderer = (options: DynamicOutputOptions): DynamicOutputResult => {
    const { args, projectNames, tasks } = options;

    const store = new TaskStore(tasks);
    const parallelSlots = typeof args.parallel === "number" ? args.parallel : undefined;

    let instance: Instance | undefined;
    let resolveDone: () => void;
    const renderIsDone = new Promise<void>((r) => {
        resolveDone = r;
    });

    // Tick interval for updating elapsed times on running tasks
    let tickTimer: ReturnType<typeof setInterval> | undefined;

    const onSignal = (): void => {
        if (tickTimer) {
            clearInterval(tickTimer);
            tickTimer = undefined;
        }

        instance?.unmount();
        process.exit(1);
    };

    const lifeCycle: LifeCycleInterface = {
        endCommand(): void {
            if (tickTimer) {
                clearInterval(tickTimer);
                tickTimer = undefined;
            }

            // Mark done — triggers the summary render
            store.markDone();

            // Give React one frame to render the summary, then unmount
            setTimeout(() => {
                instance?.unmount();
                process.removeListener("SIGINT", onSignal);
                process.removeListener("SIGTERM", onSignal);
                resolveDone();
            }, 50);
        },

        endTasks(results: TaskResult[]): void {
            store.endTasks(results);
        },

        printTaskTerminalOutput(task: Task, _status: TaskStatus, output: string): void {
            store.addOutput(task.id, output);
        },

        startCommand(): void {
            process.on("SIGINT", onSignal);
            process.on("SIGTERM", onSignal);

            // Print header before the live render region
            const title = `Running ${formatTargetsAndProjects(projectNames, args.targets, tasks)}`;
            const headerOutput = renderToString(
                React.createElement(Header, { title, variant: "info" }),
                { columns: process.stdout.columns || 80 },
            );

            process.stdout.write(headerOutput + "\n");

            // Start the live React render
            instance = render(
                React.createElement(DynamicTaskRunner, {
                    parallelSlots,
                    projectNames,
                    store,
                    targets: args.targets,
                    tasks,
                }),
                {
                    patchConsole: true,
                },
            );
        },

        startTasks(started: Task[]): void {
            store.startTasks(started);

            // Start ticking elapsed times for running tasks
            if (!tickTimer) {
                tickTimer = setInterval(() => {
                    store.tick();
                }, 100);
            }
        },
    };

    return { lifeCycle, renderIsDone };
};
