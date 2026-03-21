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
import { RemoteCache } from "./remote-cache";
import { inferFrameworkEnvPatterns } from "./framework-inference";

/**
 * The default task runner implementation.
 *
 * Runs tasks with caching, scheduling, and lifecycle support.
 * Supports two caching modes:
 *
 * 1. **Nx-style** (default): Explicit input declarations with upfront hash computation
 * 2. **Auto-fingerprint** (Vite Task-style): Set `autoFingerprint: true` to automatically
 *    track file accesses and use them for cache invalidation
 *
 * @example
 * ```ts
 * import { defaultTaskRunner } from "@visulima/task-runner";
 *
 * // Nx-style (explicit inputs)
 * const results = await defaultTaskRunner(tasks, options, context);
 *
 * // Vite Task-style (auto-fingerprinting)
 * const results = await defaultTaskRunner(tasks, {
 *     ...options,
 *     autoFingerprint: true,
 *     fingerprintEnvPatterns: ["VITE_*", "NODE_ENV"],
 *     cacheDiagnostics: true,
 * }, context);
 *
 * // With remote cache
 * const results = await defaultTaskRunner(tasks, {
 *     ...options,
 *     remoteCache: {
 *         url: "https://cache.example.com",
 *         token: process.env.CACHE_TOKEN,
 *         teamId: "my-team",
 *     },
 * }, context);
 *
 * // Dry-run (inspect hashes without executing)
 * const results = await defaultTaskRunner(tasks, {
 *     ...options,
 *     dryRun: true,
 * }, context);
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

    // Create the task hasher with global inputs support
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
        globalInputs: options.globalInputs,
        globalEnv: options.globalEnv,
        smartLockfileHashing: options.smartLockfileHashing,
        frameworkInference: options.frameworkInference,
    });

    // Calculate max parallel
    const maxParallel = resolveParallel(options.parallel);

    // Create the scheduler
    const scheduler = new TaskScheduler(taskGraph, projectGraph, maxParallel);

    // Build command resolver for auto-fingerprint mode
    const resolveCommand = (task: Task): string | undefined => {
        const project = projectGraph.nodes[task.target.project];
        const targetConfig = project?.data.targets?.[task.target.target];
        const defaultConfig = options.targetDefaults?.[task.target.target];

        return targetConfig?.command ?? defaultConfig?.command;
    };

    // Create remote cache if configured
    const remoteCache = options.remoteCache
        ? new RemoteCache(options.remoteCache)
        : undefined;

    // Merge framework-inferred env patterns with explicitly configured ones
    // This makes frameworkInference work with both Nx-style and autoFingerprint modes
    let fingerprintEnvPatterns = options.fingerprintEnvPatterns ?? [];

    if (options.frameworkInference && options.autoFingerprint) {
        const inferredPatterns = await inferFrameworkEnvPatterns(workspaceRoot, projects);

        fingerprintEnvPatterns = [...new Set([...fingerprintEnvPatterns, ...inferredPatterns])];
    }

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
        autoFingerprint: options.autoFingerprint,
        fingerprintEnvPatterns,
        untrackedEnvVars: options.untrackedEnvVars,
        cacheDiagnostics: options.cacheDiagnostics,
        resolveCommand: options.autoFingerprint ? resolveCommand : undefined,
        remoteCache,
        dryRun: options.dryRun,
        outputStyle: options.outputStyle,
        summarize: options.summarize,
        taskGraph,
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
