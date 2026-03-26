// Affected detection (git diff-based)
export type { AffectedOptions, AffectedResult } from "./affected";
export { filterAffectedTasks, getAffectedProjects, getChangedFiles } from "./affected";

// Cache
export type { CachedResult, CacheOptions } from "./cache";
export { Cache, formatCacheSize, parseCacheSize } from "./cache";
// Default task runner
export { defaultTaskRunner } from "./default-task-runner";

// File access tracking
export type { FileAccess, TrackingResult } from "./file-access-tracker";
export { FileAccessTracker, generatePreloadScript } from "./file-access-tracker";

// Auto-fingerprinting (Vite Task-style caching)
export type { CacheMissReason, TaskFingerprint } from "./fingerprint";
export { FingerprintManager } from "./fingerprint";

// Framework environment variable inference
export type { DetectedFramework } from "./framework-inference";
export { detectFrameworks, getFrameworkEnvVariables, inferFrameworkEnvPatterns } from "./framework-inference";

// Graph visualization
export type { GraphFormat, GraphJson, GraphVisualizerOptions } from "./graph-visualizer";
export { projectGraphToDot, toGraphAscii, toGraphHtml, toGraphJson, toGraphvizDot } from "./graph-visualizer";

// Incremental file hashing (mtime-based, daemon-compatible)
export type { FileSnapshot, IncrementalHasherOptions } from "./incremental-hasher";
export { IncrementalFileHasher } from "./incremental-hasher";

// Life cycle
export { CompositeLifeCycle, ConsoleLifeCycle, EmptyLifeCycle } from "./life-cycle";
// Smart lockfile hashing
export type { PackageLockfileHash, ResolvedDependency } from "./lockfile-hasher";
export { extractPackageName, LockfileHasher, parseNpmLockfile, parsePnpmLockfile, parseYarnLockfile } from "./lockfile-hasher";
// Native bindings (optional, for performance)
export { isNativeAvailable, loadNativeBindings } from "./native-binding";

// Remote cache (Turborepo-compatible HTTP protocol)
export type { RemoteCacheOptions } from "./remote-cache";
export { RemoteCache } from "./remote-cache";

// Run summary (--summarize)
export type { RunSummary, TaskSummary } from "./run-summary";
export { generateRunSummary, writeRunSummary } from "./run-summary";

// Task graph
export { createTaskGraph, getTaskId, parseTaskId } from "./task-graph";

// Task graph utilities
export {
    findCycle,
    findCycles,
    getDependentTasks,
    getLeafTasks,
    getTransitiveDependencies,
    makeAcyclic,
    reverseTaskGraph,
    walkTaskGraph,
} from "./task-graph-utils";
// Task hashing
export type { TaskHasher, TaskHasherOptions } from "./task-hasher";
export { computeTaskHash, InProcessTaskHasher } from "./task-hasher";
// Task orchestrator
export type { TaskOrchestratorOptions } from "./task-orchestrator";
export { TaskOrchestrator } from "./task-orchestrator";
// Task scheduler
export { TaskScheduler } from "./task-scheduler";

// Tracked executor (for auto-fingerprint mode)
export type { TrackedExecutionResult } from "./tracked-executor";
export { TrackedTaskExecutor } from "./tracked-executor";

// Core types
export type {
    EnvironmentInput,
    ExternalDependencyInput,
    FileSetInput,
    InputDefinition,
    LifeCycleInterface,
    NamedInputs,
    ProjectConfiguration,
    ProjectGraph,
    ProjectGraphDependency,
    ProjectGraphProjectNode,
    RuntimeInput,
    TargetConfiguration,
    TargetDependencyConfig,
    Task,
    TaskExecutionOptions,
    TaskExecutor,
    TaskGraph,
    TaskHashDetails,
    TaskResult,
    TaskResults,
    TaskRunnerContext,
    TaskRunnerOptions,
    TasksRunner,
    TaskStatus,
    TaskTarget,
    WorkspaceConfiguration,
} from "./types";

// Shared utilities
export { collectFiles, createFailureResult, hashFile, hashStrings, readPackageDeps, resolveTaskCwd, sortObjectKeys, uniqueId } from "./utils";
