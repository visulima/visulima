import { createHash } from "node:crypto";
import { join } from "node:path";

import type { Cache, CachedResult } from "./cache";
import type { TaskFingerprint } from "./fingerprint";
import { FingerprintManager } from "./fingerprint";
import type { RemoteCache } from "./remote-cache";
import { generateRunSummary, writeRunSummary } from "./run-summary";
import type { TaskHasher } from "./task-hasher";
import { computeTaskHash } from "./task-hasher";
import type { TaskScheduler } from "./task-scheduler";
import { TrackedTaskExecutor } from "./tracked-executor";
import type { LifeCycleInterface, Task, TaskExecutor, TaskResult, TaskResults, TaskStatus } from "./types";
import { createFailureResult, resolveTaskCwd } from "./utils";

/**
 * Options for the TaskOrchestrator.
 */
interface TaskOrchestratorOptions {
    autoFingerprint?: boolean;
    cache: Cache;
    cacheDiagnostics?: boolean;
    captureOutput?: boolean;
    dryRun?: boolean;
    fingerprintEnvPatterns?: string[];
    lifeCycle: LifeCycleInterface;
    remoteCache?: RemoteCache;
    resolveCommand?: (task: Task) => string | undefined;
    scheduler: TaskScheduler;
    skipCache?: boolean;
    summarize?: boolean;
    taskExecutor: TaskExecutor;
    taskGraph?: import("./types").TaskGraph;
    taskHasher: TaskHasher;
    untrackedEnvVars?: string[];
    workspaceRoot: string;
}

const hashFingerprint = (fingerprint: TaskFingerprint): string => {
    const hash = createHash("sha256");

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

    return hash.digest("hex");
};

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
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

    readonly #remoteCache: RemoteCache | undefined;

    readonly #dryRun: boolean;

    readonly #summarize: boolean;

    readonly #taskGraph: import("./types").TaskGraph | undefined;

    readonly #results: TaskResults = new Map();

    readonly #startTime: number;

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
        this.#dryRun = options.dryRun ?? false;
        this.#summarize = options.summarize ?? false;
        this.#taskGraph = options.taskGraph ?? undefined;
        this.#startTime = Date.now();

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
        };

        process.on("SIGINT", signalHandler);
        process.on("SIGTERM", signalHandler);

        try {
            await this.#executionLoop();
        } finally {
            process.removeListener("SIGINT", signalHandler);
            process.removeListener("SIGTERM", signalHandler);
            this.#lifeCycle.endCommand?.();
        }

        if (this.#summarize && this.#taskGraph) {
            const summary = generateRunSummary(this.#results, this.#taskGraph, this.#startTime);

            await writeRunSummary(summary, this.#workspaceRoot);
        }

        return this.#results;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    async #executionLoop(): Promise<void> {
        while (!this.#scheduler.isComplete() && !this.#aborted) {
            const batch = this.#scheduler.getNextBatch();

            if (batch.length === 0) {
                if (this.#scheduler.runningCount > 0) {
                    // eslint-disable-next-line no-await-in-loop
                    await delay(10);
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

            const taskPromises = batch.map(
                // eslint-disable-next-line no-confusing-arrow
                (task) => this.#autoFingerprint ? this.#processTaskWithFingerprint(task) : this.#processTask(task),
            );

            // eslint-disable-next-line no-await-in-loop
            const results = await Promise.allSettled(taskPromises);

            const taskResults: TaskResult[] = [];

            for (const [index, result] of results.entries()) {
                const task = batch[index] as Task;

                if (result.status === "fulfilled") {
                    taskResults.push(result.value);
                } else {
                    const errorResult = createFailureResult(task, result.reason, Date.now());

                    taskResults.push(errorResult);
                    this.#results.set(task.id, errorResult);
                }

                this.#scheduler.completeTask(task.id);
            }

            this.#lifeCycle.endTasks?.(taskResults);

            for (const result of taskResults) {
                if (result.terminalOutput) {
                    this.#lifeCycle.printTaskTerminalOutput?.(result.task, result.status, result.terminalOutput);
                }
            }
        }
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
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
                const retrieved = await this.#remoteCache.retrieve(hash, this.#cache.cacheDirectory);

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
            this.#remoteCache.store(task.hash, this.#cache.cacheDirectory).catch(() => {});
        }

        return result;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
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

            const result: TaskResult = {
                code,
                endTime: Date.now(),
                startTime,
                status: code === 0 ? "success" : "failure",
                task,
                terminalOutput,
            };

            this.#results.set(task.id, result);

            if (code === 0 && task.cache !== false && task.hash) {
                await this.#cache.put(task.hash, terminalOutput, task.outputs, code);
            }

            return result;
        } catch (error) {
            const result = createFailureResult(task, error, startTime);

            this.#results.set(task.id, result);

            return result;
        }
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

            const shellCommand = this.#resolveCommand?.(task);
            const canTrack = shellCommand && this.#trackedExecutor?.isTrackingSupported;

            if (canTrack && this.#trackedExecutor) {
                const trackedResult = await this.#trackedExecutor.execute(task, { captureOutput: this.#captureOutput, cwd }, shellCommand);

                code = trackedResult.code;
                terminalOutput = trackedResult.terminalOutput;

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

            const result: TaskResult = {
                code,
                endTime: Date.now(),
                startTime,
                status: code === 0 ? "success" : "failure",
                task,
                terminalOutput,
            };

            this.#results.set(task.id, result);

            if (code === 0 && task.cache !== false && fingerprint) {
                const hash = hashFingerprint(fingerprint);

                Object.assign(task, { hash });

                await this.#cache.put(hash, terminalOutput, task.outputs, code, fingerprint);
                await this.#cache.setTaskIndex(task.id, hash);
            }

            return result;
        } catch (error) {
            const result = createFailureResult(task, error, startTime);

            this.#results.set(task.id, result);

            return result;
        }
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
}

export { TaskOrchestrator };
export type { TaskOrchestratorOptions };
