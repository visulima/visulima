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

/**
 * Options for the TaskOrchestrator.
 */
export interface TaskOrchestratorOptions {
    /** The task hasher for computing cache keys */
    taskHasher: TaskHasher;
    /** The cache instance */
    cache: Cache;
    /** The task scheduler */
    scheduler: TaskScheduler;
    /** The lifecycle handler */
    lifeCycle: LifeCycleInterface;
    /** The function to execute a task */
    taskExecutor: TaskExecutor;
    /** The workspace root directory */
    workspaceRoot: string;
    /** Whether to skip reading from cache */
    skipCache?: boolean;
    /** Whether to capture and store terminal output */
    captureOutput?: boolean;
    /**
     * Enable auto-fingerprinting mode (Vite Task-style).
     * When enabled, file accesses are tracked during execution
     * and used for cache invalidation instead of explicit inputs.
     */
    autoFingerprint?: boolean;
    /** Environment variable patterns for fingerprinting (e.g., "VITE_*") */
    fingerprintEnvPatterns?: string[];
    /** Whether to show cache miss diagnostics */
    cacheDiagnostics?: boolean;
    /**
     * A function that resolves the shell command for a task.
     * Required for auto-fingerprint mode to track file accesses via strace.
     * If not provided, falls back to Nx-style hashing for fingerprint creation.
     */
    resolveCommand?: (task: Task) => string | undefined;
}

/**
 * Orchestrates the execution of tasks, handling caching,
 * scheduling, and lifecycle events.
 *
 * Supports two caching modes:
 * 1. **Nx-style** (default): Uses explicit input declarations and upfront hash computation
 * 2. **Auto-fingerprint** (Vite Task-style): Tracks file accesses during execution
 *    and uses them for cache invalidation on subsequent runs
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
    readonly #cacheDiagnostics: boolean;
    readonly #resolveCommand: ((task: Task) => string | undefined) | null;
    readonly #results: TaskResults = new Map();
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
        this.#cacheDiagnostics = options.cacheDiagnostics ?? false;
        this.#resolveCommand = options.resolveCommand ?? null;

        if (this.#autoFingerprint) {
            this.#fingerprintManager = new FingerprintManager(options.workspaceRoot);
            this.#trackedExecutor = new TrackedTaskExecutor(options.workspaceRoot);
        } else {
            this.#fingerprintManager = null;
            this.#trackedExecutor = null;
        }
    }

    /**
     * Runs all scheduled tasks, returning results for each.
     */
    async run(): Promise<TaskResults> {
        this.#lifeCycle.startCommand?.();

        // Set up signal handlers for graceful shutdown
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

        return this.#results;
    }

    /**
     * Main execution loop that processes tasks until all are complete.
     */
    async #executionLoop(): Promise<void> {
        while (!this.#scheduler.isComplete() && !this.#aborted) {
            const batch = this.#scheduler.getNextBatch();

            if (batch.length === 0) {
                // Wait for running tasks to complete
                if (this.#scheduler.runningCount > 0) {
                    await this.#delay(10);
                    continue;
                }

                // No tasks ready and none running - check for deadlock
                if (this.#scheduler.remainingCount > 0) {
                    throw new Error(
                        "Deadlock detected: tasks remain but none can be scheduled. " +
                            "This may indicate a circular dependency.",
                    );
                }

                break;
            }

            // Notify lifecycle of scheduled tasks
            for (const task of batch) {
                this.#lifeCycle.scheduleTask?.(task);
                this.#scheduler.startTask(task.id);
            }

            // Notify lifecycle of starting tasks
            this.#lifeCycle.startTasks?.(batch);

            // Execute tasks concurrently
            const taskPromises = batch.map((task) =>
                this.#autoFingerprint
                    ? this.#processTaskWithFingerprint(task)
                    : this.#processTask(task),
            );

            // Use allSettled to ensure all tasks complete even if some fail
            const results = await Promise.allSettled(taskPromises);

            // Collect results
            const taskResults: TaskResult[] = [];

            for (const [index, result] of results.entries()) {
                const task = batch[index] as Task;

                if (result.status === "fulfilled") {
                    taskResults.push(result.value);
                } else {
                    // Task threw an unexpected error
                    const errorResult: TaskResult = {
                        task,
                        status: "failure",
                        terminalOutput: String(result.reason),
                        code: 1,
                    };

                    taskResults.push(errorResult);
                    this.#results.set(task.id, errorResult);
                }

                this.#scheduler.completeTask(task.id);
            }

            // Notify lifecycle of completed tasks
            this.#lifeCycle.endTasks?.(taskResults);

            // Print terminal output
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

    /**
     * Processes a single task using Nx-style explicit hash computation.
     */
    async #processTask(task: Task): Promise<TaskResult> {
        const startTime = Date.now();

        // Hash the task
        const hashDetails = await this.#taskHasher.hashTask(task);
        const hash = computeTaskHash(hashDetails);

        task.hash = hash;
        task.hashDetails = hashDetails;

        // Check cache
        if (!this.#skipCache && task.cache !== false) {
            const cachedResult = await this.#cache.get(hash);

            if (cachedResult) {
                return this.#applyCachedResult(task, cachedResult, startTime);
            }
        }

        // Execute the task
        return this.#executeTask(task, startTime);
    }

    /**
     * Processes a single task using Vite Task-style auto-fingerprinting.
     *
     * Flow:
     * 1. Look up previous fingerprint for this task
     * 2. If fingerprint exists, validate it against current file state
     * 3. If valid → cache hit, replay output
     * 4. If invalid or no fingerprint → execute task with file tracking
     * 5. Store new fingerprint + result
     */
    async #processTaskWithFingerprint(task: Task): Promise<TaskResult> {
        const startTime = Date.now();

        // Check for existing fingerprint-based cache
        if (!this.#skipCache && task.cache !== false) {
            const cachedResult = await this.#cache.getByTaskId(task.id);

            if (cachedResult?.fingerprint && this.#fingerprintManager) {
                // Validate command args first (fast check)
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
                    // Validate file fingerprint
                    const missReasons = await this.#fingerprintManager.validate(
                        cachedResult.fingerprint,
                    );

                    if (!missReasons) {
                        // Cache hit! Fingerprint is still valid
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

        // Execute the task with file access tracking
        return this.#executeTaskWithTracking(task, startTime);
    }

    /**
     * Applies a cached result, restoring outputs.
     */
    async #applyCachedResult(
        task: Task,
        cachedResult: CachedResult,
        startTime: number,
    ): Promise<TaskResult> {
        // Restore cached outputs
        const restored = await this.#cache.restoreOutputs(
            cachedResult.hash,
            task.outputs,
        );

        const status: TaskStatus = restored
            ? "local-cache"
            : "local-cache-kept-existing";

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

    /**
     * Executes a task and caches the result (Nx-style).
     */
    async #executeTask(task: Task, startTime: number): Promise<TaskResult> {
        try {
            const { code, terminalOutput } = await this.#taskExecutor(task, {
                cwd: task.projectRoot
                    ? `${this.#workspaceRoot}/${task.projectRoot}`
                    : this.#workspaceRoot,
                captureOutput: this.#captureOutput,
            });

            const status: TaskStatus = code === 0 ? "success" : "failure";
            const endTime = Date.now();

            const result: TaskResult = {
                task,
                status,
                terminalOutput,
                startTime,
                endTime,
                code,
            };

            this.#results.set(task.id, result);

            // Cache successful results
            if (
                code === 0 &&
                task.cache !== false &&
                task.hash
            ) {
                await this.#cache.put(
                    task.hash,
                    terminalOutput,
                    task.outputs,
                    code,
                );
            }

            return result;
        } catch (error) {
            const result: TaskResult = {
                task,
                status: "failure",
                terminalOutput: error instanceof Error ? error.message : String(error),
                startTime,
                endTime: Date.now(),
                code: 1,
            };

            this.#results.set(task.id, result);

            return result;
        }
    }

    /**
     * Executes a task with file access tracking and stores the fingerprint.
     * Used in auto-fingerprint mode.
     *
     * Strategy:
     * 1. If a shell command can be resolved AND strace is supported,
     *    run via TrackedTaskExecutor to capture actual file accesses
     * 2. Otherwise, run via the standard TaskExecutor and build fingerprint
     *    from the Nx-style file hash inputs as a fallback
     */
    async #executeTaskWithTracking(task: Task, startTime: number): Promise<TaskResult> {
        if (!this.#fingerprintManager) {
            return this.#executeTask(task, startTime);
        }

        const taskCommand = `${task.target.project}:${task.target.target}`;
        const cwd = task.projectRoot
            ? `${this.#workspaceRoot}/${task.projectRoot}`
            : this.#workspaceRoot;

        try {
            let code: number;
            let terminalOutput: string;
            let fingerprint: TaskFingerprint | undefined;

            // Try to resolve a shell command for strace-based tracking
            const shellCommand = this.#resolveCommand?.(task);
            const canTrack = shellCommand && this.#trackedExecutor?.isTrackingSupported;

            if (canTrack && this.#trackedExecutor) {
                // Path A: Actual file access tracking via strace
                const trackedResult = await this.#trackedExecutor.execute(
                    task,
                    { cwd, captureOutput: this.#captureOutput },
                    shellCommand,
                );

                code = trackedResult.code;
                terminalOutput = trackedResult.terminalOutput;

                // Build fingerprint from ACTUAL file accesses recorded by strace
                fingerprint = await this.#fingerprintManager.createFingerprint(
                    trackedResult.accesses,
                    taskCommand,
                    task.overrides,
                    process.env as Record<string, string | undefined>,
                    this.#fingerprintEnvPatterns,
                );
            } else {
                // Path B: Fallback - run via standard executor, build fingerprint
                // from Nx-style project file scanning
                const executionResult = await this.#taskExecutor(task, {
                    cwd,
                    captureOutput: this.#captureOutput,
                });

                code = executionResult.code;
                terminalOutput = executionResult.terminalOutput;

                // Use the task hasher to discover project files as a fallback
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
                );
            }

            const status: TaskStatus = code === 0 ? "success" : "failure";
            const endTime = Date.now();

            const result: TaskResult = {
                task,
                status,
                terminalOutput,
                startTime,
                endTime,
                code,
            };

            this.#results.set(task.id, result);

            // Cache successful results with fingerprint
            if (code === 0 && task.cache !== false && fingerprint) {
                const hash = this.#hashFingerprint(fingerprint);

                task.hash = hash;

                await this.#cache.put(
                    hash,
                    terminalOutput,
                    task.outputs,
                    code,
                    fingerprint,
                );

                await this.#cache.setTaskIndex(task.id, hash);
            }

            return result;
        } catch (error) {
            const result: TaskResult = {
                task,
                status: "failure",
                terminalOutput: error instanceof Error ? error.message : String(error),
                startTime,
                endTime: Date.now(),
                code: 1,
            };

            this.#results.set(task.id, result);

            return result;
        }
    }

    /**
     * Creates a deterministic hash from a fingerprint for use as a cache key.
     */
    #hashFingerprint(fingerprint: TaskFingerprint): string {
        const hash = createHash("sha256");

        hash.update(fingerprint.commandHash);

        // Hash file hashes in sorted order
        for (const key of Object.keys(fingerprint.fileHashes).sort()) {
            hash.update(key);
            hash.update(fingerprint.fileHashes[key] as string);
        }

        // Hash missing files
        for (const path of fingerprint.missingFiles) {
            hash.update(`missing:${path}`);
        }

        // Hash directory listings
        for (const key of Object.keys(fingerprint.directoryListings).sort()) {
            hash.update(`dir:${key}`);
            hash.update(JSON.stringify(fingerprint.directoryListings[key]));
        }

        // Hash env hashes
        for (const key of Object.keys(fingerprint.envHashes).sort()) {
            hash.update(key);
            hash.update(fingerprint.envHashes[key] as string);
        }

        return hash.digest("hex");
    }

    #delay(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}
