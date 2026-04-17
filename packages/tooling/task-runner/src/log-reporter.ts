import type { LifeCycleInterface, Task, TaskResult, TaskStatus } from "./types";

/**
 * Output formatting mode for task terminal output.
 *
 * - `interleaved` **(default)**: emit each task's buffered output as-is
 *   — lines from parallel tasks may intermix when streamed live.
 * - `labeled`: prefix every line with `[project#target]` so parallel
 *   tasks remain distinguishable.
 * - `grouped`: buffer each task's output and print it as a single block
 *   bracketed by `── project#target ──` header and blank-line footer.
 *
 * Matches the three modes exposed by vite-task's `--log` flag.
 */
export type LogMode = "grouped" | "interleaved" | "labeled";

const formatTaskLabel = (task: Task): string => `${task.target.project}#${task.target.target}`;

const prefixLines = (text: string, label: string): string => {
    // Preserve a trailing newline so multi-task output concatenates cleanly.
    const trailing = text.endsWith("\n") ? "\n" : "";
    const body = trailing ? text.slice(0, -1) : text;

    if (body.length === 0) {
        return trailing;
    }

    return `${body.split("\n").map((line) => `[${label}] ${line}`).join("\n")}${trailing}`;
};

/**
 * A lifecycle handler that renders task terminal output per {@link LogMode}.
 *
 * Operates on the buffered `printTaskTerminalOutput` signal the orchestrator
 * emits at task-completion. Line-by-line streaming is the consumer's
 * responsibility — a streaming reporter can wrap this one and emit buffered
 * output at the end of each task regardless of streaming choices.
 */
export class LogReporter implements LifeCycleInterface {
    readonly #mode: LogMode;

    readonly #write: (chunk: string) => void;

    public constructor(mode: LogMode, write: (chunk: string) => void = (chunk) => process.stdout.write(chunk)) {
        this.#mode = mode;
        this.#write = write;
    }

    public printTaskTerminalOutput(task: Task, _status: TaskStatus, terminalOutput: string): void {
        if (terminalOutput.length === 0) {
            return;
        }

        if (this.#mode === "interleaved") {
            this.#write(terminalOutput.endsWith("\n") ? terminalOutput : `${terminalOutput}\n`);

            return;
        }

        const label = formatTaskLabel(task);

        if (this.#mode === "labeled") {
            this.#write(prefixLines(terminalOutput.endsWith("\n") ? terminalOutput : `${terminalOutput}\n`, label));

            return;
        }

        // grouped
        const body = terminalOutput.endsWith("\n") ? terminalOutput : `${terminalOutput}\n`;

        this.#write(`── ${label} ──\n${body}\n`);
    }

    // eslint-disable-next-line class-methods-use-this
    public endTasks(_taskResults: TaskResult[]): void {
        // no-op — modes differ only in how the output block is rendered.
    }
}

/**
 * Convenience factory matching vite-task's `createLogReporter(mode)` surface.
 * Consumers that already compose their own lifecycle handlers can instantiate
 * {@link LogReporter} directly.
 */
export const createLogReporter = (mode: LogMode, write?: (chunk: string) => void): LogReporter => new LogReporter(mode, write);
