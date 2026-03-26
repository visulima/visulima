import { cursorHide, cursorShow } from "@visulima/ansi";
import { cyan, dim, green, red, yellow } from "@visulima/colorize";

import type { LifeCycleInterface, Task, TaskResult, TaskStatus } from "@visulima/task-runner";

import { formatTargetsAndProjects } from "./formatting-utils";
import { cliOutput } from "./output";
import { formatMs } from "./pretty-time";
import { SPINNER_FRAMES, TICK, CROSS } from "./symbols";

interface TaskRow {
    startTime?: [number, number];
    status: "pending" | "running" | TaskStatus;
    task: Task;
}

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

/**
 * Creates a dynamic TUI renderer for local development with cursor rewriting,
 * spinners, and a continuously updated pinned footer.
 */
export const createDynamicOutputRenderer = (options: DynamicOutputOptions): DynamicOutputResult => {
    const { args, projectNames, tasks } = options;

    const taskRows: TaskRow[] = tasks.map((task) => ({ status: "pending" as const, task }));
    const tasksToTerminalOutputs = new Map<string, string>();

    let totalCompletedTasks = 0;
    let totalSuccessfulTasks = 0;
    let totalFailedTasks = 0;
    let totalCachedTasks = 0;
    let pinnedFooterNumLines = 0;
    let currentFrame = 0;
    let renderInterval: ReturnType<typeof setInterval> | undefined;
    let commandStartTime: number;

    let resolveRenderIsDone: () => void;
    const renderIsDone = new Promise<void>((resolve) => {
        resolveRenderIsDone = resolve;
    });

    const getRunningTasks = (): TaskRow[] => taskRows.filter((r) => r.status === "running");
    const getSpinner = (): string => SPINNER_FRAMES[currentFrame % SPINNER_FRAMES.length] as string;

    const renderFooter = (): string[] => {
        const running = getRunningTasks();
        const totalTasks = taskRows.length;
        const remaining = totalTasks - totalCompletedTasks;
        const lines: string[] = [];

        // Blank separator line
        lines.push("");

        // Status line
        const parts: string[] = [];

        if (remaining > 0) {
            parts.push(`${cyan(String(remaining))} remaining`);
        }

        if (totalSuccessfulTasks > 0) {
            parts.push(`${green(String(totalSuccessfulTasks))} succeeded`);
        }

        if (totalCachedTasks > 0) {
            parts.push(`${green(String(totalCachedTasks))} cached`);
        }

        if (totalFailedTasks > 0) {
            parts.push(`${red(String(totalFailedTasks))} failed`);
        }

        if (parts.length > 0) {
            lines.push(`   ${parts.join(dim("  |  "))}`);
        }

        lines.push("");

        // Running tasks with spinners
        for (const row of running) {
            const spinner = yellow(getSpinner());
            const elapsed = row.startTime ? formatMs(process.hrtime(row.startTime)[0] * 1000 + process.hrtime(row.startTime)[1] / 1_000_000) : "";
            const elapsedSuffix = elapsed ? dim(` (${elapsed})`) : "";

            lines.push(`   ${spinner}  ${row.task.id}${elapsedSuffix}`);
        }

        if (running.length === 0 && remaining > 0) {
            lines.push(`   ${dim("Waiting for tasks...")}`);
        }

        lines.push("");

        return lines;
    };

    const render = (): void => {
        currentFrame++;
        const lines = renderFooter();

        cliOutput.overwriteLines(pinnedFooterNumLines, lines);
        pinnedFooterNumLines = lines.length;
    };

    const restoreCursor = (): void => {
        process.stdout.write(cursorShow);
    };

    const handleSignal = (): void => {
        restoreCursor();

        if (renderInterval) {
            clearInterval(renderInterval);
        }

        process.exit(1);
    };

    const lifeCycle: LifeCycleInterface = {
        endCommand(): void {
            if (renderInterval) {
                clearInterval(renderInterval);
                renderInterval = undefined;
            }

            // Clear the pinned footer
            if (pinnedFooterNumLines > 0) {
                cliOutput.overwriteLines(pinnedFooterNumLines, []);
                pinnedFooterNumLines = 0;
            }

            const totalTime = formatMs(Date.now() - commandStartTime);

            // Print final summary
            if (totalFailedTasks === 0) {
                const cacheNote = totalCachedTasks > 0 ? dim(` (${totalCachedTasks} read from cache)`) : "";

                process.stdout.write(
                    cliOutput.success(`Successfully ran ${formatTargetsAndProjects(projectNames, args.targets, tasks)}`, [
                        `${green(TICK)} ${totalSuccessfulTasks + totalCachedTasks} tasks completed${cacheNote}`,
                        dim(`   Took ${totalTime}`),
                    ]),
                );
            } else {
                const failedRows = taskRows.filter((r) => r.status === "failure");
                const failedLines = failedRows.map((r) => `  ${red(CROSS)}  ${r.task.id}`);

                process.stdout.write(
                    cliOutput.error(`Ran ${formatTargetsAndProjects(projectNames, args.targets, tasks)}`, [
                        `${red(String(totalFailedTasks))} task${totalFailedTasks === 1 ? "" : "s"} failed:`,
                        ...failedLines,
                        "",
                        dim(`Took ${totalTime}`),
                    ]),
                );
            }

            restoreCursor();

            process.removeListener("SIGINT", handleSignal);
            process.removeListener("SIGTERM", handleSignal);

            resolveRenderIsDone();
        },

        endTasks(taskResults: TaskResult[]): void {
            for (const result of taskResults) {
                const row = taskRows.find((r) => r.task.id === result.task.id);

                if (row) {
                    row.status = result.status;
                }

                totalCompletedTasks++;

                switch (result.status) {
                    case "success": {
                        totalSuccessfulTasks++;
                        break;
                    }
                    case "local-cache":
                    case "local-cache-kept-existing":
                    case "remote-cache": {
                        totalCachedTasks++;
                        break;
                    }
                    case "failure": {
                        totalFailedTasks++;
                        break;
                    }
                    // no default
                }

                if (result.terminalOutput) {
                    tasksToTerminalOutputs.set(result.task.id, result.terminalOutput);
                }

                // Print completed task line (above the pinned footer)
                const elapsed =
                    result.startTime && result.endTime ? dim(` (${formatMs(result.endTime - result.startTime)})`) : "";

                const icon = cliOutput.getStatusIcon(result.status);
                const cacheLabel = isCacheStatus(result.status) ? cyan(" [cache]") : "";

                // Erase footer, print result line, re-render footer
                if (pinnedFooterNumLines > 0) {
                    cliOutput.overwriteLines(pinnedFooterNumLines, []);
                    pinnedFooterNumLines = 0;
                }

                process.stdout.write(`   ${icon}  ${result.task.id}${cacheLabel}${elapsed}\n`);

                // Re-render footer immediately
                const lines = renderFooter();

                for (const line of lines) {
                    process.stdout.write(line + "\n");
                }

                pinnedFooterNumLines = lines.length;
            }
        },

        printTaskTerminalOutput(task: Task, status: TaskStatus, terminalOutput: string): void {
            if (status === "failure" && terminalOutput.trim()) {
                // For failures, print output above footer
                if (pinnedFooterNumLines > 0) {
                    cliOutput.overwriteLines(pinnedFooterNumLines, []);
                    pinnedFooterNumLines = 0;
                }

                cliOutput.logCommandOutput(task.id, status, terminalOutput);

                // Re-render footer
                const lines = renderFooter();

                for (const line of lines) {
                    process.stdout.write(line + "\n");
                }

                pinnedFooterNumLines = lines.length;
            }
        },

        startCommand(): void {
            commandStartTime = Date.now();

            process.stdout.write(cursorHide);
            process.on("SIGINT", handleSignal);
            process.on("SIGTERM", handleSignal);

            const header = cliOutput.applyPrefix(
                cyan,
                `Running ${formatTargetsAndProjects(projectNames, args.targets, tasks)}`,
            );

            process.stdout.write(header);

            // Initial footer render
            const lines = renderFooter();

            for (const line of lines) {
                process.stdout.write(line + "\n");
            }

            pinnedFooterNumLines = lines.length;
        },

        startTasks(startedTasks: Task[]): void {
            for (const task of startedTasks) {
                const row = taskRows.find((r) => r.task.id === task.id);

                if (row) {
                    row.status = "running";
                    row.startTime = process.hrtime();
                }
            }

            if (!renderInterval) {
                renderInterval = setInterval(render, 100);
            }
        },
    };

    return { lifeCycle, renderIsDone };
};

const isCacheStatus = (status: TaskStatus): boolean =>
    status === "local-cache" || status === "local-cache-kept-existing" || status === "remote-cache";
