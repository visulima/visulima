// eslint-disable-next-line import/no-extraneous-dependencies -- bundled inline by packem from workspace devDependency
import { createXxh3Hasher } from "@shared/xxh3";
import { join, resolve } from "@visulima/path";

import { retrieveByTaskHash, storeByTaskHash } from "./backends/hash-bridge";
import type { RemoteCacheBackend } from "./backends/types";
import type { Cache, CachedResult } from "./cache";
import type { TaskFingerprint } from "./fingerprint";
import { FingerprintManager } from "./fingerprint";
import { generateRunSummary, writeLastRunSummary, writeRunSummary } from "./run-summary";
import type { TaskHasher } from "./task-hasher";
import { computeTaskHash } from "./task-hasher";
import type { TaskScheduler } from "./task-scheduler";
import { TrackedTaskExecutor } from "./tracked-executor";
import type { LifeCycleInterface, Task, TaskExecutor, TaskGraph, TaskResult, TaskResults, TaskStatus } from "./types";
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
    cache: Cache;
    cacheDiagnostics?: boolean;
    captureOutput?: boolean;
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

    readonly #taskGraph: TaskGraph | undefined;

    readonly #results: TaskResults = new Map();

    readonly #startTime: number;

    readonly #alwaysTasks: Task[];

    readonly #whenContext: WhenContext;

    /** Tracks in-flight task promises so the execution loop can await them */
    readonly #inFlightTasks = new Map<string, Promise<TaskResult>>();

    /** Deferred that gets resolved whenever a task completes, waking the loop */
    #taskCompletionSignal = createDeferred();

    #aborted = false;

    public constructor(options: TaskOrchestratorOptions) {
        this.#taskHasher = options.taskHasher;
        this.#cache = options.cache;
        this.#scheduler = options.scheduler;
        this.#lifeCycle = options.lifeCycle;
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
        this.#taskGraph = options.taskGraph ?? undefined;
        this.#startTime = Date.now();
        this.#alwaysTasks = options.alwaysTasks ?? [];
        this.#whenContext = options.whenContext ?? {
            branch: getCurrentBranch(options.workspaceRoot),
        };

        if (this.#autoFingerprint) {
            this.#fingerprintManager = new FingerprintManager(options.workspaceRoot);
            this.#trackedExecutor = new TrackedTaskExecutor(options.workspaceRoot);
        } else {
            this.#fingerprintManager = undefined;
            this.#trackedExecutor = undefined;
        }
    }

    public async run(): Promise<TaskResults> {
        this.#lifeCycle.startCommand?.();

        const signalHandler = (): void => {
            this.#aborted = true;

            // Kill any tracked child processes to prevent orphans
            this.#trackedExecutor?.killAll();
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
            const summary = generateRunSummary(this.#results, this.#taskGraph, this.#startTime);

            // Always persist the "last run" snapshot so CLIs can replay it
            // (interrupted runs are skipped — they'd cache incomplete output).
            await writeLastRunSummary(summary, this.#workspaceRoot);

            if (this.#summarize) {
                await writeRunSummary(summary, this.#workspaceRoot);
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
                    throw new Error("Deadlock detected: tasks remain but none can be scheduled. This may indicate a circular dependency.");
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
                    : (this.#autoFingerprint ? this.#processTaskWithFingerprint(task) : this.#processTask(task));

                const taskPromise = startPromise
                    .catch((error: unknown) => {
                        const errorResult = createFailureResult(task, error, Date.now());

                        this.#results.set(task.id, errorResult);

                        return errorResult;
                    })
                    .then((result) => {
                        this.#inFlightTasks.delete(task.id);
                        this.#scheduler.completeTask(task.id);

                        this.#lifeCycle.endTasks?.([result]);

                        if (result.terminalOutput) {
                            this.#lifeCycle.printTaskTerminalOutput?.(result.task, result.status, result.terminalOutput);
                        }

                        // Wake the execution loop to schedule more tasks
                        this.#taskCompletionSignal.resolve();

                        return result;
                    });

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
        const restored = await this.#cache.restoreOutputs(cachedResult.hash, task.outputs);
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
            const { code, terminalOutput } = await this.#taskExecutor(task, {
                captureOutput: this.#captureOutput,
                cwd: resolveTaskCwd(this.#workspaceRoot, task),
            });

            const hadWarnings = code === 0 && detectWarnings(task.warningPattern, terminalOutput);

            const result: TaskResult = {
                code,
                endTime: Date.now(),
                hadWarnings: hadWarnings || undefined,
                startTime,
                status: code === 0 ? "success" : "failure",
                task,
                terminalOutput,
            };

            this.#results.set(task.id, result);

            const skipCacheOnWarning = hadWarnings && task.cacheOnWarning === false;

            if (code === 0 && task.cache !== false && task.hash && !skipCacheOnWarning) {
                const modified = await this.#detectSelfModifiedInputs(task);

                if (modified.length > 0) {
                    result.selfModified = true;

                    this.#lifeCycle.printSelfModifyingSkip?.(task, modified);
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
            // Populated only when the real file-access tracker runs.
            // Fed into `cache.put` as `autoWrites` so `{ auto: true }`
            // outputs can materialise without the user having to list
            // concrete paths. The synthetic-reads path below never
            // fills this — auto outputs silently contribute nothing
            // when tracking isn't available.
            let autoWrites: string[] | undefined;

            const shellCommand = this.#resolveCommand?.(task);
            const canTrack = shellCommand && this.#trackedExecutor?.isTrackingSupported;

            if (canTrack && this.#trackedExecutor) {
                const trackedResult = await this.#trackedExecutor.execute(task, { captureOutput: this.#captureOutput, cwd }, shellCommand);

                code = trackedResult.code;
                terminalOutput = trackedResult.terminalOutput;
                trackerAccessCount = trackedResult.accesses.length;
                usedRealTracker = true;
                autoWrites = trackedResult.accesses.filter((a) => a.type === "write").map((a) => a.path);

                fingerprint = await this.#fingerprintManager.createFingerprint(
                    trackedResult.accesses,
                    taskCommand,
                    task.overrides,
                    process.env as Record<string, string | undefined>,
                    this.#fingerprintEnvPatterns,
                    this.#untrackedEnvVars,
                );
            } else {
                const executionResult = await this.#taskExecutor(task, {
                    captureOutput: this.#captureOutput,
                    cwd,
                });

                code = executionResult.code;
                terminalOutput = executionResult.terminalOutput;

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
                    process.env as Record<string, string | undefined>,
                    this.#fingerprintEnvPatterns,
                    this.#untrackedEnvVars,
                );
            }

            const hadWarnings = code === 0 && detectWarnings(task.warningPattern, terminalOutput);

            const result: TaskResult = {
                code,
                endTime: Date.now(),
                hadWarnings: hadWarnings || undefined,
                startTime,
                status: code === 0 ? "success" : "failure",
                task,
                terminalOutput,
            };

            this.#results.set(task.id, result);

            const skipCacheOnWarning = hadWarnings && task.cacheOnWarning === false;

            if (code === 0 && task.cache !== false && fingerprint && !skipCacheOnWarning) {
                const modified = this.#detectSelfModifiedFingerprint(fingerprint);
                const emptyFingerprintReason = this.#describeEmptyFingerprint(fingerprint, usedRealTracker, trackerAccessCount);

                if (modified.length > 0) {
                    result.selfModified = true;

                    this.#lifeCycle.printSelfModifyingSkip?.(task, modified);
                } else if (emptyFingerprintReason) {
                    result.emptyFingerprint = true;

                    this.#lifeCycle.printEmptyFingerprintWarning?.(task, emptyFingerprintReason);
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
}

export { TaskOrchestrator };
export type { TaskOrchestratorOptions };
