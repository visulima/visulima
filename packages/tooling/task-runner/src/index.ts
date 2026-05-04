// Affected detection (git diff-based)
export type { AffectedOptions, AffectedResult } from "./affected";
export { buildForwardDependencyMap, buildReverseDependencyMap, expandAffected, filterAffectedTasks, getAffectedProjects, getChangedFiles } from "./affected";

// Remote cache backend factory + cache-mode resolver
export { createRemoteCacheBackend, resolveCacheMode } from "./backends/factory";
// Hash bridge: orchestrator's task-hash-keyed flow over the
// action-digest-keyed `RemoteCacheBackend` API.
export { actionDigestForTaskHash, containsByTaskHash, retrieveByTaskHash, storeByTaskHash } from "./backends/hash-bridge";

// Remote cache: HTTP (Turborepo-compatible) backend
export { HttpRemoteCache } from "./backends/http";
// Remote cache: REAPI (Bazel Remote Execution API) gRPC backend
export type { ReapiRemoteCacheOptions } from "./backends/reapi";
export { ReapiRemoteCache } from "./backends/reapi";
// Remote cache backend interface + canonical configuration shape
export type {
    ActionResult,
    BlobSource,
    CacheMode,
    CasDigest,
    RemoteCacheBackend,
    RemoteCacheCompression,
    RemoteCacheOptions,
    RemoteCacheSigning,
} from "./backends/types";
// Cache
export type { CachedResult, CacheOptions } from "./cache";
export { Cache, DEFAULT_CACHE_DIRECTORY_NAME, formatCacheSize, parseCacheSize } from "./cache";
// CAS primitives (v2 layout: digest helpers, sharded paths, blob/AC store)
export { digestBuffer, digestFile } from "./cas/digest";
export { acEntryPath, casBlobPath, taskHashIndexPath, V2_AC, V2_CAS, V2_INDEX, V2_ROOT, V2_TMP } from "./cas/paths";
export { containsBlob, fetchBlobToFile, putBlobFromBytes, putBlobFromFile, touchBlob, verifyBlob } from "./cas/store";
// Chrome tracing profile (--profile)
export type { ChromeTraceEvent } from "./chrome-trace";
export { toChromeTrace, writeChromeTrace } from "./chrome-trace";
// Command parser
export type { ParseCommandsOptions, TokenContext } from "./command-parser";
export { expandArguments, expandShortcut, expandTokens, expandTokensInString, expandWildcard, parseCommands, stripQuotes } from "./command-parser";
// Concurrent process runner
export { runConcurrently } from "./concurrent";
export { runConcurrentFallback } from "./concurrent-fallback";
// Default task runner
export { defaultTaskRunner } from "./default-task-runner";
// Shell detection
export { detectScriptShell } from "./detect-shell";
// File access tracking
export type { FileAccess, TrackingResult } from "./file-access-tracker";
export { FileAccessTracker, generatePreloadScript } from "./file-access-tracker";
// Auto-fingerprinting (Vite Task-style caching)
export type { CacheMissReason, TaskFingerprint } from "./fingerprint";
export { FingerprintManager } from "./fingerprint";
// Flow controllers
export type { InputHandlerOptions, RestartOptions, TeardownOptions } from "./flow-controllers";
export { createInputHandler, formatTimingTable, logTimings, runTeardown, withRestart } from "./flow-controllers";
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
// Log reporter (--log=interleaved|labeled|grouped, matches vite-task)
export type { LogMode } from "./log-reporter";
export { createLogReporter, LogReporter } from "./log-reporter";
// Native bindings (optional, for performance)
export { isNativeAvailable, loadNativeBindings } from "./native-binding";
export { resolveOutputs } from "./output-resolver";
// Project constraints
export { enforceProjectConstraints } from "./project-constraints";

// Run summary (--summarize and --last-details)
export type { RunSummary, TaskSummary } from "./run-summary";
export { generateRunSummary, getLastRunSummaryPath, readLastRunSummary, writeLastRunSummary, writeRunSummary } from "./run-summary";

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
export type { PartitionOptions } from "./task-scheduler";
export { parsePartition, TaskScheduler } from "./task-scheduler";

// Terminal buffer (for processing PTY ANSI sequences)
export { TerminalBuffer } from "./terminal-buffer";

// Tracked executor (for auto-fingerprint mode)
export type { TrackedExecutionResult } from "./tracked-executor";
export { TrackedTaskExecutor } from "./tracked-executor";

// Core types
export type {
    AffectedScope,
    CacheRestoreOptions,
    ConcurrentCloseEvent,
    ConcurrentCommandConfig,
    ConcurrentCommandInput,
    ConcurrentRunnerOptions,
    ConcurrentRunResult,
    ConstraintsConfig,
    ConstraintViolation,
    DependencyKindRules,
    DependencyType,
    EnvironmentInput,
    ExternalDependencyInput,
    FileSetBase,
    FileSetInput,
    FileSetPattern,
    InputDefinition,
    LifeCycleInterface,
    NamedInputs,
    OutputSpec,
    ProcessEvent,
    ProjectConfiguration,
    ProjectGraph,
    ProjectGraphDependency,
    ProjectGraphProjectNode,
    RuntimeInput,
    TagRelationships,
    TargetConfiguration,
    TargetDependencyConfig,
    Task,
    TaskExecutionOptions,
    TaskExecutor,
    TaskGraph,
    TaskHashDetails,
    TaskPriority,
    TaskResult,
    TaskResults,
    TaskRunnerContext,
    TaskRunnerOptions,
    TasksRunner,
    TaskStatus,
    TaskTarget,
    TypeBoundaries,
    WorkspaceConfiguration,
} from "./types";
// Shared utilities
export { collectFiles, createFailureResult, hashFile, hashStrings, readPackageDeps, resolveTaskCwd, sortObjectKeys, uniqueId } from "./utils";

// Conditional task evaluation (`when:` clause)
export type { EnvMatcher, NodePlatform, WhenCondition, WhenContext } from "./when-condition";
export { evaluateWhen, explainWhen, getCurrentBranch, resetBranchCache } from "./when-condition";
// Git-worktree detection (linked worktrees -> main checkout, for shared cache)
export { getMainWorktreeRoot, isLinkedWorktree, resetWorktreeCache } from "./worktree";
