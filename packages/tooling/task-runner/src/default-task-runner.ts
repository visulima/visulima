// eslint-disable-next-line import/no-extraneous-dependencies -- bundled inline by packem from workspace devDependency
import { xxh3Hash } from "@shared/xxh3";

import { Cache } from "./cache";
import { inferFrameworkEnvPatterns } from "./framework-inference";
import { IncrementalFileHasher } from "./incremental-hasher";
import { RemoteCache } from "./remote-cache";
import { InProcessTaskHasher } from "./task-hasher";
import { TaskOrchestrator } from "./task-orchestrator";
import { TaskScheduler } from "./task-scheduler";
import type { ProjectConfiguration, Task, TaskGraph, TaskResults, TaskRunnerContext, TaskRunnerOptions } from "./types";

/**
 * Splits a {@link TaskGraph} into the regular dependency-graph tasks
 * and a flat list of `always: true` tasks. The always-tasks list keeps
 * the original declaration order from `Object.values(taskGraph.tasks)`.
 *
 * Always-tasks are stripped from the returned graph entirely:
 * removed from `tasks`, `roots`, and from any other task's
 * dependency list so the scheduler can never block on them.
 */
const partitionAlwaysTasks = (taskGraph: TaskGraph): { alwaysTasks: Task[]; graph: TaskGraph } => {
    const alwaysTasks: Task[] = [];
    const remaining: Record<string, Task> = {};

    for (const [id, task] of Object.entries(taskGraph.tasks)) {
        if (task.always) {
            alwaysTasks.push(task);
        } else {
            remaining[id] = task;
        }
    }

    if (alwaysTasks.length === 0) {
        return { alwaysTasks: [], graph: taskGraph };
    }

    const alwaysIds = new Set(alwaysTasks.map((t) => t.id));
    const dependencies: Record<string, string[]> = {};

    for (const [id, deps] of Object.entries(taskGraph.dependencies)) {
        if (alwaysIds.has(id)) {
            continue;
        }

        dependencies[id] = deps.filter((dep) => !alwaysIds.has(dep));
    }

    return {
        alwaysTasks,
        graph: {
            dependencies,
            roots: taskGraph.roots.filter((id) => !alwaysIds.has(id)),
            tasks: remaining,
        },
    };
};

/**
 * Hashes the resolved `globalEnv` values into a short namespace segment.
 * The hash uses `name=value` lines sorted deterministically so the
 * segment is stable across runs when env hasn't changed.
 *
 * Returns `undefined` when there are no globalEnv entries — callers
 * skip namespacing rather than creating an empty `ns/` subtree.
 */
const computeGlobalEnvNamespace = (globalEnv: string[] | undefined): string | undefined => {
    if (!globalEnv || globalEnv.length === 0) {
        return undefined;
    }

    const payload = [...globalEnv]
        .sort()
        .map((name) => `${name}=${process.env[name] ?? ""}`)
        .join("\n");

    return xxh3Hash(Buffer.from(payload)).slice(0, 16);
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

    // Partition the cache by globalEnv fingerprint when the caller
    // opts in. Flipping an env var no longer busts every entry — the
    // old namespace survives, so rolling back the env restores its hits.
    const cacheNamespace = options.namespaceByGlobalEnv ? computeGlobalEnvNamespace(options.globalEnv) : undefined;

    // Create the cache
    const cache = new Cache({
        cacheDirectory: options.cacheDirectory,
        cacheNamespace,
        maxCacheAge: options.maxCacheAge,
        maxCacheSize: options.maxCacheSize,
        workspaceRoot,
    });

    // Clean old cache entries in the background
    cache.removeOldEntries().catch(() => {});

    // Create the task hasher with global inputs support
    const projects: Record<string, ProjectConfiguration> = {};

    for (const [name, node] of Object.entries(projectGraph.nodes)) {
        projects[name] = node.data;
    }

    // Persistent mtime/size-indexed snapshot. Loaded upfront so the
    // hasher's hot path can consult it synchronously; saved after the
    // orchestrator finishes.
    const incrementalHasher = options.incrementalFileHashing ? new IncrementalFileHasher({ workspaceRoot }) : undefined;

    if (incrementalHasher) {
        await incrementalHasher.load();
    }

    const taskHasher = new InProcessTaskHasher({
        autoEnvVars: options.autoEnvVars,
        envVars: options.envVars,
        frameworkInference: options.frameworkInference,
        globalEnv: options.globalEnv,
        globalInputs: options.globalInputs,
        incrementalHasher,
        namedInputs: options.namedInputs,
        projects,
        smartLockfileHashing: options.smartLockfileHashing,
        targetDefaults: options.targetDefaults,
        workspaceRoot,
    });

    // Pull `always: true` tasks out of the main graph — they run
    // sequentially in a finalisation phase, never block other tasks.
    const { alwaysTasks, graph: scheduledGraph } = partitionAlwaysTasks(taskGraph);

    // Calculate max parallel
    const maxParallel = resolveParallel(options.parallel);

    // Create the scheduler
    const scheduler = new TaskScheduler(scheduledGraph, projectGraph, maxParallel);

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
        alwaysTasks,
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
        taskGraph: scheduledGraph,
        taskHasher,
        untrackedEnvVars: options.untrackedEnvVars,
        workspaceRoot,
    });

    const results = await orchestrator.run();

    // Persist the snapshot so the next invocation starts warm. Best-effort:
    // a failed save degrades gracefully to a cold run next time, so we
    // don't surface the error through the run's exit status.
    if (incrementalHasher) {
        await incrementalHasher.save().catch(() => {});
    }

    return results;
};

export { defaultTaskRunner };
