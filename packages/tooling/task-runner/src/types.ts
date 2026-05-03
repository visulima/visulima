import type { RemoteCacheOptions } from "./backends/types";
import type { WhenCondition } from "./when-condition";

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

/**
 * Scheduling priority hint. The scheduler picks higher-priority tasks
 * out of the ready-queue first; ties fall through to the graph-derived
 * signals (dependent count, project depth).
 *
 * Use `"high"` for long-running leaves you want to kick off early
 * (integration tests, e2e suites) so their wall-clock overlaps with
 * the main build phase. Use `"low"` for work you don't mind deferring
 * (linters, coverage uploads) when faster tasks contend for slots.
 */
export type TaskPriority = "high" | "low" | "normal";

/**
 * A single entry in a task's `outputs` list.
 *
 * - `string` — a literal path *or* a glob pattern relative to the
 *   workspace root. Prefix with `!` to exclude files the positive
 *   patterns would otherwise include (e.g. `"!dist/cache/**"`).
 * - `{ auto: true }` — use whatever files the task actually wrote
 *   during execution (resolved from the file-access tracker). Lets
 *   authors who don't know their exact output layout cache results
 *   without listing every path. Silently behaves as "no outputs" when
 *   tracking isn't active for this task.
 */
export type OutputSpec = string | { auto: true };

export interface Task {
    /**
     * When `true`, this task runs after the main task graph completes
     * — even if upstream tasks failed or the run was interrupted.
     * Used for cleanup, teardown, or notification tasks. Carried over
     * from {@link TargetConfiguration.always} at task graph creation.
     */
    always?: boolean;
    /** Whether this task is eligible for caching */
    cache?: boolean;

    /**
     * When `false`, exit-0 runs whose output matched any
     * {@link Task.warningPattern} are NOT written to the cache. Defaults
     * to `true` — warnings are recorded on the result but don't suppress
     * caching, matching the rushstack#1402 / Theme P expectation that a
     * succeeded-with-warnings build is still incremental on the next run.
     *
     * Carried over from {@link TargetConfiguration.cacheOnWarning}.
     */
    cacheOnWarning?: boolean;

    /**
     * Per-task overrides for cache restore fidelity. Carried over
     * from {@link TargetConfiguration.cacheRestore}. When absent, the
     * runner uses faithful defaults (mtime + mode preserved).
     */
    cacheRestore?: CacheRestoreOptions;
    /** Hash of the task inputs for caching */
    hash?: string;
    /** Detailed hash information */
    hashDetails?: TaskHashDetails;
    /** Unique identifier for the task, typically "project:target:configuration" */
    id: string;

    /**
     * Output patterns this task produces. Each entry is either a
     * literal path, a glob (`"dist/**"`), a negative glob
     * (`"!dist/cache/**"`), or `{ auto: true }` to pick up whatever
     * files the task wrote during execution.
     */
    outputs: OutputSpec[];
    /** Overrides/extra options passed to the task */
    overrides: Record<string, unknown>;
    /** Whether this task supports parallel execution */
    parallelism?: boolean;

    /**
     * Explicit scheduling priority. Outranks the scheduler's
     * graph-derived heuristics. Defaults to `"normal"` when absent.
     */
    priority?: TaskPriority;
    /** The project root directory */
    projectRoot?: string;
    /** The target this task executes */
    target: TaskTarget;

    /**
     * Regex strings (JavaScript flavor, anchored as the user writes them)
     * that classify a successful task's terminal output as "succeeded
     * with warnings". When any pattern matches, {@link TaskResult.hadWarnings}
     * is set on the result. Combined with {@link Task.cacheOnWarning} this
     * controls whether the run still seeds the cache.
     *
     * Carried over from {@link TargetConfiguration.warningPattern}.
     */
    warningPattern?: string[];

    /**
     * Predicate that gates execution. Evaluated by the orchestrator
     * just before the task is launched; tasks whose `when` returns
     * `false` are marked `"skipped"` without ever invoking the
     * executor. Carried over from {@link TargetConfiguration.when}.
     */
    when?: WhenCondition;
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

    /**
     * Set when auto-fingerprint tracking was attempted for this task but
     * returned zero workspace accesses — usually a static binary on
     * macOS/Windows, where the Node preload can't attach. Caching is
     * skipped to avoid persisting an empty fingerprint that would
     * produce false cache hits on every subsequent run.
     */
    emptyFingerprint?: boolean;
    /** The end time of the task */
    endTime?: number;

    /**
     * Set when the task exited 0 and at least one configured
     * {@link Task.warningPattern} matched the terminal output. Surfaced
     * to lifecycle reporters and the run summary so users can see that
     * a "green" build still emitted warnings, and gates the optional
     * `cacheOnWarning: false` cache-suppression path.
     */
    hadWarnings?: boolean;

    /**
     * Set when the task modified one or more of its own tracked input
     * files during execution. Caching is skipped in this case — the
     * fingerprint captured before the run would mismatch the post-run
     * contents and produce false cache hits on subsequent runs.
     */
    selfModified?: boolean;
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

    /**
     * Project layer in the dependency hierarchy. Used by
     * `enforceLayerRelationships` to ensure projects only depend on
     * projects at the same or lower layer.
     *
     * Hierarchy (lowest → highest):
     * `configuration < library < scaffolding < tool < automation < application`
     */
    layer?: "application" | "automation" | "configuration" | "library" | "scaffolding" | "tool";
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
 * Per-target controls over how the cache rehydrates outputs.
 *
 * Both default to `true` — faithful restoration is the contract:
 * cached outputs come back with the same mtime and mode bits the
 * task originally produced. Override only when downstream tooling
 * needs the opposite (e.g. a bundler that uses "newer than source"
 * heuristics, or a CI step that compares mtimes against a deploy
 * artifact).
 */
export interface CacheRestoreOptions {
    /**
     * Restore each file's modification time from the captured tar
     * header (second precision). When `false`, restored files take
     * the current wall-clock time, matching the legacy behaviour.
     */
    preserveMtime?: boolean;

    /**
     * Restore each file's POSIX mode bits (rwx triplets, low 12
     * bits). When `false`, restored files take the process umask.
     * Only meaningful on POSIX hosts; Windows ignores tar mode.
     */
    preservePerms?: boolean;
}

/**
 * Configuration for a target within a project.
 */
export interface TargetConfiguration {
    /**
     * When `true`, this target runs after the main task graph
     * completes — even if upstream tasks failed. Useful for cleanup,
     * teardown, notifications, or anything that should fire
     * regardless of build outcome. Always-tasks are not part of the
     * normal dependency graph and never block other tasks.
     */
    always?: boolean;
    /** Whether this target is cacheable */
    cache?: boolean;

    /**
     * When `false`, exit-0 runs whose terminal output matched any
     * {@link TargetConfiguration.warningPattern} are not seeded into the
     * cache. Defaults to `true` — warnings are surfaced on the result
     * (`hadWarnings: true`) but caching still happens, matching the
     * "succeeded with warnings is incremental" behaviour rush, lage and
     * wireit users have repeatedly asked for.
     */
    cacheOnWarning?: boolean;

    /**
     * Fine-grained controls over how cached outputs are rehydrated.
     * See {@link CacheRestoreOptions}. Both fields default to `true`
     * (faithful restore); flip individually when downstream tooling
     * needs the legacy "now"-stamped behaviour.
     */
    cacheRestore?: CacheRestoreOptions;
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

    /**
     * Regex source string(s) that mark a successful task as having
     * emitted warnings. The orchestrator scans the task's combined
     * terminal output after a 0-exit and, on first match, sets
     * `hadWarnings` on the result. Combine with `cacheOnWarning: false`
     * to skip caching for warning-tainted runs. Both bare strings and
     * arrays are accepted; arrays are tested in order.
     *
     *   ```ts
     *   warningPattern: ["\\bwarning\\b", "TS\\d{4}"]
     *   ```
     */
    warningPattern?: string | string[];

    /**
     * Predicate that gates execution. When the condition evaluates
     * to `false` for the current environment, the task is skipped
     * (marked `"skipped"`, not failed). Combine with `os`, `env`,
     * `branch`, and `ci` clauses for granular control:
     *
     *   ```ts
     *   when: { os: "linux", ci: true, env: "DEPLOY_TOKEN" }
     *   ```
     */
    when?: WhenCondition;
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
 * Controls how a glob pattern is anchored.
 * - "package" (default): pattern is resolved relative to the project root
 * - "workspace": pattern is resolved relative to the workspace root
 */
export type FileSetBase = "package" | "workspace";

/**
 * An input based on file patterns.
 *
 * `fileset` may be a bare glob string (package-root relative) or an object
 * form `{ pattern, base }` to anchor explicitly to the workspace root.
 * Negation (`!` prefix) works in both forms.
 */
export interface FileSetInput {
    fileset: FileSetPattern | string;
}

/**
 * Object form of a fileset pattern, for anchoring to the workspace root.
 */
export interface FileSetPattern {
    /** Anchor for the pattern. */
    base: FileSetBase;
    /** Glob pattern (may start with `!` for negation). */
    pattern: string;
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

// ─── Project Constraint Types ─────────────────────────────────────────

/**
 * Defines tag-based dependency rules.
 * Each key is a tag name. The value is the list of tags that a dependency
 * must have at least one of, when the source project has that tag.
 *
 * Example: `{ "frontend": ["shared", "frontend"] }` means a project tagged
 * "frontend" can only depend on projects tagged "shared" or "frontend".
 */
export type TagRelationships = Record<string, string[]>;

/**
 * Defines project-type-based dependency rules.
 */
export interface TypeBoundaries {
    /**
     * Custom rules mapping project types to allowed dependency types.
     * Example: `{ "application": ["library"] }` means applications can only
     * depend on libraries.
     */
    allowedDependencyTypes?: Record<string, string[]>;

    /**
     * When true, no project may depend on an "application" type project.
     * Applications are typically deployment targets, not libraries.
     * @default true
     */
    enforceApplicationBoundary?: boolean;
}

/**
 * Rules based on the dependency kind (dependencies vs devDependencies vs peerDependencies).
 */
export interface DependencyKindRules {
    /**
     * When true, a "library" project must not have workspace-internal devDependencies
     * on other libraries that are also in its production dependencies.
     * Prevents publishing libraries that silently rely on dev-only workspace packages.
     * @default false
     */
    noDevDependencyOnProductionDep?: boolean;

    /**
     * When true, production `dependencies` must not point to "application" type projects.
     * devDependencies on applications are allowed (e.g., for testing).
     * @default false
     */
    noProductionDependencyOnApplication?: boolean;
}

/**
 * Configuration for project constraint enforcement.
 */
export interface ConstraintsConfig {
    /** Rules based on the dependency kind (static vs devDependency vs peerDependency) */
    dependencyKindRules?: DependencyKindRules;

    /**
     * When true, projects can only depend on projects at the same or
     * lower layer in the hierarchy:
     *
     *   configuration < library < scaffolding < tool < automation < application
     *
     * Projects without an explicit `layer` are unconstrained.
     * @default false
     */
    enforceLayerRelationships?: boolean;
    /** Tag-based dependency rules */
    tagRelationships?: TagRelationships;
    /** Project-type-based dependency rules */
    typeBoundaries?: TypeBoundaries;
}

/**
 * A single constraint violation detected in the project graph.
 */
export interface ConstraintViolation {
    /** The project being depended on */
    dependencyProject: string;
    /** Human-readable description of the violation */
    message: string;
    /** The type of rule that was violated */
    rule: "dependency-kind" | "layer-relationship" | "tag-relationship" | "type-boundary";
    /** The project that has the invalid dependency */
    sourceProject: string;
}

/**
 * Controls how far to traverse the dependency graph in a given direction.
 * - "none": Don't traverse — only directly changed projects are included.
 * - "direct": Include only immediate neighbors (one hop).
 * - "deep": Include all transitive neighbors (full chain).
 */
export type AffectedScope = "deep" | "direct" | "none";

/**
 * Workspace configuration containing all project configurations.
 */
export interface WorkspaceConfiguration {
    /** All projects in the workspace, keyed by project name */
    projects: Record<string, ProjectConfiguration>;
}

/**
 * The kind of dependency relationship between projects.
 * - "static": Production dependency (from `dependencies` in package.json)
 * - "dynamic": Dynamically resolved dependency (e.g., lazy imports)
 * - "implicit": Declared via `implicitDependencies` in project config
 * - "devDependency": Development-only dependency (from `devDependencies`)
 * - "peerDependency": Peer dependency (from `peerDependencies`)
 */
export type DependencyType = "devDependency" | "dynamic" | "implicit" | "peerDependency" | "static";

/**
 * A dependency relationship in the project graph.
 */
export interface ProjectGraphDependency {
    /** The source project */
    source: string;
    /** The target project */
    target: string;
    /** The type of dependency */
    type: DependencyType;
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
     * Scan each task's resolved command text for `$VAR`/`${VAR}`
     * references and automatically fingerprint those env vars. Catches
     * tasks like `curl ${VERCEL_URL}/api` where the user forgot to
     * declare the reference in `envVars`/`globalEnv`.
     * @default false
     */
    autoEnvVars?: boolean;

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

    /**
     * When `true`, file hashes are cached in a persistent mtime+size
     * indexed snapshot under `node_modules/.cache/task-runner/`. On
     * subsequent runs, unchanged files skip content re-reads — cuts
     * cold-cache fingerprint time dramatically on large workspaces.
     *
     * Changed or new files still get full content hashing. Safe to
     * leave on by default; overhead when nothing matches is a single
     * `stat` call per file.
     * @default false
     */
    incrementalFileHashing?: boolean;

    /** Maximum age of cache entries in milliseconds */
    maxCacheAge?: number;
    /** Maximum cache size (e.g., "1GB") */
    maxCacheSize?: string;
    /** Named inputs for cache invalidation */
    namedInputs?: NamedInputs;

    /**
     * When `true`, the cache directory is partitioned by a hash of
     * the resolved `globalEnv` values. Changing a globalEnv var moves
     * cache writes into a new namespace; rolling it back reuses the
     * old namespace and its hits. Without this option, any globalEnv
     * change silently busts every cached entry.
     *
     * Keep disabled when globalEnv is stable across runs — the extra
     * path depth offers no value, and misconfigured namespaces can
     * hide stale hits.
     * @default false
     */
    namespaceByGlobalEnv?: boolean;
    /** Maximum number of parallel tasks */
    parallel?: number | boolean;

    /**
     * Remote cache configuration.
     * When configured, the task runner checks the remote cache after a
     * local miss and uploads results after execution. See
     * {@link RemoteCacheOptions} for the full HTTP and REAPI surface.
     */
    remoteCache?: RemoteCacheOptions;
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
export type ConcurrentCommandInput
    = | string
        | {
            command: string;
            cwd?: string;
            env?: Record<string, string>;
            name?: string;
            /** Initial PTY dimensions (only used when stdin is "pty"). */
            ptySize?: { cols: number; rows: number };
            stdin?: "inherit" | "null" | "pipe" | "pty";
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

    /**
     * Initial PTY dimensions. Only used when stdin is "pty".
     * Defaults to 80x24 if not specified.
     */
    ptySize?: { cols: number; rows: number };

    /** Whether to use shell execution (default: true). */
    shell?: boolean;

    /**
     * Stdin mode for the child process.
     * - "null" (default): stdin closed, child cannot read input
     * - "pipe": stdin is piped, can be written to programmatically
     * - "inherit": child inherits parent's stdin (for interactive commands like vite dev)
     * - "pty": child runs inside a pseudo-terminal (isatty() returns true, enables interactive prompts)
     */
    stdin?: "inherit" | "null" | "pipe" | "pty";
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

    /** Restart options for failed commands. */
    restart?: {
        /** Delay between restarts in ms. "exponential" for 2^attempt * 1000ms. */
        delay?: number | "exponential";
        /** Maximum restart attempts per command. 0 = no restarts. -1 = infinite. */
        tries: number;
    };

    /**
     * Custom shell path for command execution.
     * Overrides the platform default (/bin/sh on Unix, cmd.exe on Windows).
     * Automatically detected from npm's `script-shell` config if not set.
     */
    shellPath?: string;
    /** Success condition: "first", "last", "all", or "command-&lt;name|index>". */
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
    /** Kill the child process/PTY. Only present on "started" events. */
    kill?: (signal?: string) => void;
    /** Whether the process was killed (for close events). */
    killed?: boolean;
    /** Event type: "stdout", "stderr", "close", "error", "started". */
    kind: "close" | "error" | "started" | "stderr" | "stdout";
    /** Error message (for error events). */
    message?: string;
    /** Resize the child's PTY. Only present on "started" events with stdin "pty". */
    resize?: (cols: number, rows: number) => void;
    /** Text content (for stdout/stderr events). */
    text?: string;
    /** Write data to the child's stdin (pipe) or PTY. Only present on "started" events. */
    write?: (data: string) => void;
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

    /**
     * Called when a running task emits data on stderr, in the order the
     * data arrives. Executors that support streaming output (`vis run`'s
     * concurrent executor) forward chunks here verbatim. Executors that
     * only buffer full output (e.g. the simple test executor) skip this
     * hook — rely on `printTaskTerminalOutput` for the final dump.
     *
     * Handlers should be non-blocking; the orchestrator doesn't await.
     */
    onTaskStderr?: (task: Task, chunk: string) => void;

    /**
     * Called when a running task emits data on stdout, in the order the
     * data arrives. See {@link LifeCycleInterface.onTaskStderr} for
     * semantics — same contract, different stream.
     */
    onTaskStdout?: (task: Task, chunk: string) => void;
    /** Called when a cache miss occurs with diagnostic information */
    printCacheMiss?: (task: Task, reasons: string) => void;

    /**
     * Called when caching was skipped because auto-fingerprint tracking
     * came back empty — a signal that the tracker (strace or Node
     * preload) couldn't observe the task's file access, typically
     * because it's a static binary on a platform without strace.
     * `reason` is a short human-readable diagnostic.
     */
    printEmptyFingerprintWarning?: (task: Task, reason: string) => void;

    /**
     * Called when caching is skipped because the task modified one or
     * more of its own tracked inputs. `modifiedFiles` lists the
     * workspace-relative paths that changed between pre- and
     * post-execution hashes.
     */
    printSelfModifyingSkip?: (task: Task, modifiedFiles: string[]) => void;

    printTaskTerminalOutput?: (task: Task, status: TaskStatus, terminalOutput: string) => void;

    /**
     * Called when a task is skipped because its `when` clause did not
     * match the current environment. `reason` is a short
     * human-readable diagnostic produced by {@link import("./when-condition").explainWhen}.
     *
     * Co-fires with `printTaskTerminalOutput` (status `"skipped"`,
     * output `"Skipped: [reason]"`). Pick one to render — implementing
     * both will double-report the skip.
     */
    printWhenSkip?: (task: Task, reason: string) => void;
    scheduleTask?: (task: Task) => void;
    startCommand?: () => void;
    startTasks?: (tasks: Task[]) => void;
}
