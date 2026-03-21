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

import { Cache } from "./cache";
import { computeTaskHash } from "./task-hasher";
import { TaskScheduler } from "./task-scheduler";

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
            const taskPromises = batch.map((task) => this.#processTask(task));

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
     * Processes a single task: check cache, execute if needed, store result.
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
     * Executes a task and caches the result.
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

    #delay(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}
