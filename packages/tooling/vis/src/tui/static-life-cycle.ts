import type { LifeCycleInterface, LogReporter, Task, TaskResult, TaskStatus } from "@visulima/task-runner";
import { renderToString } from "@visulima/tui";
import { Text } from "@visulima/tui/components/text";
import React from "react";

import type { VisTargetOptions } from "../task/target-options";
import CommandSummary from "./components/command-summary";
import Header from "./components/header";
import { renderFailureOutput } from "./failure-render";
import { formatFlags, formatTargetsAndProjects } from "./formatting-utils";
import { formatMs } from "./pretty-time";
import type { CiGroupingMode } from "./status-utils";
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

/**
 * Resolves the run-wide {@link OutputStyle} from the optional
 * `--output-style` flag and the `run.quietOnSuccess` config knob. An
 * explicit flag always wins (parsed leniently); absent the flag, output is
 * `normal` unless config opts in with `quietOnSuccess: true`, which
 * silences successful and cached tasks while keeping failures visible.
 */
export const resolveOutputStyle = (flag: string | undefined, quietOnSuccess: boolean | undefined): OutputStyle => {
    if (typeof flag === "string") {
        return parseOutputStyle(flag.toLowerCase());
    }

    return quietOnSuccess === true ? "quiet" : "normal";
};

interface StaticOutputOptions {
    args: {
        targets: string[];
    };

    /**
     * CI log grouping mode. `auto` (the default) detects GitHub / GitLab
     * via env vars and emits the matching collapsible directives so the
     * web UI can fold per-task output. `off` keeps the raw separators.
     * Sourced from `vis-config.ts → run.ciGrouping`.
     */
    ciGrouping?: CiGroupingMode;

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

    readonly #retriedTasks: TaskResult[] = [];

    readonly #allCompletedTasks = new Map<string, TaskResult>();

    readonly #logReporter: LogReporter | undefined;

    readonly #outputStyle: OutputStyle;

    readonly #ciGrouping: CiGroupingMode;

    #commandStartTime = 0;

    public constructor(options: StaticOutputOptions) {
        this.#projectNames = options.projectNames;
        this.#targets = options.args.targets;
        this.#tasks = options.tasks;
        this.#logReporter = options.logReporter;
        this.#outputStyle = options.outputStyle ?? "normal";
        this.#ciGrouping = options.ciGrouping ?? "auto";
    }

    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
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

    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
    public startTasks(tasks: Task[]): void {
        const columns = process.stdout.columns || 80;

        for (const task of tasks) {
            const line = renderToString(React.createElement(Text, null, React.createElement(Text, { dimColor: true }, ">"), ` ${task.id}`), { columns });

            process.stdout.write(`${line}\n`);
        }
    }

    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
    public endTasks(taskResults: TaskResult[]): void {
        const columns = process.stdout.columns || 80;

        for (const result of taskResults) {
            this.#allCompletedTasks.set(result.task.id, result);

            if (result.status === "failure") {
                this.#failedTasks.push(result);
            } else if (isCacheStatus(result.status)) {
                this.#cachedTasks.push(result);
            }

            // Tracked separately from success/failure so the final summary
            // can warn even on a clean run that masked a flake via retries.
            if (result.retryAttempts && result.retryAttempts > 0) {
                this.#retriedTasks.push(result);
            }

            const icon = getStatusIcon(result.status);
            const elapsedString = result.startTime && result.endTime ? ` (${formatMs(result.endTime - result.startTime)})` : "";
            const cacheLabelString = isCacheStatus(result.status) ? " [cache]" : "";
            const retryLabelString = result.retryAttempts && result.retryAttempts > 0 ? ` [retried ${result.retryAttempts}x]` : "";

            const line = renderToString(
                React.createElement(
                    Text,
                    null,
                    icon,
                    `  ${result.task.id}`,
                    cacheLabelString ? React.createElement(Text, { color: "cyan" }, cacheLabelString) : null,
                    retryLabelString ? React.createElement(Text, { color: "yellow" }, retryLabelString) : null,
                    elapsedString ? React.createElement(Text, { dimColor: true }, elapsedString) : null,
                ),
                { columns },
            );

            process.stdout.write(`${line}\n`);
        }
    }

    #printCacheNotice(message: string): void {
        const columns = process.stdout.columns || 80;
        const line = renderToString(React.createElement(Text, { dimColor: true }, `  ⓘ ${message}`), { columns });

        process.stdout.write(`${line}\n`);
    }

    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
    public printCacheDisabledByTask(task: Task): void {
        this.#printCacheNotice(`${task.id}: caching disabled by task via disableCache()`);
    }

    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
    public printSelfModifyingSkip(task: Task, modifiedFiles: string[]): void {
        this.#printCacheNotice(
            `${task.id}: caching skipped — task modified its own input${modifiedFiles.length === 1 ? "" : "s"} (${modifiedFiles.join(", ")})`,
        );
    }

    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
    public printEmptyFingerprintWarning(task: Task, reason: string): void {
        this.#printCacheNotice(`${task.id}: caching skipped — ${reason}`);
    }

    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
    public printTaskTerminalOutput(task: Task, status: TaskStatus, terminalOutput: string): void {
        // `quiet` swallows successful + cached output but keeps failures visible
        // so users still see what broke without scrolling past clean runs.
        // Skipped tasks aren't suppressed because a skip usually carries an
        // explanatory line the user wants to see (timeout, dep failure, etc.).
        if (resolveTaskOutputStyle(task, this.#outputStyle) === "quiet" && (status === "success" || isCacheStatus(status))) {
            return;
        }

        // Failures get the source-mapped, code-framed render in the CI/non-TUI
        // human log too; everything else passes through untouched.
        const rendered = status === "failure" ? renderFailureOutput(terminalOutput, { color: !process.env["NO_COLOR"], cwd: process.cwd() }) : terminalOutput;

        if (this.#logReporter) {
            this.#logReporter.printTaskTerminalOutput(task, status, rendered);

            return;
        }

        logCommandOutputCI(task.id, status, rendered, this.#ciGrouping);
    }

    // fallow-ignore-next-line unused-class-member -- public TUI store/life-cycle method driven by the React TUI components
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
                retriedIds: this.#retriedTasks.length > 0 ? this.#retriedTasks.map((r) => r.task.id) : undefined,
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
