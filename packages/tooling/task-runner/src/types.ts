/**
 * Represents a target that a task executes against.
 */
export interface TaskTarget {
    /** Optional configuration name */
    configuration?: string;
    /** The project name */
    project: string;
    /** The target name (e.g., "build", "test", "lint") */
    target: string;
}

/**
 * Represents a single task to be executed.
 */
export interface Task {
    /** Whether this task is eligible for caching */
    cache?: boolean;
    /** Hash of the task inputs for caching */
    hash?: string;
    /** Detailed hash information */
    hashDetails?: TaskHashDetails;
    /** Unique identifier for the task, typically "project:target:configuration" */
    id: string;
    /** Output file paths produced by this task */
    outputs: string[];
    /** Overrides/extra options passed to the task */
    overrides: Record<string, unknown>;
    /** Whether this task supports parallel execution */
    parallelism?: boolean;
    /** The project root directory */
    projectRoot?: string;
    /** The target this task executes */
    target: TaskTarget;
}

/**
 * Represents detailed hash information for a task.
 */
export interface TaskHashDetails {
    /** The command hash */
    command: string;
    /** Hash of implicit dependencies */
    implicitDeps?: Record<string, string>;
    /** Hashes of input files */
    nodes: Record<string, string>;
    /** Hash of runtime values */
    runtime?: Record<string, string>;
}

/**
 * Represents a directed acyclic graph of tasks.
 */
export interface TaskGraph {
    /** Dependencies for each task */
    dependencies: Record<string, string[]>;
    /** Top-level tasks that no other task depends on (the final outputs to run) */
    roots: string[];
    /** All tasks in the graph, keyed by task ID */
    tasks: Record<string, Task>;
}

/**
 * Possible states of a task after execution.
 */
export type TaskStatus = "success" | "failure" | "skipped" | "local-cache" | "local-cache-kept-existing" | "remote-cache";

/**
 * Result of executing a task.
 */
export interface TaskResult {
    /** The exit code, if applicable */
    code?: number;
    /** The end time of the task */
    endTime?: number;
    /** The start time of the task */
    startTime?: number;
    status: TaskStatus;
    task: Task;
    /** The terminal output produced during execution */
    terminalOutput?: string;
}

/**
 * Map of task results, keyed by task ID.
 */
export type TaskResults = Map<string, TaskResult>;

/**
 * Configuration for a project in the workspace.
 */
export interface ProjectConfiguration {
    /** Implicit dependencies on other projects */
    implicitDependencies?: string[];
    /** The project type */
    projectType?: "library" | "application";
    /** The root directory of the project, relative to workspace root */
    root: string;
    /** The source root directory */
    sourceRoot?: string;
    /** Tags for filtering */
    tags?: string[];
    /** Named targets and their configurations */
    targets?: Record<string, TargetConfiguration>;
}

/**
 * Configuration for a target within a project.
 */
export interface TargetConfiguration {
    /** Whether this target is cacheable */
    cache?: boolean;
    /** The command to run (alternative to executor) */
    command?: string;
    /** Named configurations (e.g., "production", "development") */
    configurations?: Record<string, Record<string, unknown>>;
    /** Other targets this target depends on */
    dependsOn?: (string | TargetDependencyConfig)[];
    /** The executor/command to run */
    executor?: string;
    /** Input patterns for cache invalidation */
    inputs?: (string | InputDefinition)[];
    /** Options passed to the executor */
    options?: Record<string, unknown>;
    /** Output patterns produced by this target */
    outputs?: string[];
    /** Whether this target supports parallel execution */
    parallelism?: boolean;
}

/**
 * Defines a dependency on another target.
 */
export interface TargetDependencyConfig {
    /** Whether this is a dependency on the same project */
    dependencies?: boolean;
    /** Params to pass through */
    params?: "forward" | "ignore";
    /** The project name (if different from the current project) */
    projects?: string | string[];
    /** The target name */
    target: string;
}

/**
 * Defines an input for cache invalidation.
 */
export type InputDefinition = FileSetInput | RuntimeInput | EnvironmentInput | ExternalDependencyInput;

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
    /** The project configuration */
    data: ProjectConfiguration;
    /** The project name */
    name: string;
    /** The type of project */
    type: "library" | "application";
}

/**
 * The project graph represents the dependency relationships between projects.
 */
export interface ProjectGraph {
    /** All dependency relationships */
    dependencies: Record<string, ProjectGraphDependency[]>;
    /** All project nodes, keyed by project name */
    nodes: Record<string, ProjectGraphProjectNode>;
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
    /**
     * Enable auto-fingerprinting mode (Vite Task-style).
     * When enabled, the task runner automatically tracks which files
     * a task accesses during execution and uses that for cache invalidation
     * instead of requiring manual input configuration.
     *
     * Falls back to explicit inputs (Nx-style) when file tracking
     * is not supported on the current platform.
     * @default false
     */
    autoFingerprint?: boolean;

    /**
     * Whether to show cache miss diagnostics (why a cache miss occurred).
     * @default false
     */
    cacheDiagnostics?: boolean;
    /** Directory for storing cache */
    cacheDirectory?: string;

    /**
     * Dry-run mode: compute hashes and check cache but don't execute tasks.
     * Useful for debugging cache hits/misses.
     * @default false
     */
    dryRun?: boolean;
    /** Custom environment variables to include in hash */
    envVars?: string[];

    /**
     * Environment variable patterns to include in auto-fingerprint.
     * Supports wildcard patterns like "VITE_*".
     * Only used when autoFingerprint is enabled.
     */
    fingerprintEnvPatterns?: string[];

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
     * Global environment variables that invalidate ALL task hashes.
     * Matches Turborepo's `globalEnv`.
     */
    globalEnv?: string[];

    /**
     * Global input files that invalidate ALL task hashes when changed.
     * These are workspace-root-relative paths.
     *
     * Default: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock",
     * "tsconfig.base.json", ".env"]
     *
     * When any global input changes, every task's hash changes,
     * forcing a full rebuild. This matches Turborepo's `globalDependencies`.
     */
    globalInputs?: string[];
    /** Maximum age of cache entries in milliseconds */
    maxCacheAge?: number;
    /** Maximum cache size (e.g., "1GB") */
    maxCacheSize?: string;
    /** Named inputs for cache invalidation */
    namedInputs?: NamedInputs;
    /** Maximum number of parallel tasks */
    parallel?: number | boolean;

    /**
     * Remote cache configuration.
     * When configured, the task runner will check the remote cache
     * after a local cache miss, and upload results after execution.
     */
    remoteCache?: {
        /**
         * Called when a fire-and-forget upload fails.
         * Since uploads are non-blocking, errors are silently swallowed by default.
         * Provide this callback to log or report upload failures.
         */
        onUploadError?: (hash: string, error: unknown) => void;
        /** Enable remote reads (default: true) */
        read?: boolean;
        /** Team/namespace for cache isolation */
        teamId?: string;
        /** Authentication token */
        token?: string;
        /** Remote cache server URL */
        url: string;
        /** Enable remote writes (default: true) */
        write?: boolean;
    };
    /** Whether to skip cache reads */
    skipNxCache?: boolean;

    /**
     * Enable smart lockfile hashing.
     * Instead of hashing the entire lockfile (which busts ALL caches),
     * only hash the resolved versions of each package's actual dependencies.
     * This matches Turborepo's smart lockfile hashing behavior.
     * @default false
     */
    smartLockfileHashing?: boolean;

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
    /** Target-specific default configurations */
    targetDefaults?: Record<string, Partial<TargetConfiguration>>;

    /**
     * Environment variables that should be passed to tasks but NOT
     * included in the cache fingerprint. Useful for CI-specific vars.
     * Only used when autoFingerprint is enabled.
     */
    untrackedEnvVars?: string[];
}

/**
 * Options for executing a task.
 */
export interface TaskExecutionOptions {
    /** Whether to capture output */
    captureOutput?: boolean;
    /** The working directory */
    cwd?: string;
    /** Environment variables */
    env?: Record<string, string>;
    /** Stream output as it arrives */
    streamOutput?: boolean;
}

/**
 * A task executor function.
 */
export type TaskExecutor = (task: Task, options: TaskExecutionOptions) => Promise<{ code: number; terminalOutput: string }>;

/**
 * The function type for a task runner.
 */
export type TasksRunner = (tasks: Task[], options: TaskRunnerOptions, context: TaskRunnerContext) => Promise<TaskResults>;

/**
 * Context provided to the task runner.
 */
export interface TaskRunnerContext {
    /** Lifecycle hooks */
    lifeCycle: LifeCycleInterface;
    /** The project graph */
    projectGraph: ProjectGraph;
    /** The task executor */
    taskExecutor: TaskExecutor;
    /** The task graph */
    taskGraph: TaskGraph;
    /** The workspace root directory */
    workspaceRoot: string;
}

// ─── Concurrent Process Runner Types ───────────────────────────────────

/**
 * Input for a concurrent command -- either a string or a config object.
 */
export type ConcurrentCommandInput =
    | string
    | {
          command: string;
          cwd?: string;
          env?: Record<string, string>;
          name?: string;
          stdin?: "inherit" | "null" | "pipe";
      };

/**
 * Configuration for a single command to run concurrently.
 */
export interface ConcurrentCommandConfig {
    /** The command string to execute (passed to shell). */
    command: string;
    /** Working directory for the command. */
    cwd?: string;
    /** Additional environment variables merged with process env. */
    env?: Record<string, string>;
    /** Human-readable name for this command (used in prefixes/logs). */
    name?: string;
    /** Whether to use shell execution (default: true). */
    shell?: boolean;
    /**
     * Stdin mode for the child process.
     * - "null" (default): stdin closed, child cannot read input
     * - "pipe": stdin is piped, can be written to programmatically
     * - "inherit": child inherits parent's stdin (for interactive commands like vite dev)
     */
    stdin?: "inherit" | "null" | "pipe";
}

/**
 * Options controlling the concurrent runner behavior.
 */
export interface ConcurrentRunnerOptions {
    /** Conditions under which to kill other processes: "success", "failure". */
    killOthers?: ("failure" | "success")[];
    /** Signal to send when killing processes (default: "SIGTERM"). */
    killSignal?: string;
    /** Milliseconds to wait after kill signal before sending SIGKILL (default: 5000). */
    killTimeout?: number;
    /** Maximum number of processes to run simultaneously. 0 = unlimited. */
    maxProcesses?: number;
    /** Callback for real-time process events. */
    onEvent?: (event: ProcessEvent) => void;
    /**
     * Custom shell path for command execution.
     * Overrides the platform default (/bin/sh on Unix, cmd.exe on Windows).
     * Automatically detected from npm's `script-shell` config if not set.
     */
    shellPath?: string;
    /** Restart options for failed commands. */
    restart?: {
        /** Delay between restarts in ms. "exponential" for 2^attempt * 1000ms. */
        delay?: number | "exponential";
        /** Maximum restart attempts per command. 0 = no restarts. -1 = infinite. */
        tries: number;
    };
    /** Success condition: "first", "last", "all", or "command-<name|index>". */
    successCondition?: string;
    /** Commands to run sequentially after all processes complete. */
    teardown?: string[];
    /** Working directory for teardown commands. */
    teardownCwd?: string;
    /** Print a timing summary table after completion. Default: false. */
    timings?: boolean;
}

/**
 * An event emitted during concurrent execution.
 */
export interface ProcessEvent {
    /** Command name (for close events). */
    commandName?: string;
    /** Duration in milliseconds (for close events). */
    durationMs?: number;
    /** Exit code (for close events). */
    exitCode?: number;
    /** Index of the command that produced this event. */
    index: number;
    /** Whether the process was killed (for close events). */
    killed?: boolean;
    /** Event type: "stdout", "stderr", "close", "error". */
    kind: "close" | "error" | "stderr" | "stdout";
    /** Error message (for error events). */
    message?: string;
    /** Text content (for stdout/stderr events). */
    text?: string;
}

/**
 * Result of a close event for a single command.
 */
export interface ConcurrentCloseEvent {
    /** The command string that was executed. */
    command: string;
    /** Duration in milliseconds. */
    durationMs: number;
    /** Exit code. -1 if killed by signal. */
    exitCode: number;
    /** Index of the command. */
    index: number;
    /** Whether the process was forcefully killed. */
    killed: boolean;
    /** The command name (if provided). */
    name?: string;
}

/**
 * Overall result of a concurrent run.
 */
export interface ConcurrentRunResult {
    /** Close events for all commands, in completion order. */
    closeEvents: ConcurrentCloseEvent[];
    /** Whether the run succeeded according to the success condition. */
    success: boolean;
}

// ─── Lifecycle Types ────────────────────────────────────────────────────

/**
 * Interface for lifecycle event handlers.
 */
export interface LifeCycleInterface {
    endCommand?: () => void;
    endTasks?: (taskResults: TaskResult[]) => void;
    /** Called when a cache miss occurs with diagnostic information */
    printCacheMiss?: (task: Task, reasons: string) => void;
    printTaskTerminalOutput?: (task: Task, status: TaskStatus, terminalOutput: string) => void;
    scheduleTask?: (task: Task) => void;
    startCommand?: () => void;
    startTasks?: (tasks: Task[]) => void;
}
