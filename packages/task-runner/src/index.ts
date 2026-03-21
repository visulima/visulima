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

// Cache
export type { CachedResult, CacheOptions } from "./cache";
export { Cache, formatCacheSize, parseCacheSize } from "./cache";

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
export { FileAccessTracker } from "./file-access-tracker";

// Tracked executor (for auto-fingerprint mode)
export type { TrackedExecutionResult } from "./tracked-executor";
export { TrackedTaskExecutor } from "./tracked-executor";

// Native bindings (optional, for performance)
export { isNativeAvailable, loadNativeBindings } from "./native-binding";

// Default task runner
export { defaultTaskRunner } from "./default-task-runner";
