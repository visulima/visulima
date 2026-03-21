/**
 * Represents a target that a task executes against.
 */
export interface TaskTarget {
    /** The project name */
    project: string;
    /** The target name (e.g., "build", "test", "lint") */
    target: string;
    /** Optional configuration name */
    configuration?: string;
}

/**
 * Represents a single task to be executed.
 */
export interface Task {
    /** Unique identifier for the task, typically "project:target:configuration" */
    id: string;
    /** The target this task executes */
    target: TaskTarget;
    /** Overrides/extra options passed to the task */
    overrides: Record<string, unknown>;
    /** Hash of the task inputs for caching */
    hash?: string;
    /** Detailed hash information */
    hashDetails?: TaskHashDetails;
    /** Output file paths produced by this task */
    outputs: string[];
    /** The project root directory */
    projectRoot?: string;
    /** Whether this task is eligible for caching */
    cache?: boolean;
    /** Whether this task supports parallel execution */
    parallelism?: boolean;
}

/**
 * Represents detailed hash information for a task.
 */
export interface TaskHashDetails {
    /** The command hash */
    command: string;
    /** Hashes of input files */
    nodes: Record<string, string>;
    /** Hash of implicit dependencies */
    implicitDeps?: Record<string, string>;
    /** Hash of runtime values */
    runtime?: Record<string, string>;
}

/**
 * Represents a directed acyclic graph of tasks.
 */
export interface TaskGraph {
    /** Top-level tasks that no other task depends on (the final outputs to run) */
    roots: string[];
    /** All tasks in the graph, keyed by task ID */
    tasks: Record<string, Task>;
    /** Dependencies for each task */
    dependencies: Record<string, string[]>;
}

/**
 * Possible states of a task after execution.
 */
export type TaskStatus =
    | "success"
    | "failure"
    | "skipped"
    | "local-cache"
    | "local-cache-kept-existing"
    | "remote-cache";

/**
 * Result of executing a task.
 */
export interface TaskResult {
    task: Task;
    status: TaskStatus;
    /** The terminal output produced during execution */
    terminalOutput?: string;
    /** The start time of the task */
    startTime?: number;
    /** The end time of the task */
    endTime?: number;
    /** The exit code, if applicable */
    code?: number;
}

/**
 * Map of task results, keyed by task ID.
 */
export type TaskResults = Map<string, TaskResult>;

/**
 * Configuration for a project in the workspace.
 */
export interface ProjectConfiguration {
    /** The root directory of the project, relative to workspace root */
    root: string;
    /** The source root directory */
    sourceRoot?: string;
    /** The project type */
    projectType?: "library" | "application";
    /** Named targets and their configurations */
    targets?: Record<string, TargetConfiguration>;
    /** Tags for filtering */
    tags?: string[];
    /** Implicit dependencies on other projects */
    implicitDependencies?: string[];
}

/**
 * Configuration for a target within a project.
 */
export interface TargetConfiguration {
    /** The executor/command to run */
    executor?: string;
    /** The command to run (alternative to executor) */
    command?: string;
    /** Options passed to the executor */
    options?: Record<string, unknown>;
    /** Named configurations (e.g., "production", "development") */
    configurations?: Record<string, Record<string, unknown>>;
    /** Other targets this target depends on */
    dependsOn?: (string | TargetDependencyConfig)[];
    /** Input patterns for cache invalidation */
    inputs?: (string | InputDefinition)[];
    /** Output patterns produced by this target */
    outputs?: string[];
    /** Whether this target is cacheable */
    cache?: boolean;
    /** Whether this target supports parallel execution */
    parallelism?: boolean;
}

/**
 * Defines a dependency on another target.
 */
export interface TargetDependencyConfig {
    /** The target name */
    target: string;
    /** The project name (if different from the current project) */
    projects?: string | string[];
    /** Whether this is a dependency on the same project */
    dependencies?: boolean;
    /** Params to pass through */
    params?: "forward" | "ignore";
}

/**
 * Defines an input for cache invalidation.
 */
export type InputDefinition =
    | FileSetInput
    | RuntimeInput
    | EnvironmentInput
    | ExternalDependencyInput;

/**
 * An input based on file patterns.
 */
export interface FileSetInput {
    fileset: string;
}

/**
 * An input based on a runtime command.
 */
export interface RuntimeInput {
    runtime: string;
}

/**
 * An input based on environment variables.
 */
export interface EnvironmentInput {
    env: string;
}

/**
 * An input based on external dependency versions.
 */
export interface ExternalDependencyInput {
    externalDependencies: string[];
}

/**
 * Workspace configuration containing all project configurations.
 */
export interface WorkspaceConfiguration {
    /** All projects in the workspace, keyed by project name */
    projects: Record<string, ProjectConfiguration>;
}

/**
 * A dependency relationship in the project graph.
 */
export interface ProjectGraphDependency {
    /** The source project */
    source: string;
    /** The target project */
    target: string;
    /** The type of dependency */
    type: "static" | "dynamic" | "implicit";
}

/**
 * A node in the project graph.
 */
export interface ProjectGraphProjectNode {
    /** The project name */
    name: string;
    /** The type of project */
    type: "library" | "application";
    /** The project configuration */
    data: ProjectConfiguration;
}

/**
 * The project graph represents the dependency relationships between projects.
 */
export interface ProjectGraph {
    /** All project nodes, keyed by project name */
    nodes: Record<string, ProjectGraphProjectNode>;
    /** All dependency relationships */
    dependencies: Record<string, ProjectGraphDependency[]>;
}

/**
 * Named input definitions that can be referenced by name.
 */
export interface NamedInputs {
    [name: string]: (string | InputDefinition)[];
}

/**
 * Configuration for the task runner.
 */
export interface TaskRunnerOptions {
    /** Directory for storing cache */
    cacheDirectory?: string;
    /** Maximum number of parallel tasks */
    parallel?: number | boolean;
    /** Named inputs for cache invalidation */
    namedInputs?: NamedInputs;
    /** Target-specific default configurations */
    targetDefaults?: Record<string, Partial<TargetConfiguration>>;
    /** Maximum cache size (e.g., "1GB") */
    maxCacheSize?: string;
    /** Maximum age of cache entries in milliseconds */
    maxCacheAge?: number;
    /** Whether to skip cache reads */
    skipNxCache?: boolean;
    /** Custom environment variables to include in hash */
    envVars?: string[];
    /**
     * Global input files that invalidate ALL task hashes when changed.
     * These are workspace-root-relative paths.
     *
     * Default: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock",
     *           "tsconfig.base.json", ".env"]
     *
     * When any global input changes, every task's hash changes,
     * forcing a full rebuild. This matches Turborepo's `globalDependencies`.
     */
    globalInputs?: string[];
    /**
     * Global environment variables that invalidate ALL task hashes.
     * Matches Turborepo's `globalEnv`.
     */
    globalEnv?: string[];
    /**
     * Dry-run mode: compute hashes and check cache but don't execute tasks.
     * Useful for debugging cache hits/misses.
     * @default false
     */
    dryRun?: boolean;
    /**
     * Remote cache configuration.
     * When configured, the task runner will check the remote cache
     * after a local cache miss, and upload results after execution.
     */
    remoteCache?: {
        /** Remote cache server URL */
        url: string;
        /** Authentication token */
        token?: string;
        /** Team/namespace for cache isolation */
        teamId?: string;
        /** Enable remote reads (default: true) */
        read?: boolean;
        /** Enable remote writes (default: true) */
        write?: boolean;
        /**
         * Called when a fire-and-forget upload fails.
         * Since uploads are non-blocking, errors are silently swallowed by default.
         * Provide this callback to log or report upload failures.
         */
        onUploadError?: (hash: string, error: unknown) => void;
    };
    /**
     * Enable auto-fingerprinting mode (Vite Task-style).
     * When enabled, the task runner automatically tracks which files
     * a task accesses during execution and uses that for cache invalidation
     * instead of requiring manual input configuration.
     *
     * Falls back to explicit inputs (Nx-style) when file tracking
     * is not supported on the current platform.
     *
     * @default false
     */
    autoFingerprint?: boolean;
    /**
     * Environment variable patterns to include in auto-fingerprint.
     * Supports wildcard patterns like "VITE_*".
     * Only used when autoFingerprint is enabled.
     */
    fingerprintEnvPatterns?: string[];
    /**
     * Environment variables that should be passed to tasks but NOT
     * included in the cache fingerprint. Useful for CI-specific vars.
     * Only used when autoFingerprint is enabled.
     */
    untrackedEnvVars?: string[];
    /**
     * Whether to show cache miss diagnostics (why a cache miss occurred).
     * @default false
     */
    cacheDiagnostics?: boolean;
    /**
     * Enable smart lockfile hashing.
     * Instead of hashing the entire lockfile (which busts ALL caches),
     * only hash the resolved versions of each package's actual dependencies.
     * This matches Turborepo's smart lockfile hashing behavior.
     * @default false
     */
    smartLockfileHashing?: boolean;
    /**
     * Enable framework environment variable inference.
     * When true, automatically detects common frontend frameworks and includes
     * their public env var prefixes in the task hash:
     * - Next.js: NEXT_PUBLIC_*
     * - Vite: VITE_*
     * - Create React App: REACT_APP_*
     * - Gatsby: GATSBY_*
     * - Nuxt: NUXT_PUBLIC_*
     * - Expo: EXPO_PUBLIC_*
     *
     * Matches Turborepo's framework inference behavior.
     * @default false
     */
    frameworkInference?: boolean;
    /**
     * Generate a detailed JSON run summary after execution.
     * When true, writes a summary file to `.task-runner/runs/` containing
     * all task inputs, outputs, hashes, timings, and cache status.
     *
     * Useful for debugging cache misses and comparing runs.
     * Matches Turborepo's `--summarize` flag.
     * @default false
     */
    summarize?: boolean;
}

/**
 * Options for executing a task.
 */
export interface TaskExecutionOptions {
    /** The working directory */
    cwd?: string;
    /** Environment variables */
    env?: Record<string, string>;
    /** Whether to capture output */
    captureOutput?: boolean;
    /** Stream output as it arrives */
    streamOutput?: boolean;
}

/**
 * A task executor function.
 */
export type TaskExecutor = (
    task: Task,
    options: TaskExecutionOptions,
) => Promise<{ code: number; terminalOutput: string }>;

/**
 * The function type for a task runner.
 */
export type TasksRunner = (
    tasks: Task[],
    options: TaskRunnerOptions,
    context: TaskRunnerContext,
) => Promise<TaskResults>;

/**
 * Context provided to the task runner.
 */
export interface TaskRunnerContext {
    /** The task graph */
    taskGraph: TaskGraph;
    /** The project graph */
    projectGraph: ProjectGraph;
    /** Lifecycle hooks */
    lifeCycle: LifeCycleInterface;
    /** The task executor */
    taskExecutor: TaskExecutor;
    /** The workspace root directory */
    workspaceRoot: string;
}

/**
 * Interface for lifecycle event handlers.
 */
export interface LifeCycleInterface {
    startCommand?(): void;
    endCommand?(): void;
    scheduleTask?(task: Task): void;
    startTasks?(tasks: Task[]): void;
    endTasks?(taskResults: TaskResult[]): void;
    printTaskTerminalOutput?(task: Task, status: TaskStatus, terminalOutput: string): void;
    /** Called when a cache miss occurs with diagnostic information */
    printCacheMiss?(task: Task, reasons: string): void;
}
