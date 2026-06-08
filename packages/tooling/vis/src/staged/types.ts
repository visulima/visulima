/**
 * Public types for the in-house staged-files workflow that replaces
 * the `lint-staged` peer dependency. The surface mirrors lint-staged's
 * so existing configs and the `vis staged` command contract survive.
 */

/** Status of a single task or pattern in the runner lifecycle. */
export type TaskStatus = "failed" | "pending" | "running" | "skipped" | "success";

/**
 * Custom task form — `{ title, task }` — analogous to lint-staged's
 * listr-style task objects. `task` receives the matched absolute paths
 * and returns a promise that resolves on success or rejects on failure.
 */
export interface CustomTask {
    readonly task: (files: string[]) => unknown;
    readonly title: string;
}

/**
 * Object form of a command task. Unlike a bare command string it carries
 * execution options:
 *
 * - `perPackage` runs the command once per workspace package that owns the
 *   matched files, with `cwd` set to that package's directory and file paths
 *   made relative to it. Use it for tools that resolve their config or
 *   plugins from the nearest `package.json` — e.g. eslint with a
 *   cwd-sensitive shareable config. Files that sit under no workspace
 *   package fall back to a single run from the workspace root.
 * - `cwd` pins the command to a fixed directory (relative to the workspace
 *   root, or absolute) and passes the matched files as absolute paths so
 *   they resolve regardless of where the command runs. Ignored when
 *   `perPackage` is set — that derives the cwd per package instead.
 *
 * A command task is distinguished from {@link CustomTask} by carrying a
 * `command` string and no `task` function.
 */
export interface CommandTask {
    readonly command: string;
    readonly cwd?: string;
    readonly perPackage?: boolean;
}

/**
 * A task value as authored by the user. Command strings are split into
 * argv and invoked with the matched file paths appended. `{ command, … }`
 * objects do the same with per-task execution options (cwd / perPackage).
 * Arrays run serially. Functions receive the matched paths and return
 * further task values (possibly async). `{ title, task }` objects run
 * `task` directly with no argv construction.
 */
export type StagedTask = CommandTask | CustomTask | StagedTaskFunction | string | ReadonlyArray<CommandTask | CustomTask | StagedTaskFunction | string>;

export type StagedTaskFunction = (files: string[]) => Promise<StagedTaskResult> | StagedTaskResult;

export type StagedTaskResult = CommandTask | CustomTask | string | ReadonlyArray<CommandTask | CustomTask | string>;

/**
 * Config object mapping glob patterns (basename or path-style) to tasks.
 * A top-level function form lets the user generate the entire config
 * from the staged file list.
 */
export type StagedConfig = Readonly<Record<string, StagedTask>> | StagedConfigFunction;

export type StagedConfigFunction = (files: string[]) => Promise<Record<string, StagedTask>> | Record<string, StagedTask>;

/** Options accepted by `runStaged`. Mirrors the lint-staged CLI surface. */
export interface RunOptions {
    /** Allow empty commits when tasks revert every staged change. */
    readonly allowEmpty?: boolean;

    /**
     * When a task writes *new* files that sit outside the originally-staged
     * set, automatically stage them too. Defaults to `false` — only tasks
     * explicitly called out to produce new artefacts should set this (e.g.
     * codegen, lockfile regeneration). Closes nano-staged #43.
     */
    readonly autoStage?: boolean;
    /** Concurrency: `true` (unbounded), `false` (serial), or a positive integer. */
    readonly concurrent?: boolean | number;
    /** Inline staged config — the single source of truth at runtime. Supplied by `vis staged` from `vis.config.ts`. */
    readonly config?: StagedConfig;
    /** Run all tasks to completion even if one fails. */
    readonly continueOnError?: boolean;
    /** Working directory used for git and task execution. */
    readonly cwd?: string;
    /** Enable debug logging and force the plain renderer. */
    readonly debug?: boolean;
    /** Override the default `--staged` diff scope with an arbitrary git range. Implies `--no-stash`. */
    readonly diff?: string;
    /** Override the default `--diff-filter=ACMR`. */
    readonly diffFilter?: string;
    /** Exit with a non-zero status if tasks modified tracked files. Implies `--no-revert`. */
    readonly failOnChanges?: boolean;

    /**
     * Hide every unstaged change *and* every untracked file before running
     * tasks. Useful for tools like Knip that inspect the whole worktree.
     * Backed by a `git stash --include-untracked` so restore is automatic.
     */
    readonly hideAll?: boolean;
    /** Hide unstaged edits on partially-staged files (default: `true`). Set `false` to disable. */
    readonly hidePartiallyStaged?: boolean;
    /** Hide unstaged changes on every tracked file, not only partially-staged ones. */
    readonly hideUnstaged?: boolean;

    /**
     * Glob patterns for files to exclude from every task. Applied to the
     * staged file list before pattern matching, so an `ignore` hit drops
     * a file from *all* tasks regardless of which globs would otherwise
     * have picked it up. Closes lint-staged issue #1722.
     */
    readonly ignore?: ReadonlyArray<string>;

    /**
     * Signal used to kill in-flight task subprocesses when the run is
     * cancelled (another task failed without `continueOnError`, or the
     * user hit Ctrl+C). Defaults to `SIGTERM`, which lets well-behaved
     * tools flush before exiting. Use `SIGKILL` for fast-fail runs
     * where graceful shutdown is not worth the wait.
     * @default "SIGTERM"
     */
    readonly killSignal?: NodeJS.Signals;
    /** Cap on combined argv byte length per command invocation. Defaults to a conservative OS limit. */
    readonly maxArgLength?: number;
    /** Suppress progress output entirely. */
    readonly quiet?: boolean;
    /** Pass matched paths to tasks relative to `cwd` instead of absolute. */
    readonly relative?: boolean;
    /** Revert the working tree from the backup stash when a task fails. */
    readonly revert?: boolean;
    /** Take a backup stash before running tasks (default: `true`). Set `false` to disable. */
    readonly stash?: boolean;
    /** Show task stdout/stderr on success, not only on failure. */
    readonly verbose?: boolean;
}

/** A runtime descriptor for a single command belonging to a pattern. */
export interface CommandDescriptor {
    /** Resolved command template; absent for custom tasks. */
    readonly command?: string;
    /** Working directory override for this command; falls back to the run-level cwd when absent. Set by per-package fan-out and fixed-cwd command tasks. */
    readonly cwd?: string;
    /** Matched files (absolute or relative, per `relative` option). */
    readonly files: ReadonlyArray<string>;
    /** A stable id for renderer lookups. */
    readonly id: string;
    /** Custom task callback; only set when `source === "custom"`. */
    readonly run?: (files: string[]) => unknown;
    readonly source: "custom" | "function" | "string";
    readonly title: string;
}

/** A runtime descriptor for a glob pattern and its resolved commands. */
export interface PatternDescriptor {
    readonly commands: ReadonlyArray<CommandDescriptor>;
    readonly files: ReadonlyArray<string>;
    readonly id: string;
    readonly pattern: string;
    readonly title: string;
}

/** Events emitted by the runner and consumed by a renderer. */
export interface RunnerEvents {
    commandEnd: {
        readonly commandId: string;
        readonly durationMs: number;
        readonly error?: Error;
        readonly output?: string;
        readonly patternId: string;
        readonly status: TaskStatus;
    };
    commandStart: { readonly commandId: string; readonly patternId: string };
    error: { readonly error?: Error; readonly message: string };
    info: { readonly message: string };
    patternEnd: { readonly patternId: string; readonly status: TaskStatus };
    patternStart: { readonly patternId: string };
    start: { readonly patterns: ReadonlyArray<PatternDescriptor> };
    warn: { readonly message: string };
}

/** Abstract renderer contract — plain and Ink implementations conform. */
export interface Renderer {
    commandEnd: (payload: RunnerEvents["commandEnd"]) => void;
    commandStart: (payload: RunnerEvents["commandStart"]) => void;
    error: (payload: RunnerEvents["error"]) => void;
    info: (payload: RunnerEvents["info"]) => void;
    patternEnd: (payload: RunnerEvents["patternEnd"]) => void;
    patternStart: (payload: RunnerEvents["patternStart"]) => void;
    start: (payload: RunnerEvents["start"]) => void;
    stop: () => Promise<void> | void;
    warn: (payload: RunnerEvents["warn"]) => void;
}

/** Outcome of a `runStaged` invocation. */
export interface RunResult {
    readonly failedCommands: ReadonlyArray<string>;
    readonly ranTasks: boolean;
    readonly success: boolean;
}
