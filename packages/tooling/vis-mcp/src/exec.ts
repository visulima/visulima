import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Hard ceiling on captured stdout+stderr. A misbehaving `vis` subcommand that
 * streams without bound would otherwise balloon the MCP server's memory before
 * the timeout fires. 64 MiB comfortably fits the largest realistic JSON payload
 * (full workspace graph) while bounding worst-case growth.
 */
const DEFAULT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

/**
 * Spawn a `vis` subprocess and capture stdout/stderr without piping to the
 * parent's stdio. The MCP server must keep its own stdout pristine — anything
 * other than JSON-RPC frames corrupts the protocol stream.
 *
 * `visBin` is the resolved path to the user's installed vis CLI; injected so
 * tests can point at a fixture instead of the real CLI.
 */
export const execVis = async (visBin: string, args: ReadonlyArray<string>, options: ExecOptions = {}): Promise<ExecResult> => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxBufferBytes = options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;

    // Only forward string-valued env keys. An `options.env` entry typed as
    // `string | undefined` must not leak into the child as the literal string
    // "undefined" (the result of spreading an undefined value), so filter it.
    const env: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }

    if (options.env) {
        for (const [key, value] of Object.entries(options.env)) {
            if (value !== undefined) {
                env[key] = value;
            }
        }
    }

    env.NO_COLOR = "1";

    const spawnOptions: SpawnOptions = {
        cwd: options.cwd ?? process.cwd(),
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
    };

    return await new Promise<ExecResult>((resolve, reject) => {
        // `spawn` reports failures via the 'error' event, never a synchronous
        // throw — handler at the bottom of this block forwards them to reject.
        const child = spawn(process.execPath, [visBin, ...args], spawnOptions);

        let stdout = "";
        let stderr = "";
        let timedOut = false;
        let overflowed = false;
        let killTimer: NodeJS.Timeout | undefined;

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
            // Escalate to SIGKILL if the child ignores SIGTERM. 2s is generous
            // enough for graceful shutdown but short enough that hung children
            // don't pin the MCP request.
            killTimer = setTimeout(() => child.kill("SIGKILL"), 2000);
            killTimer.unref();
        }, timeoutMs);

        // Tracked in UTF-16 code units, which over-approximates the byte length
        // for any non-empty input — a safe, allocation-free upper bound that
        // never lets the captured buffers exceed the configured ceiling.
        const enforceCeiling = (): void => {
            if (overflowed || stdout.length + stderr.length <= maxBufferBytes) {
                return;
            }

            overflowed = true;
            child.kill("SIGTERM");
            killTimer ??= setTimeout(() => child.kill("SIGKILL"), 2000);
            killTimer.unref();
        };

        child.stdout?.setEncoding("utf8");
        child.stdout?.on("data", (chunk: string) => {
            stdout += chunk;
            enforceCeiling();
        });

        child.stderr?.setEncoding("utf8");
        child.stderr?.on("data", (chunk: string) => {
            stderr += chunk;
            enforceCeiling();
        });

        child.once("error", (error) => {
            clearTimeout(timer);

            if (killTimer) {
                clearTimeout(killTimer);
            }

            reject(error);
        });

        child.once("close", (code) => {
            clearTimeout(timer);

            if (killTimer) {
                clearTimeout(killTimer);
            }

            resolve({
                exitCode: code ?? -1,
                overflowed,
                stderr,
                stdout,
                timedOut,
            });
        });
    });
};

/**
 * Run `vis` and parse stdout as JSON. Throws when the subprocess fails or
 * stdout isn't valid JSON — callers map this into an `isError: true` MCP
 * response.
 */
export const execVisJson = async <T>(visBin: string, args: ReadonlyArray<string>, options: ExecOptions = {}): Promise<T> => {
    const result = await execVis(visBin, args, options);

    if (result.timedOut) {
        throw new Error(`vis ${args.join(" ")} timed out after ${String(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)}ms`);
    }

    if (result.overflowed) {
        throw new Error(`vis ${args.join(" ")} exceeded the ${String(options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES)}-byte output limit and was killed`);
    }

    if (result.exitCode !== 0) {
        const tail = result.stderr.trim().split("\n").slice(-5).join("\n");

        throw new Error(`vis ${args.join(" ")} exited with code ${String(result.exitCode)}${tail ? `\n${tail}` : ""}`);
    }

    try {
        return JSON.parse(result.stdout) as T;
    } catch (error) {
        throw new Error(`vis ${args.join(" ")} did not emit valid JSON: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
};

export interface ExecResult {
    exitCode: number;
    /** True when captured output hit `maxBufferBytes` and the child was killed. */
    overflowed: boolean;
    stderr: string;
    stdout: string;
    timedOut: boolean;
}

export interface ExecOptions {
    cwd?: string;
    env?: Record<string, string | undefined>;

    /**
     * Maximum combined stdout+stderr (in code units, an over-approximation of
     * bytes) before the child is killed. Defaults to 64 MiB.
     */
    maxBufferBytes?: number;
    /** Hard ceiling. The default 120s suits cache lookups and listings. */
    timeoutMs?: number;
}
