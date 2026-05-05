// eslint-disable-next-line e18e/ban-dependencies -- staged workflow port relies on execa's `input`/`reject:false`/stream-pipe semantics that tinyexec doesn't expose
import { execa } from "execa";

import { ConfigError, TaskError } from "../errors";

/**
 * Minimal quote-aware argv splitter. Handles single and double quotes,
 * backslash escapes (both outside and inside double quotes, matching
 * POSIX shell semantics), and collapses runs of whitespace — enough for
 * the shell-like syntax users put in their staged config without
 * dragging in `string-argv`.
 *
 * Inside single quotes everything is literal (POSIX semantics). Inside
 * double quotes, `\"` and `\\` are interpreted; other backslash
 * sequences are preserved verbatim.
 *
 * Throws `ConfigError` on unterminated quotes so typos in config fail
 * fast instead of silently swallowing the rest of the command.
 */
export const parseCommandString = (input: string): string[] => {
    const tokens: string[] = [];
    let buffer = "";
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < input.length; i += 1) {
        const character = input[i];

        if (character === undefined) {
            break;
        }

        // Backslash escapes: outside any quotes, escape the next character verbatim.
        // Inside double quotes, only `\"` and `\\` are recognised; other sequences keep the backslash.
        // Inside single quotes backslashes are literal (POSIX sh behaviour).
        if (character === "\\" && !inSingle && i + 1 < input.length) {
            const next = input[i + 1];

            if (next !== undefined) {
                if (inDouble && next !== '"' && next !== "\\") {
                    buffer += character;
                    buffer += next;
                } else {
                    buffer += next;
                }

                i += 1;

                continue;
            }
        }

        if (character === '"' && !inSingle) {
            inDouble = !inDouble;

            continue;
        }

        if (character === "'" && !inDouble) {
            inSingle = !inSingle;

            continue;
        }

        if (!inSingle && !inDouble && /\s/.test(character)) {
            if (buffer.length > 0) {
                tokens.push(buffer);
                buffer = "";
            }

            continue;
        }

        buffer += character;
    }

    if (inSingle || inDouble) {
        throw new ConfigError(`Unterminated ${inSingle ? "single" : "double"} quote in command: ${input}`);
    }

    if (buffer.length > 0) {
        tokens.push(buffer);
    }

    return tokens;
};

/**
 * Platform-aware default for the maximum per-invocation argv byte length.
 *
 * Linux `execve()` caps `ARG_MAX` at ~128 KiB on most kernels; macOS sits at
 * 256 KiB. Windows `CreateProcess` caps the full command line at 32,767
 * UTF-16 code units (~65 KiB in the worst ASCII case, tighter for non-ASCII),
 * so we pick a conservative 28 KiB limit there to leave headroom for the
 * argv prefix and environment overhead that Node splices in.
 */
const DEFAULT_MAX_ARG_LENGTH: number = process.platform === "win32" ? 28_000 : 131_072;

/**
 * Splits `files` into chunks whose combined byte length (plus a shared
 * fixed-prefix length) does not exceed `maxArgLength`. Guarantees at
 * least one file per chunk so extremely long individual paths still
 * make it through.
 */
export const chunkFiles = (files: ReadonlyArray<string>, fixedPrefixLength: number, maxArgLength: number): string[][] => {
    const chunks: string[][] = [];
    let current: string[] = [];
    let currentLength = fixedPrefixLength;
    const limit = maxArgLength <= 0 ? DEFAULT_MAX_ARG_LENGTH : maxArgLength;

    for (const file of files) {
        const fileLength = Buffer.byteLength(file) + 1;

        if (current.length > 0 && currentLength + fileLength > limit) {
            chunks.push(current);
            current = [];
            currentLength = fixedPrefixLength;
        }

        current.push(file);
        currentLength += fileLength;
    }

    if (current.length > 0) {
        chunks.push(current);
    }

    return chunks;
};

export interface ExecCommandOptions {
    readonly cwd: string;
    readonly env?: Record<string, string>;

    /**
     * Signal delivered to the child process when `signal` fires. Defaults to `SIGTERM`
     * (graceful). Use `SIGKILL` for fast-fail runs where graceful shutdown is not
     * worth the wait.
     */
    readonly killSignal?: NodeJS.Signals;
    readonly maxArgLength?: number;
    /** Aborted when the caller cancels the run (e.g. another task failed without `continueOnError`). */
    readonly signal?: AbortSignal;
}

export interface ExecCommandResult {
    readonly durationMs: number;
    readonly output: string;
}

/**
 * Runs a command once per file-chunk, concatenating stdout/stderr for
 * renderer consumption. Throws `TaskError` on the first failing chunk
 * or when the caller's `AbortSignal` fires mid-invocation.
 */
export const execCommand = async (command: string, files: ReadonlyArray<string>, options: ExecCommandOptions): Promise<ExecCommandResult> => {
    const argv = parseCommandString(command);

    if (argv.length === 0) {
        throw new TaskError(command, `Empty command for staged task.`);
    }

    const [program, ...baseArgs] = argv;

    if (program === undefined) {
        throw new TaskError(command, `Empty command for staged task.`);
    }

    const prefixLength = Buffer.byteLength(program) + baseArgs.reduce((total, argument) => total + Buffer.byteLength(argument) + 1, 0);
    const chunks = chunkFiles(files, prefixLength, options.maxArgLength ?? DEFAULT_MAX_ARG_LENGTH);
    const started = Date.now();
    const outputs: string[] = [];

    for (const chunk of chunks) {
        if (options.signal?.aborted === true) {
            throw new TaskError(command, "Task aborted by earlier failure.");
        }

        const result = await execa(program, [...baseArgs, ...chunk], {
            cancelSignal: options.signal,
            cwd: options.cwd,
            // Pipe stdout/stderr so we can capture task output for the renderer, but forward `FORCE_COLOR=1`
            // unless the user has already set it — tools like eslint / prettier check isTTY, which is false
            // when piped, and drop ANSI styling without this hint. Matches lint-staged / nano-staged behavior.
            env: buildTaskEnv(options.env),
            // Signal delivered to the child when `cancelSignal` aborts. Defaults to SIGTERM for graceful
            // shutdown; callers can set SIGKILL via `killSignal` for fast-fail runs.
            killSignal: options.killSignal ?? "SIGTERM",
            reject: false,
            stderr: "pipe",
            stdout: "pipe",
        });

        const stdout = typeof result.stdout === "string" ? result.stdout : "";
        const stderr = typeof result.stderr === "string" ? result.stderr : "";
        const merged = [stdout, stderr].filter((s) => s.length > 0).join("\n");

        if (merged.length > 0) {
            outputs.push(merged);
        }

        // Treat signal termination and cancellation as failures even though
        // execa may report `exitCode: undefined` (child killed by signal) or
        // leave an `isCanceled`/`isTerminated` flag. Without this guard, a
        // SIGTERM'd child under `cancelSignal` falls through as success.
        if (result.isCanceled || result.isTerminated || typeof result.exitCode !== "number") {
            const reason = result.isCanceled
                ? "Task aborted by earlier failure."
                : result.isTerminated
                    ? `Task killed by signal ${result.signal ?? "(unknown)"}.`
                    : merged.trim() || `Task exited without a numeric status code.`;

            throw new TaskError(command, reason);
        }

        if (result.exitCode !== 0) {
            throw new TaskError(command, merged.trim() || `Exit code ${result.exitCode} from ${program}`);
        }
    }

    return { durationMs: Date.now() - started, output: outputs.join("\n") };
};

/**
 * Builds the environment for a task subprocess. Merges caller-supplied overrides on top of
 * `process.env`, and injects `FORCE_COLOR=1` when the parent stderr is a TTY so linters /
 * formatters don't silently strip color from their piped output.
 */
const buildTaskEnv = (overrides: Record<string, string> | undefined): Record<string, string> => {
    const base = { ...process.env } as Record<string, string>;

    if (process.stderr.isTTY && base["FORCE_COLOR"] === undefined && base["NO_COLOR"] === undefined) {
        base["FORCE_COLOR"] = "1";
    }

    return overrides ? { ...base, ...overrides } : base;
};

export { DEFAULT_MAX_ARG_LENGTH };
