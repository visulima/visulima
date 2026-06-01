// eslint-disable-next-line import/no-extraneous-dependencies -- bundled inline by packem from workspace devDependency
import { createXxh3Hasher } from "@shared/xxh3";
import { join, resolve } from "@visulima/path";

import { retrieveByTaskHash, storeByTaskHash } from "./backends/hash-bridge";
import type { RemoteCacheBackend } from "./backends/types";
import type { Cache, CachedResult } from "./cache";
import { applyAccessHints, mergeEnvPatterns, summarizeHints } from "./cache-hints";
import type { TaskFingerprint } from "./fingerprint";
import { FingerprintManager } from "./fingerprint";
import { generateRunSummary, writeLastRunSummary, writeRunSummary } from "./run-summary";
import { findCycle } from "./task-graph-utils";
import type { TaskHasher } from "./task-hasher";
import { computeTaskHash } from "./task-hasher";
import type { TaskScheduler } from "./task-scheduler";
import { TrackedTaskExecutor } from "./tracked-executor";
import type { LifeCycleInterface, OutputSpec, Task, TaskExecutor, TaskGraph, TaskResult, TaskResults, TaskStatus } from "./types";
import { createFailureResult, resolveTaskCwd } from "./utils";
import type { WhenContext } from "./when-condition";
import { evaluateWhen, explainWhen, getCurrentBranch } from "./when-condition";

/**
 * Options for the TaskOrchestrator.
 */
interface TaskOrchestratorOptions {
    /**
     * Tasks marked `always: true` to run after the main task graph
     * completes. Run sequentially, in declaration order, even if the
     * main run failed or was aborted (SIGINT skips them — that's an
     * explicit user request to stop). Skipped if their `when` clause
     * doesn't match.
     */
    alwaysTasks?: Task[];
    autoFingerprint?: boolean;

    /**
     * Failure-propagation policy.
     *
     * - `false` (default) — when a task fails, its transitive
     *   dependents are marked `skipped` with a "dependency failed"
     *   note. Tasks not downstream of the failure still run. Prevents
     *   the cascade failures that result from running a dependent on
     *   a missing `dist/` produced by the failed dep.
     * - `true` — fail-fast. On the first failure every task that
     *   hasn't started is marked `skipped`; in-flight tasks are
     *   allowed to finish.
     */
    bail?: boolean;
    cache: Cache;
    cacheDiagnostics?: boolean;
    captureOutput?: boolean;

    /**
     * Directory used to persist run summaries. Forwarded to
     * {@link writeRunSummary} / {@link writeLastRunSummary} so
     * embedders (vis) can redirect run-scoped state away from the
     * default `{workspaceRoot}/.task-runner`.
     */
    dataDirectory?: string;
    dryRun?: boolean;
    fingerprintEnvPatterns?: string[];
    lifeCycle: LifeCycleInterface;

    /**
     * Surfaces bridge-local upload pipeline failures (tar / digest)
     * for fire-and-forget remote-cache writes. Wire-level errors are
     * already reported by the backend's own `onUploadError`; this
     * fills the gap for steps the backend never sees.
     */
    onRemoteUploadError?: (hash: string, error: unknown) => void;
    remoteCache?: RemoteCacheBackend;
    resolveCommand?: (task: Task) => string | undefined;
    scheduler: TaskScheduler;
    skipCache?: boolean;
    summarize?: boolean;
    taskExecutor: TaskExecutor;
    taskGraph?: TaskGraph;
    taskHasher: TaskHasher;
    untrackedEnvVars?: string[];

    /**
     * Context used to evaluate per-task `when` conditions. Defaults
     * to the live process state — `process.env`, `process.platform`,
     * git branch read from `workspaceRoot`. Override in tests.
     */
    whenContext?: WhenContext;
    workspaceRoot: string;
}

const hashFingerprint = (fingerprint: TaskFingerprint): string => {
    const hash = createXxh3Hasher();

    hash.update(fingerprint.commandHash);

    for (const key of Object.keys(fingerprint.fileHashes).toSorted()) {
        hash.update(key);
        hash.update(fingerprint.fileHashes[key] as string);
    }

    for (const path of fingerprint.missingFiles) {
        hash.update(`missing:${path}`);
    }

    for (const key of Object.keys(fingerprint.directoryListings).toSorted()) {
        hash.update(`dir:${key}`);
        hash.update(JSON.stringify(fingerprint.directoryListings[key]));
    }

    for (const key of Object.keys(fingerprint.envHashes).toSorted()) {
        hash.update(key);
        hash.update(fingerprint.envHashes[key] as string);
    }

    return hash.digest();
};

/**
 * Returns `true` on the first warning pattern that matches `output`.
 * Invalid regex sources are skipped silently — a typo in user config
 * shouldn't take a green build red.
 */
const detectWarnings = (patterns: string[] | undefined, output: string | undefined): boolean => {
    if (!patterns || patterns.length === 0 || !output) {
        return false;
    }

    for (const source of patterns) {
        try {
            if (new RegExp(source).test(output)) {
                return true;
            }
        } catch {
            // ignore invalid regex
        }
    }

    return false;
};

/**
 * True when every declared output is an `{ auto: true }` marker (and
 * there is at least one) — the task relies entirely on captured file
 * writes and names no literal/glob path. Such a task can only restore
 * from cache when the file-access tracker actually recorded writes;
 * committing an entry without them would let a later hit report
 * success while restoring nothing (the missing-`dist/` hazard the vis
 * config layer otherwise forces cache-cold to avoid).
 */
const isAutoOnlyOutputs = (outputs: OutputSpec[] | undefined): boolean =>
    outputs !== undefined && outputs.length > 0 && outputs.every((output) => typeof output !== "string" && output.auto);

const AUTO_OUTPUTS_UNAVAILABLE_REASON
    = "Outputs are `{ auto: true }` only, but no file writes were captured (write tracking unavailable for this task) — not caching, so a later hit can't restore a missing build artifact.";

/**
 * A simple deferred promise that can be resolved externally.
 */
const createDeferred = (): { promise: Promise<void>; resolve: () => void } => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
        resolve = r;
    });

    return { promise, resolve };
};

/**
 * Wraps a {@link LifeCycleInterface} so every method call is
 * fenced by a try/catch. Lifecycle hooks live outside the runner's
 * trust boundary — TUIs, plugins, third-party reporters — and a
 * single throw inside any of them used to break load-bearing
 * orchestrator paths (notably `signal.resolve()` after
 * `endTasks`/`printTaskTerminalOutput`, causing the loop to hang
 * waiting on a deferred that no completion would fire).
 *
 * The proxy short-circuits failures to `undefined`. Errors are
 * swallowed silently: the runner has no out-of-band channel to
 * surface them without itself going through a (potentially
 * broken) lifecycle hook.
 */
const wrapLifeCycle = (lifeCycle: LifeCycleInterface): LifeCycleInterface =>
    new Proxy(lifeCycle, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver) as unknown;

            if (typeof value !== "function") {
                return value;
            }

            return (...arguments_: unknown[]): unknown => {
                try {
                    return (value as (...arguments__: unknown[]) => unknown).apply(target, arguments_);
                } catch {
                    return undefined;
                }
            };
        },
    });

/**
 * Orchestrates the execution of tasks, handling caching,
 * scheduling, and lifecycle events.
 */
class TaskOrchestrator {
    readonly #taskHasher: TaskHasher;

    readonly #cache: Cache;

    readonly #scheduler: TaskScheduler;

    readonly #lifeCycle: LifeCycleInterface;

    readonly #taskExecutor: TaskExecutor;

    readonly #workspaceRoot: string;

    readonly #skipCache: boolean;

    readonly #captureOutput: boolean;

    readonly #autoFingerprint: boolean;

    readonly #fingerprintManager: FingerprintManager | undefined;

    readonly #trackedExecutor: TrackedTaskExecutor | undefined;

    readonly #fingerprintEnvPatterns: string[];

    readonly #untrackedEnvVars: string[];

    readonly #cacheDiagnostics: boolean;

    readonly #resolveCommand: ((task: Task) => string | undefined) | undefined;

    readonly #remoteCache: RemoteCacheBackend | undefined;

    readonly #onRemoteUploadError: ((hash: string, error: unknown) => void) | undefined;

    readonly #dryRun: boolean;

    readonly #summarize: boolean;

    readonly #dataDirectory: string | undefined;

    readonly #taskGraph: TaskGraph | undefined;

    readonly #results: TaskResults = new Map();

    readonly #startTime: number;

    readonly #alwaysTasks: Task[];

    readonly #whenContext: WhenContext;

    readonly #bail: boolean;

    /**
     * Forward-dependents index built once at construction time, used
     * by the failure-propagation path to mark transitive downstream
     * tasks as skipped when a dep fails. Empty when no taskGraph was
     * supplied (callers that don't pass one opt out of skip-dependents).
     */
    readonly #forwardDependents: Map<string, string[]>;

    /** Tracks in-flight task promises so the execution loop can await them */
    readonly #inFlightTasks = new Map<string, Promise<TaskResult>>();

    /** Deferred that gets resolved whenever a task completes, waking the loop */
    #taskCompletionSignal = createDeferred();

    #aborted = false;

    public constructor(options: TaskOrchestratorOptions) {
        this.#taskHasher = options.taskHasher;
        this.#cache = options.cache;
        this.#scheduler = options.scheduler;
        this.#lifeCycle = wrapLifeCycle(options.lifeCycle);
        this.#taskExecutor = options.taskExecutor;
        this.#workspaceRoot = options.workspaceRoot;
        this.#skipCache = options.skipCache ?? false;
        this.#captureOutput = options.captureOutput ?? true;
        this.#autoFingerprint = options.autoFingerprint ?? false;
        this.#fingerprintEnvPatterns = options.fingerprintEnvPatterns ?? [];
        this.#untrackedEnvVars = options.untrackedEnvVars ?? [];
        this.#cacheDiagnostics = options.cacheDiagnostics ?? false;
        this.#resolveCommand = options.resolveCommand ?? undefined;
        this.#remoteCache = options.remoteCache ?? undefined;
        this.#onRemoteUploadError = options.onRemoteUploadError ?? undefined;
        this.#dryRun = options.dryRun ?? false;
        this.#summarize = options.summarize ?? false;
        this.#dataDirectory = options.dataDirectory;
        this.#taskGraph = options.taskGraph ?? undefined;
        this.#startTime = Date.now();
        this.#alwaysTasks = options.alwaysTasks ?? [];
        this.#bail = options.bail ?? false;
        this.#whenContext = options.whenContext ?? {
            branch: getCurrentBranch(options.workspaceRoot),
        };

        this.#forwardDependents = this.#buildForwardDependents();

        // The trace machinery is built when fingerprinting is global
        // (`autoFingerprint`) OR any single target opted in via
        // `hashMode: "trace"`. Building it for a per-target opt-in keeps
        // the rest of the graph on the cheap declared-hash path.
        const anyTraceTask = this.#taskGraph ? Object.values(this.#taskGraph.tasks).some((t) => t.hashMode === "trace") : false;

        if (this.#autoFingerprint || anyTraceTask) {
            this.#fingerprintManager = new FingerprintManager(options.workspaceRoot);
            this.#trackedExecutor = new TrackedTaskExecutor(options.workspaceRoot);
        } else {
            this.#fingerprintManager = undefined;
            this.#trackedExecutor = undefined;
        }
    }

    public async run(): Promise<TaskResults> {
        this.#lifeCycle.startCommand?.();

        // Surface orphan dependency refs (deps naming task ids that
        // don't exist in the graph) once per run, before any task
        // fires. The scheduler treats them as already-completed so
        // progress continues — this warning exists so the underlying
        // input bug doesn't hide behind a green run.
        const orphans = this.#scheduler.getOrphanDependencies?.();

        if (orphans && orphans.size > 0) {
            const lines = ["[task-runner] Task graph contains dependency refs that don't resolve to any task — treating them as already-completed:"];

            for (const [taskId, refs] of orphans) {
                lines.push(`  - ${taskId} → ${refs.join(", ")}`);
            }

            process.stderr.write(`${lines.join("\n")}\n`);
        }

        const signalHandler = (): void => {
            this.#aborted = true;

            // Kill any tracked child processes to prevent orphans.
            // Non-tracked (default-executor) children handle SIGINT
            // themselves via process-group inheritance.
            this.#trackedExecutor?.killAll();

            // Wake the loop so the `while (!#aborted)` predicate
            // re-evaluates. Without this we sit on
            // `await signal.promise` until the next task completion,
            // which on a hung run never arrives.
            this.#taskCompletionSignal.resolve();
        };

        process.on("SIGINT", signalHandler);
        process.on("SIGTERM", signalHandler);

        try {
            await this.#executionLoop();

            // Run "always" tasks after the main graph, even if it failed.
            // Skipped on SIGINT — the user's explicit ask is to stop now.
            if (this.#alwaysTasks.length > 0 && !this.#aborted) {
                await this.#runAlwaysTasks();
            }
        } finally {
            process.removeListener("SIGINT", signalHandler);
            process.removeListener("SIGTERM", signalHandler);
            this.#lifeCycle.endCommand?.();
        }

        if (this.#taskGraph && !this.#aborted) {
            // Summary persistence is a side effect of a finished run,
            // not part of its success criterion. A failing disk write
            // (EACCES, ENOSPC, EROFS in CI sandboxes, …) used to
            // reject `run()` after every task had succeeded — making
            // the caller see a failed build for what is actually a
            // perfectly valid set of results. Catch and stash the
            // error on stderr instead.
            try {
                const summary = generateRunSummary(this.#results, this.#taskGraph, this.#startTime);

                await writeLastRunSummary(summary, this.#workspaceRoot, { dataDirectory: this.#dataDirectory });

                if (this.#summarize) {
                    await writeRunSummary(summary, this.#workspaceRoot, { dataDirectory: this.#dataDirectory });
                }
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);

                process.stderr.write(`[task-runner] Failed to persist run summary: ${reason}\n`);
            }
        }

        return this.#results;
    }

    /**
     * Runs the configured `always: true` tasks sequentially after the
     * main task graph completes. Each task's `when` clause is still
     * honoured. Failures are recorded but never propagate — the whole
     * point of an always-task is to fire regardless of upstream state.
     *
     * Always-tasks deliberately bypass `#processTask` /
     * `#processTaskWithFingerprint`, which means **no cache lookup
     * and no fingerprint check**. Cleanup / teardown / notification
     * tasks are expected to run every invocation; serving them from
     * cache would defeat the purpose.
     */
    async #runAlwaysTasks(): Promise<void> {
        for (const task of this.#alwaysTasks) {
            this.#lifeCycle.scheduleTask?.(task);
            this.#lifeCycle.startTasks?.([task]);

            let result: TaskResult;

            if (this.#shouldSkipForWhen(task)) {
                result = this.#whenSkipResult(task);
            } else {
                const startTime = Date.now();

                try {
                    // eslint-disable-next-line no-await-in-loop
                    result = await this.#executeTask(task, startTime);
                } catch (error) {
                    result = createFailureResult(task, error, startTime);
                    this.#results.set(task.id, result);
                }
            }

            this.#lifeCycle.endTasks?.([result]);

            if (result.terminalOutput) {
                this.#lifeCycle.printTaskTerminalOutput?.(result.task, result.status, result.terminalOutput);
            }
        }
    }

    async #executionLoop(): Promise<void> {
        while (!this.#scheduler.isComplete() && !this.#aborted) {
            const batch = this.#scheduler.getNextBatch();

            if (batch.length === 0) {
                if (this.#inFlightTasks.size > 0) {
                    // Wait for at least one in-flight task to complete instead of polling
                    // eslint-disable-next-line no-await-in-loop
                    await this.#taskCompletionSignal.promise;

                    // Reset the signal for the next wait
                    this.#taskCompletionSignal = createDeferred();
                    continue;
                }

                if (this.#scheduler.remainingCount > 0) {
                    throw new Error(this.#formatDeadlockMessage());
                }

                break;
            }

            for (const task of batch) {
                this.#lifeCycle.scheduleTask?.(task);
                this.#scheduler.startTask(task.id);
            }

            this.#lifeCycle.startTasks?.(batch);

            // Launch tasks concurrently and track them as in-flight
            for (const task of batch) {
                const startPromise = this.#shouldSkipForWhen(task)
                    ? Promise.resolve(this.#whenSkipResult(task))
                    : this.#shouldFingerprint(task)
                        ? this.#processTaskWithFingerprint(task)
                        : this.#processTask(task);

                const taskPromise = startPromise
                    .catch((error: unknown) => {
                        const errorResult = createFailureResult(task, error, Date.now());

                        this.#results.set(task.id, errorResult);

                        return errorResult;
                    })
                    .then((result) => {
                        this.#inFlightTasks.delete(task.id);
                        this.#scheduler.completeTask(task.id);

                        // Propagate failure: by default mark transitive
                        // dependents as skipped so the next batch
                        // doesn't pick them up to run on a broken
                        // upstream. With `bail` on, mark every
                        // remaining task as skipped so the loop winds
                        // down once in-flight tasks finish.
                        if (result.status === "failure") {
                            this.#propagateFailure(task.id);
                        }

                        // Lifecycle hooks live outside the runner's
                        // trust boundary — a plugin throwing inside
                        // endTasks() or printTaskTerminalOutput()
                        // must NOT break the signal.resolve() path,
                        // or the loop would hang on the next
                        // `await signal.promise` when only this task
                        // was in flight. Errors are swallowed so the
                        // run completes; a buggy plugin shouldn't
                        // take a real run red.
                        try {
                            this.#lifeCycle.endTasks?.([result]);
                        } catch {
                            // ignore
                        }

                        if (result.terminalOutput) {
                            try {
                                this.#lifeCycle.printTaskTerminalOutput?.(result.task, result.status, result.terminalOutput);
                            } catch {
                                // ignore
                            }
                        }

                        // Wake the execution loop to schedule more tasks
                        this.#taskCompletionSignal.resolve();

                        return result;
                    })
                    // Final safety net: any rejection past the .then()
                    // (shouldn't happen — we swallow lifecycle errors
                    // above — but `createFailureResult` or our own
                    // bookkeeping could in principle throw) is
                    // absorbed into a synthetic failure result so we
                    // never produce an unhandled rejection that would
                    // crash the host on Node 15+.
                    .catch((error: unknown) => createFailureResult(task, error, Date.now()));

                this.#inFlightTasks.set(task.id, taskPromise);
            }

            // Wait for at least one task to complete before scheduling more
            if (this.#inFlightTasks.size > 0) {
                // eslint-disable-next-line no-await-in-loop
                await this.#taskCompletionSignal.promise;
                this.#taskCompletionSignal = createDeferred();
            }
        }

        // Wait for any remaining in-flight tasks to finish
        if (this.#inFlightTasks.size > 0) {
            await Promise.all(this.#inFlightTasks.values());
        }
    }

    /**
     * Decides whether a task takes the trace/fingerprint path
     * (`#processTaskWithFingerprint`) or the declared content-hash path
     * (`#processTask`). Global `autoFingerprint` routes every task
     * through tracking; otherwise a task opts in per-target via
     * `hashMode: "trace"`. The opt-in only takes effect when the
     * fingerprint machinery was actually built (see constructor) — if
     * it wasn't, the task safely degrades to the declared path so it
     * still caches deterministically rather than not at all.
     */
    #shouldFingerprint(task: Task): boolean {
        if (this.#autoFingerprint) {
            return true;
        }

        return task.hashMode === "trace" && this.#fingerprintManager !== undefined;
    }

    async #processTask(task: Task): Promise<TaskResult> {
        const startTime = Date.now();

        const hashDetails = await this.#taskHasher.hashTask(task);
        const hash = computeTaskHash(hashDetails);

        Object.assign(task, { hash, hashDetails });

        if (this.#dryRun) {
            return this.#dryRunResult(task, startTime);
        }

        if (!this.#skipCache && task.cache !== false) {
            const cachedResult = await this.#cache.get(hash);

            if (cachedResult) {
                return this.#applyCachedResult(task, cachedResult, startTime);
            }

            if (this.#remoteCache) {
                const retrieved = await retrieveByTaskHash(this.#remoteCache, hash, this.#cache.cacheDirectory);

                if (retrieved) {
                    const remoteCached = await this.#cache.get(hash);

                    if (remoteCached) {
                        const result = await this.#applyCachedResult(task, remoteCached, startTime);

                        result.status = "remote-cache";

                        return result;
                    }
                }
            }
        }

        const result = await this.#executeTask(task, startTime);

        if (result.code === 0 && task.cache !== false && task.hash && this.#remoteCache) {
            storeByTaskHash(this.#remoteCache, task.hash, this.#cache.cacheDirectory, this.#onRemoteUploadError).catch(() => {});
        }

        return result;
    }

    async #processTaskWithFingerprint(task: Task): Promise<TaskResult> {
        const startTime = Date.now();

        // Mirror the declared path: a dry run must never execute the
        // command. Without this the tracker (or synthetic-reads branch)
        // would really run it, defeating `--dry-run` for every
        // autoFingerprint task and any `hashMode: "trace"` opt-in.
        if (this.#dryRun) {
            return this.#dryRunResult(task, startTime);
        }

        if (!this.#skipCache && task.cache !== false) {
            const cachedResult = await this.#cache.getByTaskId(task.id);

            if (cachedResult?.fingerprint && this.#fingerprintManager) {
                const commandMiss = this.#fingerprintManager.validateCommand(
                    cachedResult.fingerprint,
                    `${task.target.project}:${task.target.target}`,
                    task.overrides,
                );

                if (commandMiss) {
                    if (this.#cacheDiagnostics) {
                        this.#lifeCycle.printCacheMiss?.(task, this.#fingerprintManager.formatMissReasons([commandMiss]));
                    }
                } else {
                    const missReasons = await this.#fingerprintManager.validate(cachedResult.fingerprint);

                    if (!missReasons) {
                        return this.#applyCachedResult(task, cachedResult, startTime);
                    }

                    if (this.#cacheDiagnostics) {
                        this.#lifeCycle.printCacheMiss?.(task, this.#fingerprintManager.formatMissReasons(missReasons));
                    }
                }
            } else if (this.#cacheDiagnostics && !cachedResult) {
                this.#lifeCycle.printCacheMiss?.(task, "Cache miss reasons:\n  - No previous fingerprint found (first run)");
            }
        }

        return this.#executeTaskWithTracking(task, startTime);
    }

    async #applyCachedResult(task: Task, cachedResult: CachedResult, startTime: number): Promise<TaskResult> {
        const restored = await this.#cache.restoreOutputs(cachedResult.hash, task.outputs, task.cacheRestore);
        const status: TaskStatus = restored ? "local-cache" : "local-cache-kept-existing";

        const result: TaskResult = {
            code: cachedResult.code,
            endTime: Date.now(),
            startTime,
            status,
            task,
            terminalOutput: cachedResult.terminalOutput,
        };

        this.#results.set(task.id, result);

        return result;
    }

    async #executeTask(task: Task, startTime: number): Promise<TaskResult> {
        try {
            const { code, retryAttempts, terminalOutput } = await this.#taskExecutor(task, {
                captureOutput: this.#captureOutput,
                cwd: resolveTaskCwd(this.#workspaceRoot, task),
            });

            const hadWarnings = code === 0 && detectWarnings(task.warningPattern, terminalOutput);

            const result: TaskResult = {
                code,
                endTime: Date.now(),
                hadWarnings: hadWarnings || undefined,
                retryAttempts: retryAttempts && retryAttempts > 0 ? retryAttempts : undefined,
                startTime,
                status: code === 0 ? "success" : "failure",
                task,
                terminalOutput,
            };

            this.#results.set(task.id, result);

            const skipCacheOnWarning = hadWarnings && task.cacheOnWarning === false;

            // Never cache the result of a task that completed after an
            // abort. The user interrupted the run; the task may have
            // exited 0 but its output is treated as incomplete-by-policy
            // so the next run starts fresh. Matches vite-task's
            // documented cancellation contract.
            if (code === 0 && task.cache !== false && task.hash && !skipCacheOnWarning && !this.#aborted) {
                const modified = await this.#detectSelfModifiedInputs(task);

                if (modified.length > 0) {
                    result.selfModified = true;

                    this.#lifeCycle.printSelfModifyingSkip?.(task, modified);
                } else if (isAutoOnlyOutputs(task.outputs)) {
                    // This path never runs the file-access tracker, so
                    // `{ auto: true }` outputs can't be materialised —
                    // caching here would store a zero-output entry.
                    this.#lifeCycle.printEmptyFingerprintWarning?.(task, AUTO_OUTPUTS_UNAVAILABLE_REASON);
                } else {
                    await this.#cache.put(task.hash, terminalOutput, task.outputs, code);
                }
            }

            return result;
        } catch (error) {
            const result = createFailureResult(task, error, startTime);

            this.#results.set(task.id, result);

            return result;
        }
    }

    /**
     * Re-hashes every file recorded in `task.hashDetails.nodes` and returns
     * the workspace-relative paths whose post-execution hash differs from the
     * pre-execution hash. A non-empty result means the task wrote to its own
     * tracked inputs and the cache entry would be unsafe to persist.
     */
    async #detectSelfModifiedInputs(task: Task): Promise<string[]> {
        const nodes = task.hashDetails?.nodes;

        if (!nodes || typeof this.#taskHasher.rehashFile !== "function") {
            return [];
        }

        const rehash = this.#taskHasher.rehashFile.bind(this.#taskHasher);
        const entries = Object.entries(nodes);

        const checks = await Promise.all(
            entries.map(async ([path, priorHash]) => {
                const absolute = resolve(this.#workspaceRoot, path);
                const fresh = await rehash(absolute);

                return fresh !== undefined && fresh !== priorHash ? path : undefined;
            }),
        );

        return checks.filter((path): path is string => path !== undefined);
    }

    async #executeTaskWithTracking(task: Task, startTime: number): Promise<TaskResult> {
        if (!this.#fingerprintManager) {
            return this.#executeTask(task, startTime);
        }

        const taskCommand = `${task.target.project}:${task.target.target}`;
        const cwd = resolveTaskCwd(this.#workspaceRoot, task);

        try {
            let code: number;
            let terminalOutput: string;
            let fingerprint: TaskFingerprint | undefined;
            let trackerAccessCount = 0;
            let usedRealTracker = false;
            // Populated only by the non-tracked branch — the strace/preload
            // tracker bypasses the user-supplied executor and so never goes
            // through the restart loop.
            let retryAttempts: number | undefined;
            // Populated only when the real file-access tracker runs.
            // Fed into `cache.put` as `autoWrites` so `{ auto: true }`
            // outputs can materialise without the user having to list
            // concrete paths. The synthetic-reads path below never
            // fills this — auto outputs silently contribute nothing
            // when tracking isn't available.
            let autoWrites: string[] | undefined;
            // Set when a task asked the runner not to cache this run via
            // `@visulima/task-runner-client`'s `disableCache()`. Gates the
            // cache-write block below, mirroring the config `cache: false`.
            let cacheDisabledByTask = false;
            // Provenance of cooperative hints, attached to the result for
            // `--summarize` when the task emitted any. Left undefined on the
            // common (no-client) path.
            let cacheHints: TaskResult["cacheHints"];

            const shellCommand = this.#resolveCommand?.(task);
            const canTrack = shellCommand && this.#trackedExecutor?.isTrackingSupported;

            if (canTrack && this.#trackedExecutor) {
                const trackedResult = await this.#trackedExecutor.execute(task, { captureOutput: this.#captureOutput, cwd }, shellCommand);

                code = trackedResult.code;
                terminalOutput = trackedResult.terminalOutput;
                cacheDisabledByTask = trackedResult.hints.cacheDisabled;
                cacheHints = summarizeHints(trackedResult.hints);

                // Fold cooperative hints into the observed accesses before
                // hashing: `ignoreInput`/`ignoreOutput` drop noise (tool
                // caches, scratch files); `getEnv`/`getEnvs` add per-run
                // env dependencies on top of the configured patterns.
                const accesses = applyAccessHints(trackedResult.accesses, trackedResult.hints);

                trackerAccessCount = accesses.length;
                usedRealTracker = true;
                autoWrites = accesses.filter((a) => a.type === "write").map((a) => a.path);

                fingerprint = await this.#fingerprintManager.createFingerprint(
                    accesses,
                    taskCommand,
                    task.overrides,
                    process.env,
                    mergeEnvPatterns(this.#fingerprintEnvPatterns, trackedResult.hints),
                    this.#untrackedEnvVars,
                );
            } else {
                const executionResult = await this.#taskExecutor(task, {
                    captureOutput: this.#captureOutput,
                    cwd,
                });

                code = executionResult.code;
                terminalOutput = executionResult.terminalOutput;
                retryAttempts = executionResult.retryAttempts;

                const hashDetails = await this.#taskHasher.hashTask(task);
                const fileAccesses = Object.keys(hashDetails.nodes).map((filePath) => {
                    return {
                        path: join(this.#workspaceRoot, filePath),
                        type: "read" as const,
                    };
                });

                fingerprint = await this.#fingerprintManager.createFingerprint(
                    fileAccesses,
                    taskCommand,
                    task.overrides,
                    process.env,
                    this.#fingerprintEnvPatterns,
                    this.#untrackedEnvVars,
                );
            }

            const hadWarnings = code === 0 && detectWarnings(task.warningPattern, terminalOutput);

            const result: TaskResult = {
                cacheHints,
                code,
                endTime: Date.now(),
                hadWarnings: hadWarnings || undefined,
                retryAttempts: retryAttempts && retryAttempts > 0 ? retryAttempts : undefined,
                startTime,
                status: code === 0 ? "success" : "failure",
                task,
                terminalOutput,
            };

            this.#results.set(task.id, result);

            const skipCacheOnWarning = hadWarnings && task.cacheOnWarning === false;

            // Same abort-gate as the declared path — see `#executeTask`.
            if (code === 0 && task.cache !== false && fingerprint && !skipCacheOnWarning && !this.#aborted) {
                const modified = this.#detectSelfModifiedFingerprint(fingerprint);
                const emptyFingerprintReason = this.#describeEmptyFingerprint(fingerprint, usedRealTracker, trackerAccessCount);

                if (cacheDisabledByTask) {
                    result.cacheDisabledByTask = true;

                    this.#lifeCycle.printCacheDisabledByTask?.(task);
                } else if (modified.length > 0) {
                    result.selfModified = true;

                    this.#lifeCycle.printSelfModifyingSkip?.(task, modified);
                } else if (emptyFingerprintReason) {
                    result.emptyFingerprint = true;

                    this.#lifeCycle.printEmptyFingerprintWarning?.(task, emptyFingerprintReason);
                } else if (isAutoOnlyOutputs(task.outputs) && (!autoWrites || autoWrites.length === 0)) {
                    // The fingerprint is valid, but the task declared
                    // only `{ auto: true }` outputs and the tracker
                    // captured no writes (synthetic-reads path, or a
                    // build that genuinely wrote nothing). Seeding the
                    // cache would let a later hit restore nothing.
                    this.#lifeCycle.printEmptyFingerprintWarning?.(task, AUTO_OUTPUTS_UNAVAILABLE_REASON);
                } else {
                    const hash = hashFingerprint(fingerprint);

                    Object.assign(task, { hash });

                    await this.#cache.put(hash, terminalOutput, task.outputs, code, fingerprint, autoWrites);
                    await this.#cache.setTaskIndex(task.id, hash);
                }
            }

            return result;
        } catch (error) {
            const result = createFailureResult(task, error, startTime);

            this.#results.set(task.id, result);

            return result;
        }
    }

    /**
     * In auto-fingerprint mode, returns the workspace-relative paths the
     * task both read *and* wrote during execution. {@link FingerprintManager}
     * populates `modifiedInputs` from the tracker's `"write"`-typed accesses;
     * backends that don't yet emit write accesses leave it empty.
     */
    // eslint-disable-next-line class-methods-use-this
    #detectSelfModifiedFingerprint(fingerprint: TaskFingerprint): string[] {
        return fingerprint.modifiedInputs ?? [];
    }

    /**
     * Returns a human-readable reason string when a fingerprint looks
     * suspiciously empty (tracker ran but observed no workspace files),
     * or `undefined` when the fingerprint is trustworthy. Caching is
     * skipped for empty fingerprints — silently persisting one would
     * guarantee false cache hits on every subsequent run.
     *
     * Only flags results from the real tracker; the glob-based fallback
     * path legitimately produces wide fingerprints and isn't at risk.
     */
    // eslint-disable-next-line class-methods-use-this
    #describeEmptyFingerprint(fingerprint: TaskFingerprint, usedRealTracker: boolean, trackerAccessCount: number): string | undefined {
        if (!usedRealTracker) {
            return undefined;
        }

        const hasAnyAccess
            = Object.keys(fingerprint.fileHashes).length > 0 || Object.keys(fingerprint.directoryListings).length > 0 || fingerprint.missingFiles.length > 0;

        if (hasAnyAccess) {
            return undefined;
        }

        const zeroAccesses = trackerAccessCount === 0;

        return zeroAccesses
            ? "Tracker observed no workspace file accesses — likely a static binary on a platform without strace. Caching skipped."
            : "Tracker returned accesses but none fell inside the workspace. Caching skipped to avoid false cache hits.";
    }

    #dryRunResult(task: Task, startTime: number): TaskResult {
        const cacheStatus = task.hash ? `[hash: ${task.hash.slice(0, 12)}...]` : "[no hash]";
        const result: TaskResult = {
            code: 0,
            endTime: Date.now(),
            startTime,
            status: "skipped",
            task,
            terminalOutput: `DRY RUN ${cacheStatus}`,
        };

        this.#results.set(task.id, result);

        return result;
    }

    #shouldSkipForWhen(task: Task): boolean {
        if (!task.when) {
            return false;
        }

        return !evaluateWhen(task.when, this.#whenContext);
    }

    #whenSkipResult(task: Task): TaskResult {
        const reason = explainWhen(task.when, this.#whenContext);
        const startTime = Date.now();

        this.#lifeCycle.printWhenSkip?.(task, reason);

        const result: TaskResult = {
            code: 0,
            endTime: startTime,
            startTime,
            status: "skipped",
            task,
            terminalOutput: reason ? `Skipped: ${reason}` : "Skipped by when clause",
        };

        this.#results.set(task.id, result);

        return result;
    }

    /**
     * Inverts `taskGraph.dependencies` into a forward-dependents
     * lookup so the failure-propagation path can mark transitive
     * downstream tasks as skipped in one walk. Built once at
     * construction; cheap O(V + E).
     */
    #buildForwardDependents(): Map<string, string[]> {
        const map = new Map<string, string[]>();

        if (!this.#taskGraph) {
            return map;
        }

        for (const [taskId, deps] of Object.entries(this.#taskGraph.dependencies)) {
            for (const dep of deps) {
                const list = map.get(dep);

                if (list) {
                    list.push(taskId);
                } else {
                    map.set(dep, [taskId]);
                }
            }
        }

        return map;
    }

    /**
     * Marks tasks that can no longer run as `skipped` because an
     * upstream task failed. Two modes:
     *
     * - default (`bail=false`): walk transitive forward-dependents of
     *   the failed task. Unrelated tasks still run.
     * - `bail=true`: mark *every* not-yet-completed, not-yet-running
     *   task as skipped, so the loop winds down after in-flight tasks
     *   finish.
     *
     * Skipping is implemented by writing a synthetic `skipped` result
     * and calling `scheduler.completeTask` so `getReadyTasks` won't
     * pick the task up.
     */
    #propagateFailure(failedTaskId: string): void {
        if (!this.#taskGraph) {
            return;
        }

        const skipReason = `Skipped: upstream dependency failed (${failedTaskId})`;
        const { tasks } = this.#taskGraph;
        const toSkip = new Set<string>();

        if (this.#bail) {
            for (const id of Object.keys(tasks)) {
                toSkip.add(id);
            }
        } else {
            const queue = [failedTaskId];
            const seen = new Set<string>([failedTaskId]);

            while (queue.length > 0) {
                const current = queue.shift() as string;

                for (const dependent of this.#forwardDependents.get(current) ?? []) {
                    if (seen.has(dependent)) {
                        continue;
                    }

                    seen.add(dependent);
                    toSkip.add(dependent);
                    queue.push(dependent);
                }
            }
        }

        for (const id of toSkip) {
            // Don't overwrite a result we already have — tasks
            // already running, completed, or with results in-flight
            // keep their real outcomes. The `bail` path in particular
            // would otherwise clobber the failed task's own result.
            if (this.#results.has(id) || this.#inFlightTasks.has(id)) {
                continue;
            }

            const task = tasks[id];

            if (!task) {
                continue;
            }

            const startTime = Date.now();
            const result: TaskResult = {
                code: 0,
                endTime: startTime,
                startTime,
                status: "skipped",
                task,
                terminalOutput: skipReason,
            };

            this.#results.set(id, result);
            this.#scheduler.completeTask(id);

            try {
                this.#lifeCycle.endTasks?.([result]);
            } catch {
                // ignore — see the .then() handler for the rationale
            }
        }
    }

    /**
     * Builds a multi-line error message for the deadlock case. After
     * the scheduler treats orphan dep refs as completed, a true deadlock
     * can only come from a cycle. We name the participating tasks (when
     * a cycle is found) and list any stranded tasks with their unmet
     * deps — strictly more informative than the previous "may indicate
     * a circular dependency" hint that pointed operators at the wrong
     * root cause when dangling refs were to blame.
     */
    #formatDeadlockMessage(): string {
        const lines = ["Deadlock detected: tasks remain but none can be scheduled."];

        if (this.#taskGraph) {
            const cycle = findCycle(this.#taskGraph);

            if (cycle && cycle.length > 0) {
                lines.push(`Circular dependency found: ${cycle.join(" → ")}`);
            }
        }

        const stranded = this.#scheduler.describeStrandedTasks?.();

        if (stranded && stranded.length > 0) {
            lines.push("Stranded tasks (id → unmet deps):");

            for (const { id, unmetDeps } of stranded) {
                lines.push(`  - ${id} → ${unmetDeps.length > 0 ? unmetDeps.join(", ") : "(no unmet deps — scheduler bug, please report)"}`);
            }
        }

        return lines.join("\n");
    }
}

export { TaskOrchestrator };
export type { TaskOrchestratorOptions };
