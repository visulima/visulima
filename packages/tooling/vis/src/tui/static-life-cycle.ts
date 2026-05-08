import type { LifeCycleInterface, LogReporter, Task, TaskResult, TaskStatus } from "@visulima/task-runner";
import { renderToString } from "@visulima/tui";
import { Text } from "@visulima/tui/components/text";
import React from "react";

import type { VisTargetOptions } from "../task/target-options";
import CommandSummary from "./components/command-summary";
import Header from "./components/header";
import { formatFlags, formatTargetsAndProjects } from "./formatting-utils";
import { formatMs } from "./pretty-time";
import { getStatusIcon, isCacheStatus, logCommandOutputCI } from "./status-utils";

/**
 * Drives whether `printTaskTerminalOutput` actually prints. `"quiet"`
 * suppresses output for successful and cached tasks; failed tasks always
 * print so the user sees what broke. Per-target `options.outputStyle`
 * (read off `task.overrides.visOptions`) overrides this global default.
 */
export type OutputStyle = "normal" | "quiet";

/**
 * Coerces a free-form CLI / config string into the strict
 * {@link OutputStyle} union. Returns `"normal"` for unknown values so
 * a typo'd `--output-style=verbose` doesn't silently mute output.
 */
export const parseOutputStyle = (value: string | undefined): OutputStyle => (value === "quiet" ? "quiet" : "normal");

interface StaticOutputOptions {
    args: {
        targets: string[];
    };

    /**
     * Optional {@link LogReporter} that takes over `printTaskTerminalOutput`
     * when the user picks a `--log` mode. Absent, the CI-style
     * separator+status formatting is kept (vis's default).
     */
    logReporter?: LogReporter;
    /** Default verbosity. Per-target `options.outputStyle` overrides. */
    outputStyle?: OutputStyle;
    projectNames: string[];
    tasks: Task[];
}

/**
 * Resolves the effective output style for `task`. Per-target overrides
 * (set via `vis-task.ts`/`vis-config.ts` as `options.outputStyle`) take
 * precedence over the runner-wide default so a single noisy linter
 * can opt into quiet mode without changing the global flag.
 */
const resolveTaskOutputStyle = (task: Task, fallback: OutputStyle): OutputStyle => {
    const visOptions = task.overrides["visOptions"] as VisTargetOptions | undefined;

    if (visOptions?.outputStyle === "normal" || visOptions?.outputStyle === "quiet") {
        return visOptions.outputStyle;
    }

    return fallback;
};

/**
 * A lifecycle handler for CI environments that produces static, append-only output.
 * No cursor manipulation — just linear log lines.
 */
export class StaticOutputLifeCycle implements LifeCycleInterface {
    readonly #projectNames: string[];

    readonly #targets: string[];

    readonly #tasks: Task[];

    readonly #failedTasks: TaskResult[] = [];

    readonly #cachedTasks: TaskResult[] = [];

    readonly #allCompletedTasks = new Map<string, TaskResult>();

    readonly #logReporter: LogReporter | undefined;

    readonly #outputStyle: OutputStyle;

    #commandStartTime = 0;

    public constructor(options: StaticOutputOptions) {
        this.#projectNames = options.projectNames;
        this.#targets = options.args.targets;
        this.#tasks = options.tasks;
        this.#logReporter = options.logReporter;
        this.#outputStyle = options.outputStyle ?? "normal";
    }

    public startCommand(): void {
        this.#commandStartTime = Date.now();

        const columns = process.stdout.columns || 80;
        const title = `Running ${formatTargetsAndProjects(this.#projectNames, this.#targets, this.#tasks)}`;
        const header = renderToString(React.createElement(Header, { title, variant: "info" }), { columns });

        process.stdout.write(header);

        // Print overrides if any (skip internal "command" key)
        const firstTask = this.#tasks[0];
        const overrideEntries = firstTask?.overrides ? Object.entries(firstTask.overrides).filter(([flag]) => flag !== "command") : [];

        if (overrideEntries.length > 0) {
            process.stdout.write(`\n  With additional flags:\n`);

            for (const [flag, value] of overrideEntries) {
                process.stdout.write(`${formatFlags("    ", flag, value)}\n`);
            }
        }

        process.stdout.write("\n");
    }

    // eslint-disable-next-line class-methods-use-this -- LifeCycleInterface contract; the static variant has no instance state
    public startTasks(tasks: Task[]): void {
        const columns = process.stdout.columns || 80;

        for (const task of tasks) {
            const line = renderToString(React.createElement(Text, null, React.createElement(Text, { dimColor: true }, ">"), ` ${task.id}`), { columns });

            process.stdout.write(`${line}\n`);
        }
    }

    public endTasks(taskResults: TaskResult[]): void {
        const columns = process.stdout.columns || 80;

        for (const result of taskResults) {
            this.#allCompletedTasks.set(result.task.id, result);

            if (result.status === "failure") {
                this.#failedTasks.push(result);
            } else if (isCacheStatus(result.status)) {
                this.#cachedTasks.push(result);
            }

            const icon = getStatusIcon(result.status);
            const elapsedString = result.startTime && result.endTime ? ` (${formatMs(result.endTime - result.startTime)})` : "";
            const cacheLabelString = isCacheStatus(result.status) ? " [cache]" : "";

            const line = renderToString(
                React.createElement(
                    Text,
                    null,
                    icon,
                    `  ${result.task.id}`,
                    cacheLabelString ? React.createElement(Text, { color: "cyan" }, cacheLabelString) : null,
                    elapsedString ? React.createElement(Text, { dimColor: true }, elapsedString) : null,
                ),
                { columns },
            );

            process.stdout.write(`${line}\n`);
        }
    }

    public printTaskTerminalOutput(task: Task, status: TaskStatus, terminalOutput: string): void {
        // `quiet` swallows successful + cached output but keeps failures visible
        // so users still see what broke without scrolling past clean runs.
        // Skipped tasks aren't suppressed because a skip usually carries an
        // explanatory line the user wants to see (timeout, dep failure, etc.).
        if (resolveTaskOutputStyle(task, this.#outputStyle) === "quiet" && (status === "success" || isCacheStatus(status))) {
            return;
        }

        if (this.#logReporter) {
            this.#logReporter.printTaskTerminalOutput(task, status, terminalOutput);

            return;
        }

        logCommandOutputCI(task.id, status, terminalOutput);
    }

    public endCommand(): void {
        const totalTime = formatMs(Date.now() - this.#commandStartTime);

        // Detect skipped tasks (tasks that never completed due to dependency failures or bail)
        const skippedIds = this.#tasks.filter((t) => !this.#allCompletedTasks.has(t.id)).map((t) => t.id);

        // Empty line between task output and summary
        process.stdout.write("\n");

        const columns = process.stdout.columns || 80;
        const summary = renderToString(
            React.createElement(CommandSummary, {
                cached: this.#cachedTasks.length,
                failed: this.#failedTasks.length,
                failedIds: this.#failedTasks.map((r) => r.task.id),
                projectNames: this.#projectNames,
                skippedIds: skippedIds.length > 0 ? skippedIds : undefined,
                succeeded: this.#allCompletedTasks.size - this.#failedTasks.length - this.#cachedTasks.length,
                targets: this.#targets,
                tasks: this.#tasks,
                took: totalTime,
            }),
            { columns },
        );

        process.stdout.write(`${summary}\n`);
    }
}
