import { spawn, spawnSync } from "node:child_process";
import { availableParallelism } from "node:os";

import { cacheable, computeCacheKey, readCacheEntry, writeCacheEntry } from "./cache";
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

    /**
     * Adapter-specific options. When set, replaces the shared
     * `options` argument to `runAdaptersParallel` for this job only —
     * lets `vis.config.ts` adapter overrides (e.g. per-adapter
     * `extraArgs`) thread through without changing the shared options
     * bag for siblings.
     */
    options?: AdapterRunOptions;
    presence: ToolPresence;
}

/**
 * Invoke a tool adapter against a file list. Synchronous, kept for
 * callers that don't need parallelism (tests, single-adapter probes,
 * future cache lookups). Prefer `runAdaptersParallel` from production
 * handlers — it fans out across CPU cores and consults the cache.
 *
 * `mode` controls whether to dry-run (`check`) or write fixes
 * (`fix`). The runner doesn't know the difference — it just picks
 * `argsCheck` vs `argsFix`.
 *
 * This synchronous variant intentionally does NOT consult the cache.
 * It exists for the rare callers (tests, single-shot probes) that
 * want a deterministic spawn-and-return.
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
 * Options that gate caching for `runAdaptersParallel`. When `cacheRoot`
 * is set, each cacheable job (see {@link cacheable}) hashes its inputs
 * and either serves a stored {@link RunResult} or stores one after the
 * spawn.
 */
export interface RunAdaptersParallelOptions {
    readonly cacheRoot?: string;
    readonly concurrency?: number;
}

/**
 * Fan out a list of adapter jobs across CPU cores. Returns results
 * in the same order as the input jobs (so reporters that rely on
 * registry precedence still see oxlint before eslint, etc.).
 *
 * Concurrency defaults to `availableParallelism()` and is clamped to
 * the job count. Set `VIS_LINT_FMT_SERIAL=1` to force sequential
 * execution — useful for debugging, profiling, or tests where the
 * spawn order matters.
 *
 * If `cacheRoot` is provided, eligible jobs (check mode, no workspace
 * sentinel paths, `VIS_NO_CACHE` unset) will be served from disk when
 * a hit is found. Cache misses spawn normally and store the result
 * for next time.
 */
export const runAdaptersParallel = async (
    jobs: ReadonlyArray<AdapterJob>,
    options: AdapterRunOptions,
    mode: "check" | "fix",
    concurrencyOrOptions: number | RunAdaptersParallelOptions = availableParallelism(),
): Promise<RunResult[]> => {
    if (jobs.length === 0) {
        return [];
    }

    const { cacheRoot, concurrency }: { cacheRoot?: string; concurrency: number }
        = typeof concurrencyOrOptions === "number"
            ? { concurrency: concurrencyOrOptions }
            : { cacheRoot: concurrencyOrOptions.cacheRoot, concurrency: concurrencyOrOptions.concurrency ?? availableParallelism() };

    const runOne = async (job: AdapterJob): Promise<RunResult> => {
        const jobOptions = job.options ?? options;

        if (cacheRoot && cacheable(job.files, mode)) {
            const computed = computeCacheKey(job.adapter, job.presence, job.files, jobOptions, mode);

            if (computed) {
                const hit = readCacheEntry(cacheRoot, job.adapter, computed.key);

                if (hit) {
                    return hit.result;
                }

                const fresh = await runAdapterAsync(job.adapter, job.presence, job.files, jobOptions, mode);

                // Only cache successful, terminated spawns. A null exit
                // means the process was killed (timeout) — don't pin that.
                if (fresh.exitCode !== null) {
                    writeCacheEntry(cacheRoot, job.adapter, computed.key, fresh, computed.fileHashes);
                }

                return fresh;
            }
        }

        return runAdapterAsync(job.adapter, job.presence, job.files, jobOptions, mode);
    };

    if (process.env.VIS_LINT_FMT_SERIAL === "1") {
        const results: RunResult[] = [];

        for (const job of jobs) {
            results.push(await runOne(job));
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

            results[index] = await runOne(jobs[index]!);
        }
    };

    await Promise.all(Array.from({ length: limit }, () => worker()));

    return results;
};
