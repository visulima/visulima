import { spawn } from "node:child_process";

export interface SpawnTeeResult {
    code: number;
    output: string;
}

export interface SpawnTeeOptions {
    cwd: string;
    env?: NodeJS.ProcessEnv;
}

/**
 * Cap captured output at 256 KiB. The buffer is only used for peer-dep
 * warning detection — a sliding tail covers every realistic PM run
 * without unbounded growth on long installs (large monorepos can emit
 * megabytes of progress output). The tail is what matters: warning
 * summaries land near the end of the stream.
 */
const MAX_CAPTURED_BYTES = 256 * 1024;

/**
 * Build the child env for {@link spawnTee}. Inject `FORCE_COLOR=1` when
 * the parent stderr is a TTY so PMs don't strip ANSI from their piped
 * output — without this, the user sees a flat, colorless install log
 * even though they're running in a terminal. Skip when the user (or
 * the test harness) has already pinned `FORCE_COLOR` or `NO_COLOR`.
 *
 * Mirrors the same pattern used by {@link "../staged/tasks/exec".buildTaskEnv}.
 */
const buildChildEnv = (override: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv => {
    const base: NodeJS.ProcessEnv = override ? { ...process.env, ...override } : { ...process.env };

    if (process.stderr.isTTY && base.FORCE_COLOR === undefined && base.NO_COLOR === undefined) {
        base.FORCE_COLOR = "1";
    }

    return base;
};

/**
 * Quote a single argument for cmd.exe when {@link spawnTee} runs with
 * `shell: true` on Windows. Node joins the args array into one command
 * line without quoting, so an arg containing shell metacharacters
 * (ampersand, pipe, caret, angle brackets, spaces, …) — e.g. a
 * repo-derived path like `app & calc` — would otherwise be interpreted by
 * cmd.exe rather than passed through literally.
 *
 * We wrap in double quotes (escaping embedded quotes and trailing
 * backslashes per cmd.exe rules) and caret-escape the metacharacters
 * cmd.exe still honours inside quotes. Args without any special
 * character are passed through unchanged so well-formed install flags
 * (`--prod`, package specs) are unaffected.
 *
 * Exported for tests.
 */
export const quoteWindowsArgument = (argument: string): string => {
    if (argument !== "" && !/[\s"&()<>^|%!]/u.test(argument)) {
        return argument;
    }

    // Escape backslashes that precede a quote (and at end of string) so the
    // quote isn't treated as an escape, then double embedded quotes.
    const escaped = argument.replaceAll(/(\\*)"/gu, String.raw`$1$1\"`).replace(/(\\+)$/u, "$1$1");

    // Caret-escape cmd.exe metacharacters that survive inside double quotes.
    const carets = escaped.replaceAll(/[&()<>^|%!]/gu, String.raw`^$&`);

    return `"${carets}"`;
};

/**
 * Spawn a child process, mirror its stdout/stderr to the parent
 * terminal in real-time, and also collect the combined output for
 * post-run inspection (peer-dep warning detection, etc.).
 *
 * Inheriting stdin keeps interactive prompts (e.g. pnpm `approve-builds`)
 * working. Stdout/stderr are piped + teed because `stdio: "inherit"`
 * would deny us a buffer to grep over after the install finishes.
 *
 * On Windows we set `shell: true` because Node's `spawn` cannot exec
 * `.cmd` / `.bat` shims directly — pnpm, npm, yarn, and bun all ship as
 * batch shims on Windows, and without the shell flag the spawn would
 * fail with ENOENT. The previous native `execPmCommandInteractive` path
 * handled this in Rust; the Node fallback has to opt in explicitly.
 * Because `shell: true` makes Node concatenate the args into a cmd.exe
 * line without quoting, each arg is passed through
 * {@link quoteWindowsArgument} first so repo-derived values can't inject
 * shell syntax. `windowsHide: true` keeps a transient cmd window from
 * flashing.
 *
 * Captured output is capped at {@link MAX_CAPTURED_BYTES} (sliding tail).
 *
 * Returns the exit code (1 when the child terminates without one — e.g.
 * killed by signal) plus the captured text.
 */
export const spawnTee = async (bin: string, args: ReadonlyArray<string>, options: SpawnTeeOptions): Promise<SpawnTeeResult> =>
    new Promise((resolve, reject) => {
        const useShell = process.platform === "win32";
        const child = spawn(useShell ? quoteWindowsArgument(bin) : bin, useShell ? args.map((argument) => quoteWindowsArgument(argument)) : [...args], {
            cwd: options.cwd,
            env: buildChildEnv(options.env),
            shell: useShell,
            stdio: ["inherit", "pipe", "pipe"],
            windowsHide: true,
        });

        // Collect raw chunks and track the true byte length so the cap is
        // measured in bytes (matching MAX_CAPTURED_BYTES) rather than UTF-16
        // code units. Buffers are only concatenated + decoded once at close,
        // avoiding the per-chunk full-buffer concat the old string path did on
        // chatty installs.
        let chunks: Buffer[] = [];
        let capturedBytes = 0;

        const append = (chunk: Buffer): void => {
            chunks.push(chunk);
            capturedBytes += chunk.length;

            if (capturedBytes <= MAX_CAPTURED_BYTES) {
                return;
            }

            // Sliding-tail: drop whole leading chunks until we're back under the
            // cap. Warning summaries land at the end of the run, so the tail is
            // the half worth keeping for hint detection. A single chunk larger
            // than the cap is sliced down to its trailing bytes.
            while (chunks.length > 1 && capturedBytes - (chunks[0] as Buffer).length > MAX_CAPTURED_BYTES) {
                capturedBytes -= (chunks.shift() as Buffer).length;
            }

            if (chunks.length === 1 && capturedBytes > MAX_CAPTURED_BYTES) {
                const only = chunks[0] as Buffer;

                chunks[0] = only.subarray(only.length - MAX_CAPTURED_BYTES);
                capturedBytes = MAX_CAPTURED_BYTES;
            }
        };

        const collectOutput = (): string => Buffer.concat(chunks).toString("utf8");

        child.stdout?.on("data", (chunk: Buffer) => {
            process.stdout.write(chunk);
            append(chunk);
        });

        child.stderr?.on("data", (chunk: Buffer) => {
            process.stderr.write(chunk);
            append(chunk);
        });

        child.on("error", reject);

        child.on("close", (code) => {
            const output = collectOutput();

            chunks = [];

            resolve({ code: code ?? 1, output });
        });
    });
