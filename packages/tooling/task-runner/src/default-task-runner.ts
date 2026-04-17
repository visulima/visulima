import { Cache } from "./cache";
import { inferFrameworkEnvPatterns } from "./framework-inference";
import { RemoteCache } from "./remote-cache";
import { InProcessTaskHasher } from "./task-hasher";
import { TaskOrchestrator } from "./task-orchestrator";
import { TaskScheduler } from "./task-scheduler";
import type { Task, TaskResults, TaskRunnerContext, TaskRunnerOptions } from "./types";

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

/**
 * The default task runner implementation.
 *
 * Runs tasks with caching, scheduling, and lifecycle support.
 * Supports two caching modes:
 *
 * 1. **Nx-style** (default): Explicit input declarations with upfront hash computation.
 * 2. **Auto-fingerprint** (Vite Task-style): Set `autoFingerprint: true` to automatically
 * track file accesses and use them for cache invalidation.
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
const defaultTaskRunner = async (_tasks: Task[], options: TaskRunnerOptions, context: TaskRunnerContext): Promise<TaskResults> => {
    const { lifeCycle, projectGraph, taskExecutor, taskGraph, workspaceRoot } = context;

    // Create the cache
    const cache = new Cache({
        cacheDirectory: options.cacheDirectory,
        maxCacheAge: options.maxCacheAge,
        maxCacheSize: options.maxCacheSize,
        workspaceRoot,
    });

    // Clean old cache entries in the background
    cache.removeOldEntries().catch(() => {});

    // Create the task hasher with global inputs support
    const projects: Record<string, import("./types").ProjectConfiguration> = {};

    for (const [name, node] of Object.entries(projectGraph.nodes)) {
        projects[name] = node.data;
    }

    const taskHasher = new InProcessTaskHasher({
        autoEnvVars: options.autoEnvVars,
        envVars: options.envVars,
        frameworkInference: options.frameworkInference,
        globalEnv: options.globalEnv,
        globalInputs: options.globalInputs,
        namedInputs: options.namedInputs,
        projects,
        smartLockfileHashing: options.smartLockfileHashing,
        targetDefaults: options.targetDefaults,
        workspaceRoot,
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
    const remoteCache = options.remoteCache ? new RemoteCache(options.remoteCache) : undefined;

    // Merge framework-inferred env patterns with explicitly configured ones
    // This makes frameworkInference work with both Nx-style and autoFingerprint modes
    let fingerprintEnvPatterns = options.fingerprintEnvPatterns ?? [];

    if (options.frameworkInference && options.autoFingerprint) {
        const inferredPatterns = await inferFrameworkEnvPatterns(workspaceRoot, projects);

        fingerprintEnvPatterns = [...new Set([...fingerprintEnvPatterns, ...inferredPatterns])];
    }

    // Create the orchestrator
    const orchestrator = new TaskOrchestrator({
        autoFingerprint: options.autoFingerprint,
        cache,
        cacheDiagnostics: options.cacheDiagnostics,
        captureOutput: true,
        dryRun: options.dryRun,
        fingerprintEnvPatterns,
        lifeCycle,
        remoteCache,
        resolveCommand: options.autoFingerprint ? resolveCommand : undefined,
        scheduler,
        skipCache: options.skipNxCache,
        summarize: options.summarize,
        taskExecutor,
        taskGraph,
        taskHasher,
        untrackedEnvVars: options.untrackedEnvVars,
        workspaceRoot,
    });

    return orchestrator.run();
};

export { defaultTaskRunner };
