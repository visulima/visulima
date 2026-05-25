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
 * `windowsHide: true` keeps a transient cmd window from flashing.
 *
 * Captured output is capped at {@link MAX_CAPTURED_BYTES} (sliding tail).
 *
 * Returns the exit code (1 when the child terminates without one — e.g.
 * killed by signal) plus the captured text.
 */
export const spawnTee = async (bin: string, args: ReadonlyArray<string>, options: SpawnTeeOptions): Promise<SpawnTeeResult> =>
    new Promise((resolve, reject) => {
        const child = spawn(bin, [...args], {
            cwd: options.cwd,
            env: buildChildEnv(options.env),
            shell: process.platform === "win32",
            stdio: ["inherit", "pipe", "pipe"],
            windowsHide: true,
        });

        let output = "";

        const append = (chunk: Buffer): void => {
            const text = chunk.toString("utf8");

            if (output.length + text.length <= MAX_CAPTURED_BYTES) {
                output += text;

                return;
            }

            // Sliding-tail: keep only the last MAX_CAPTURED_BYTES of combined
            // stream. Warning summaries land at the end of the run, so the
            // tail is the half worth keeping for hint detection.
            const combined = output + text;

            output = combined.slice(combined.length - MAX_CAPTURED_BYTES);
        };

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
            resolve({ code: code ?? 1, output });
        });
    });
