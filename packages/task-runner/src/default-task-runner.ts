import type {
    TaskResults,
    TaskRunnerContext,
    TaskRunnerOptions,
    Task,
} from "./types";

import { Cache } from "./cache";
import { EmptyLifeCycle } from "./life-cycle";
import { InProcessTaskHasher } from "./task-hasher";
import { TaskOrchestrator } from "./task-orchestrator";
import { TaskScheduler } from "./task-scheduler";

/**
 * The default task runner implementation.
 *
 * Runs tasks with caching, scheduling, and lifecycle support.
 * This is the main entry point for executing tasks.
 *
 * @example
 * ```ts
 * import { defaultTaskRunner } from "@visulima/task-runner";
 *
 * const results = await defaultTaskRunner(tasks, options, context);
 * ```
 */
export const defaultTaskRunner = async (
    _tasks: Task[],
    options: TaskRunnerOptions,
    context: TaskRunnerContext,
): Promise<TaskResults> => {
    const {
        taskGraph,
        projectGraph,
        lifeCycle = new EmptyLifeCycle(),
        taskExecutor,
        workspaceRoot,
    } = context;

    // Create the cache
    const cache = new Cache({
        workspaceRoot,
        cacheDirectory: options.cacheDirectory,
        maxCacheSize: options.maxCacheSize,
        maxCacheAge: options.maxCacheAge,
    });

    // Clean old cache entries in the background
    void cache.removeOldEntries();

    // Create the task hasher
    const projects: Record<string, import("./types").ProjectConfiguration> = {};

    for (const [name, node] of Object.entries(projectGraph.nodes)) {
        projects[name] = node.data;
    }

    const taskHasher = new InProcessTaskHasher({
        workspaceRoot,
        projects,
        namedInputs: options.namedInputs,
        targetDefaults: options.targetDefaults,
        envVars: options.envVars,
    });

    // Calculate max parallel
    const maxParallel = resolveParallel(options.parallel);

    // Create the scheduler
    const scheduler = new TaskScheduler(taskGraph, projectGraph, maxParallel);

    // Create the orchestrator
    const orchestrator = new TaskOrchestrator({
        taskHasher,
        cache,
        scheduler,
        lifeCycle,
        taskExecutor,
        workspaceRoot,
        skipCache: options.skipNxCache,
        captureOutput: true,
    });

    return orchestrator.run();
};

/**
 * Resolves the parallel option to a numeric value.
 */
const resolveParallel = (parallel: number | boolean | undefined): number => {
    if (typeof parallel === "number") {
        return Math.max(1, parallel);
    }

    if (parallel === false) {
        return 1;
    }

    // Default: use 3 parallel tasks
    return 3;
};
