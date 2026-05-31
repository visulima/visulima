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

/**
 * How the reporter handles ANSI escape sequences in the buffered output
 * it receives.
 *
 * - `auto` **(default)**: detect color capability of the write target;
 *   strip escapes when stdout isn't a TTY, `NO_COLOR` is set, or
 *   `TERM=dumb`. Matches what colorize libraries do for live output.
 * - `always`: keep escapes — useful when piping into another tool that
 *   understands ANSI.
 * - `never`: always strip — useful for log files / JSON-collecting CI.
 *
 * Live spawn output is captured with `FORCE_COLOR=1` so cache entries
 * always contain colored bytes; without this control, replaying a cache
 * hit into a non-color destination prints raw escape sequences. See
 * voidzero-dev/vite-task#358 / #378.
 */
export type ColorMode = "always" | "auto" | "never";

const ANSI_ESCAPE_PATTERN = /[][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

const stripAnsi = (input: string): string => input.replace(ANSI_ESCAPE_PATTERN, "");

const detectColorSupport = (): boolean => {
    if (process.env["NO_COLOR"] !== undefined && process.env["NO_COLOR"] !== "") {
        return false;
    }

    if (process.env["FORCE_COLOR"] !== undefined && process.env["FORCE_COLOR"] !== "" && process.env["FORCE_COLOR"] !== "0") {
        return true;
    }

    if (process.env["TERM"] === "dumb") {
        return false;
    }

    return Boolean(process.stdout.isTTY);
};

const formatTaskLabel = (task: Task): string => `${task.target.project}#${task.target.target}`;

const prefixLines = (text: string, label: string): string => {
    // Preserve a trailing newline so multi-task output concatenates cleanly.
    const trailing = text.endsWith("\n") ? "\n" : "";
    const body = trailing ? text.slice(0, -1) : text;

    if (body.length === 0) {
        return trailing;
    }

    return `${body
        .split("\n")
        .map((line) => `[${label}] ${line}`)
        .join("\n")}${trailing}`;
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

    readonly #stripColor: boolean;

    public constructor(
        mode: LogMode,
        write: (chunk: string) => void = (chunk) => process.stdout.write(chunk),
        color: ColorMode = "auto",
    ) {
        this.#mode = mode;
        this.#write = write;
        // Resolve once at construction so a stable destination is treated
        // consistently for the lifetime of the reporter. Caller can still
        // force the choice via the `color` parameter.
        this.#stripColor = color === "never" || (color === "auto" && !detectColorSupport());
    }

    public printTaskTerminalOutput(task: Task, _status: TaskStatus, terminalOutput: string): void {
        if (terminalOutput.length === 0) {
            return;
        }

        const output = this.#stripColor ? stripAnsi(terminalOutput) : terminalOutput;

        if (this.#mode === "interleaved") {
            this.#write(output.endsWith("\n") ? output : `${output}\n`);

            return;
        }

        const label = formatTaskLabel(task);

        if (this.#mode === "labeled") {
            this.#write(prefixLines(output.endsWith("\n") ? output : `${output}\n`, label));

            return;
        }

        // grouped
        const body = output.endsWith("\n") ? output : `${output}\n`;

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
export const createLogReporter = (mode: LogMode, write?: (chunk: string) => void, color?: ColorMode): LogReporter =>
    new LogReporter(mode, write, color);
