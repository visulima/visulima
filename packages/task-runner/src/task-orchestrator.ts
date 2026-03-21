import { createHash } from "node:crypto";

import type {
    LifeCycleInterface,
    Task,
    TaskExecutor,
    TaskResult,
    TaskResults,
    TaskStatus,
} from "./types";
import type { CachedResult } from "./cache";
import type { TaskHasher } from "./task-hasher";
import type { TaskFingerprint } from "./fingerprint";

import { Cache } from "./cache";
import { computeTaskHash } from "./task-hasher";
import { TaskScheduler } from "./task-scheduler";
import { FingerprintManager } from "./fingerprint";
import { TrackedTaskExecutor } from "./tracked-executor";
import type { RemoteCache } from "./remote-cache";
import { generateRunSummary, writeRunSummary } from "./run-summary";
import { resolveTaskCwd, createFailureResult } from "./utils";

/**
 * Options for the TaskOrchestrator.
 */
export interface TaskOrchestratorOptions {
    taskHasher: TaskHasher;
    cache: Cache;
    scheduler: TaskScheduler;
    lifeCycle: LifeCycleInterface;
    taskExecutor: TaskExecutor;
    workspaceRoot: string;
    skipCache?: boolean;
    captureOutput?: boolean;
    autoFingerprint?: boolean;
    fingerprintEnvPatterns?: string[];
    untrackedEnvVars?: string[];
    cacheDiagnostics?: boolean;
    resolveCommand?: (task: Task) => string | undefined;
    remoteCache?: RemoteCache;
    dryRun?: boolean;
    summarize?: boolean;
    taskGraph?: import("./types").TaskGraph;
}

/**
 * Orchestrates the execution of tasks, handling caching,
 * scheduling, and lifecycle events.
 */
export class TaskOrchestrator {
    readonly #taskHasher: TaskHasher;
    readonly #cache: Cache;
    readonly #scheduler: TaskScheduler;
    readonly #lifeCycle: LifeCycleInterface;
    readonly #taskExecutor: TaskExecutor;
    readonly #workspaceRoot: string;
    readonly #skipCache: boolean;
    readonly #captureOutput: boolean;
    readonly #autoFingerprint: boolean;
    readonly #fingerprintManager: FingerprintManager | null;
    readonly #trackedExecutor: TrackedTaskExecutor | null;
    readonly #fingerprintEnvPatterns: string[];
    readonly #untrackedEnvVars: string[];
    readonly #cacheDiagnostics: boolean;
    readonly #resolveCommand: ((task: Task) => string | undefined) | null;
    readonly #remoteCache: RemoteCache | null;
    readonly #dryRun: boolean;
    readonly #summarize: boolean;
    readonly #taskGraph: import("./types").TaskGraph | null;
    readonly #results: TaskResults = new Map();
    readonly #startTime: number;
    #aborted = false;

    constructor(options: TaskOrchestratorOptions) {
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
        this.#resolveCommand = options.resolveCommand ?? null;
        this.#remoteCache = options.remoteCache ?? null;
        this.#dryRun = options.dryRun ?? false;
        this.#summarize = options.summarize ?? false;
        this.#taskGraph = options.taskGraph ?? null;
        this.#startTime = Date.now();

        if (this.#autoFingerprint) {
            this.#fingerprintManager = new FingerprintManager(options.workspaceRoot);
            this.#trackedExecutor = new TrackedTaskExecutor(options.workspaceRoot);
        } else {
            this.#fingerprintManager = null;
            this.#trackedExecutor = null;
        }
    }

    async run(): Promise<TaskResults> {
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

    async #executionLoop(): Promise<void> {
        while (!this.#scheduler.isComplete() && !this.#aborted) {
            const batch = this.#scheduler.getNextBatch();

            if (batch.length === 0) {
                if (this.#scheduler.runningCount > 0) {
                    await this.#delay(10);
                    continue;
                }

                if (this.#scheduler.remainingCount > 0) {
                    throw new Error(
                        "Deadlock detected: tasks remain but none can be scheduled. " +
                            "This may indicate a circular dependency.",
                    );
                }

                break;
            }

            for (const task of batch) {
                this.#lifeCycle.scheduleTask?.(task);
                this.#scheduler.startTask(task.id);
            }

            this.#lifeCycle.startTasks?.(batch);

            const taskPromises = batch.map((task) =>
                this.#autoFingerprint
                    ? this.#processTaskWithFingerprint(task)
                    : this.#processTask(task),
            );

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
                    this.#lifeCycle.printTaskTerminalOutput?.(
                        result.task,
                        result.status,
                        result.terminalOutput,
                    );
                }
            }
        }
    }

    async #processTask(task: Task): Promise<TaskResult> {
        const startTime = Date.now();

        const hashDetails = await this.#taskHasher.hashTask(task);
        const hash = computeTaskHash(hashDetails);

        task.hash = hash;
        task.hashDetails = hashDetails;

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
            void this.#remoteCache.store(task.hash, this.#cache.cacheDirectory);
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
                        this.#lifeCycle.printCacheMiss?.(
                            task,
                            this.#fingerprintManager.formatMissReasons([commandMiss]),
                        );
                    }
                } else {
                    const missReasons = await this.#fingerprintManager.validate(cachedResult.fingerprint);

                    if (!missReasons) {
                        return this.#applyCachedResult(task, cachedResult, startTime);
                    }

                    if (this.#cacheDiagnostics) {
                        this.#lifeCycle.printCacheMiss?.(
                            task,
                            this.#fingerprintManager.formatMissReasons(missReasons),
                        );
                    }
                }
            } else if (this.#cacheDiagnostics && !cachedResult) {
                this.#lifeCycle.printCacheMiss?.(
                    task,
                    "Cache miss reasons:\n  - No previous fingerprint found (first run)",
                );
            }
        }

        return this.#executeTaskWithTracking(task, startTime);
    }

    async #applyCachedResult(
        task: Task,
        cachedResult: CachedResult,
        startTime: number,
    ): Promise<TaskResult> {
        const restored = await this.#cache.restoreOutputs(cachedResult.hash, task.outputs);
        const status: TaskStatus = restored ? "local-cache" : "local-cache-kept-existing";

        const result: TaskResult = {
            task,
            status,
            terminalOutput: cachedResult.terminalOutput,
            startTime,
            endTime: Date.now(),
            code: cachedResult.code,
        };

        this.#results.set(task.id, result);

        return result;
    }

    async #executeTask(task: Task, startTime: number): Promise<TaskResult> {
        try {
            const { code, terminalOutput } = await this.#taskExecutor(task, {
                cwd: resolveTaskCwd(this.#workspaceRoot, task),
                captureOutput: this.#captureOutput,
            });

            const result: TaskResult = {
                task,
                status: code === 0 ? "success" : "failure",
                terminalOutput,
                startTime,
                endTime: Date.now(),
                code,
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
                const trackedResult = await this.#trackedExecutor.execute(
                    task,
                    { cwd, captureOutput: this.#captureOutput },
                    shellCommand,
                );

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
                    cwd,
                    captureOutput: this.#captureOutput,
                });

                code = executionResult.code;
                terminalOutput = executionResult.terminalOutput;

                const hashDetails = await this.#taskHasher.hashTask(task);
                const fileAccesses = Object.keys(hashDetails.nodes).map((filePath) => ({
                    path: `${this.#workspaceRoot}/${filePath}`,
                    type: "read" as const,
                }));

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
                task,
                status: code === 0 ? "success" : "failure",
                terminalOutput,
                startTime,
                endTime: Date.now(),
                code,
            };

            this.#results.set(task.id, result);

            if (code === 0 && task.cache !== false && fingerprint) {
                const hash = this.#hashFingerprint(fingerprint);

                task.hash = hash;

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

    #hashFingerprint(fingerprint: TaskFingerprint): string {
        const hash = createHash("sha256");

        hash.update(fingerprint.commandHash);

        for (const key of Object.keys(fingerprint.fileHashes).sort()) {
            hash.update(key);
            hash.update(fingerprint.fileHashes[key] as string);
        }

        for (const path of fingerprint.missingFiles) {
            hash.update(`missing:${path}`);
        }

        for (const key of Object.keys(fingerprint.directoryListings).sort()) {
            hash.update(`dir:${key}`);
            hash.update(JSON.stringify(fingerprint.directoryListings[key]));
        }

        for (const key of Object.keys(fingerprint.envHashes).sort()) {
            hash.update(key);
            hash.update(fingerprint.envHashes[key] as string);
        }

        return hash.digest("hex");
    }

    #dryRunResult(task: Task, startTime: number): TaskResult {
        const cacheStatus = task.hash ? `[hash: ${task.hash.slice(0, 12)}...]` : "[no hash]";
        const result: TaskResult = {
            task,
            status: "skipped",
            terminalOutput: `DRY RUN ${cacheStatus}`,
            startTime,
            endTime: Date.now(),
            code: 0,
        };

        this.#results.set(task.id, result);

        return result;
    }

    #delay(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}
