import { spawn, spawnSync } from "node:child_process";
import { availableParallelism } from "node:os";

import type { AdapterRunOptions, RunResult, ToolAdapter, ToolPresence } from "./config-types";

/**
 * A pending adapter invocation: the adapter, its detected presence,
 * and the file list it should be run against. The runner uses these
 * to fan out work in parallel without the handler needing to know
 * about concurrency.
 */
export interface AdapterJob {
    adapter: ToolAdapter;
    files: ReadonlyArray<string>;
    presence: ToolPresence;
}

/**
 * Invoke a tool adapter against a file list. Synchronous, kept for
 * callers that don't need parallelism (tests, single-adapter probes,
 * future cache lookups). Prefer `runAdaptersParallel` from production
 * handlers — it fans out across CPU cores.
 *
 * `mode` controls whether to dry-run (`check`) or write fixes
 * (`fix`). The runner doesn't know the difference — it just picks
 * `argsCheck` vs `argsFix`.
 *
 * Cache integration is a TODO — for the Phase 1 MVP this spawns
 * unconditionally. The cache key returned by `adapter.cacheKey()`
 * is the hook the cache layer will mix with file content hashes.
 */
export const runAdapter = (
    adapter: ToolAdapter,
    presence: ToolPresence,
    files: ReadonlyArray<string>,
    options: AdapterRunOptions,
    mode: "check" | "fix",
): RunResult => {
    const bin = adapter.bin(presence);
    const args = [...bin.slice(1), ...(mode === "fix" ? adapter.argsFix(files, options) : adapter.argsCheck(files, options))];

    const start = Date.now();
    const result = spawnSync(bin[0]!, args, {
        cwd: presence.root,
        encoding: "utf8",
        // 60s ceiling. ESLint can be slow but anything past a minute
        // on a single batch is almost always a misconfiguration.
        timeout: 60_000,
    });

    return {
        durationMs: Date.now() - start,
        exitCode: result.status,
        stderr: result.stderr ?? "",
        stdout: result.stdout ?? "",
    };
};

/**
 * Async sibling of `runAdapter`. Spawns the tool, streams stdout/stderr
 * into memory, and resolves to the same `RunResult` shape so call
 * sites can switch with no further changes.
 */
export const runAdapterAsync = async (
    adapter: ToolAdapter,
    presence: ToolPresence,
    files: ReadonlyArray<string>,
    options: AdapterRunOptions,
    mode: "check" | "fix",
): Promise<RunResult> => {
    const bin = adapter.bin(presence);
    const args = [...bin.slice(1), ...(mode === "fix" ? adapter.argsFix(files, options) : adapter.argsCheck(files, options))];

    return new Promise((resolve) => {
        const start = Date.now();
        const child = spawn(bin[0]!, args, { cwd: presence.root });

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
        }, 60_000);

        child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

        child.on("error", (error) => {
            clearTimeout(timer);
            resolve({
                durationMs: Date.now() - start,
                exitCode: null,
                stderr: error.message,
                stdout: "",
            });
        });

        child.on("close", (code) => {
            clearTimeout(timer);
            resolve({
                durationMs: Date.now() - start,
                exitCode: timedOut ? null : code,
                stderr: Buffer.concat(stderrChunks).toString("utf8"),
                stdout: Buffer.concat(stdoutChunks).toString("utf8"),
            });
        });
    });
};

/**
 * Fan out a list of adapter jobs across CPU cores. Returns results
 * in the same order as the input jobs (so reporters that rely on
 * registry precedence still see oxlint before eslint, etc.).
 *
 * Concurrency defaults to `availableParallelism()` and is clamped to
 * the job count. Set `VIS_LINT_FMT_SERIAL=1` to force sequential
 * execution — useful for debugging, profiling, or tests where the
 * spawn order matters.
 */
export const runAdaptersParallel = async (
    jobs: ReadonlyArray<AdapterJob>,
    options: AdapterRunOptions,
    mode: "check" | "fix",
    concurrency: number = availableParallelism(),
): Promise<RunResult[]> => {
    if (jobs.length === 0) {
        return [];
    }

    if (process.env.VIS_LINT_FMT_SERIAL === "1") {
        const results: RunResult[] = [];

        for (const job of jobs) {
            results.push(await runAdapterAsync(job.adapter, job.presence, job.files, options, mode));
        }

        return results;
    }

    const limit = Math.max(1, Math.min(concurrency, jobs.length));
    const results: RunResult[] = Array.from({ length: jobs.length });
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
        while (true) {
            const index = nextIndex;

            nextIndex += 1;

            if (index >= jobs.length) {
                return;
            }

            const job = jobs[index]!;

            results[index] = await runAdapterAsync(job.adapter, job.presence, job.files, options, mode);
        }
    };

    await Promise.all(Array.from({ length: limit }, () => worker()));

    return results;
};
