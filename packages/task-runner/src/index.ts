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
    TargetConfiguration,
    TargetDependencyConfig,
    WorkspaceConfiguration,
} from "./types";

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

// Incremental file hashing (mtime-based, daemon-compatible)
export type { FileSnapshot, IncrementalHasherOptions } from "./incremental-hasher";
export { IncrementalFileHasher } from "./incremental-hasher";

// Cache
export type { CachedResult, CacheOptions } from "./cache";
export { Cache, formatCacheSize, parseCacheSize } from "./cache";

// Remote cache (Turborepo-compatible HTTP protocol)
export type { RemoteCacheOptions } from "./remote-cache";
export { RemoteCache } from "./remote-cache";

// Task scheduler
export { TaskScheduler } from "./task-scheduler";

// Life cycle
export {
    CompositeLifeCycle,
    ConsoleLifeCycle,
    EmptyLifeCycle,
} from "./life-cycle";

// Task orchestrator
export type { TaskOrchestratorOptions } from "./task-orchestrator";
export { TaskOrchestrator } from "./task-orchestrator";

// Auto-fingerprinting (Vite Task-style caching)
export type { TaskFingerprint, CacheMissReason } from "./fingerprint";
export { FingerprintManager } from "./fingerprint";

// File access tracking
export type { FileAccess, TrackingResult } from "./file-access-tracker";
export { FileAccessTracker, generatePreloadScript } from "./file-access-tracker";

// Tracked executor (for auto-fingerprint mode)
export type { TrackedExecutionResult } from "./tracked-executor";
export { TrackedTaskExecutor } from "./tracked-executor";

// Affected detection (git diff-based)
export type { AffectedOptions, AffectedResult } from "./affected";
export { getAffectedProjects, getChangedFiles, filterAffectedTasks } from "./affected";

// Native bindings (optional, for performance)
export { isNativeAvailable, loadNativeBindings } from "./native-binding";

// Graph visualization
export type { GraphFormat, GraphVisualizerOptions, GraphJson } from "./graph-visualizer";
export {
    toGraphvizDot,
    toGraphJson,
    toGraphHtml,
    toGraphAscii,
    projectGraphToDot,
} from "./graph-visualizer";

// Smart lockfile hashing
export type { ResolvedDependency, PackageLockfileHash } from "./lockfile-hasher";
export {
    LockfileHasher,
    parseNpmLockfile,
    parsePnpmLockfile,
    parseYarnLockfile,
    extractPackageName,
} from "./lockfile-hasher";

// Framework environment variable inference
export type { DetectedFramework } from "./framework-inference";
export {
    detectFrameworks,
    inferFrameworkEnvPatterns,
    getFrameworkEnvVars,
} from "./framework-inference";

// Run summary (--summarize)
export type { TaskSummary, RunSummary } from "./run-summary";
export { generateRunSummary, writeRunSummary } from "./run-summary";

// Default task runner
export { defaultTaskRunner } from "./default-task-runner";
