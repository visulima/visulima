import type { TargetConfiguration } from "@visulima/task-runner";

import type { ServiceConfig } from "../services/types";

export type { ServiceConfig } from "../services/types";

/**
 * Semantic classification for a target.
 * - `build`: Generates one or more artifacts; cached by default.
 * - `test`: Validation task (lint, typecheck, unit test). Default type.
 * - `run`: One-off or long-running process. Not cached by default.
 */
export type TargetType = "build" | "run" | "test";

/**
 * Preset bundles of target options.
 * - `server`: Long-running local dev server — caching off, not in CI,
 *   interactive, persistent.
 * - `utility`: Short-lived helper — caching off, not in CI.
 */
export type TargetPreset = "server" | "utility";

/**
 * Controls whether a target runs in CI.
 * - `true` (default): Always run.
 * - `false`: Never run in CI (local-only).
 * - `"affected"`: Only when the project is affected by the current change set.
 * - `"always"`: Always run, even if unaffected.
 */
export type RunInCI = "affected" | "always" | boolean;

/**
 * Controls how affected files are forwarded to a task.
 * - `false` (default): Do not forward.
 * - `"args"`: Append affected paths as additional command arguments.
 * - `"env"`: Expose them via `VIS_AFFECTED_FILES` environment variable.
 * - `"both"`: Both of the above.
 */
export type AffectedFilesMode = "args" | "both" | "env" | false;

/** Supported OS filters for target execution. */
export type TargetOsType = "linux" | "macos" | "windows";

/**
 * Vis-specific target options that extend the task-runner's
 * base `TargetConfiguration`. These live under `target.options` and are
 * interpreted by vis before handing the task off to task-runner.
 *
 * Conditional execution (`when:`) and finally tasks (`always:`) live at
 * the target top level, not under `options` — they're handled by the
 * task-runner orchestrator. See `@visulima/task-runner`'s `WhenCondition`.
 */
export interface VisTargetOptions {
    /**
     * How to forward affected files to the task process.
     * Only used when invoked via `vis affected &lt;target>`.
     * @default false
     */
    affectedFiles?: AffectedFilesMode;

    /**
     * Load environment variables from dotenv file(s) before running.
     * - `string`: a single file path (relative to project root).
     * - `string[]`: multiple files — later entries override earlier ones,
     *   so put more-specific files last (e.g. `[".env", ".env.local"]`).
     * - `true`: auto-cascade in the Next/Vite order:
     *   `.env` → `.env.{NODE_ENV}` → `.env.local` → `.env.{NODE_ENV}.local`.
     *   Skips `.env.local` when NODE_ENV is `test`, matching Next.js.
     */
    envFile?: boolean | string | string[];

    /**
     * When true, the task is serialized with respect to parallel execution
     * and must be run on the main process (claims stdin). Used for commands
     * that read from the terminal.
     * @default false
     */
    interactive?: boolean;

    /**
     * When true, the task is hidden from CLI listings and can only be invoked
     * as a dependency of another task.
     * @default false
     */
    internal?: boolean;

    /**
     * Milliseconds the timeout watchdog waits between sending SIGTERM
     * and SIGKILL when the `timeout` budget fires. Tasks that ignore
     * SIGTERM (e.g. test runners holding open child processes) get
     * force-killed after this grace window so a stuck task can't outlive
     * its budget.
     *
     * Set to `0` to skip escalation and rely on SIGTERM only.
     * @default 5000
     */
    killGracePeriodMs?: number;

    /**
     * Serializes all tasks that share the same mutex name. Useful for tasks
     * that contend on a shared resource (e.g., a database migration).
     */
    mutex?: string;

    /**
     * Per-target output verbosity. Overrides the global `--output-style`
     * flag for this specific target.
     *
     * - `"normal"` (default): print every task's terminal output
     * - `"quiet"`: only print output when the task fails. Successful
     *   and cached tasks contribute their status line and timing, but
     *   their captured stdout/stderr is suppressed.
     *
     * Useful when a routinely-noisy task (a linter or test runner with
     * verbose progress output) should stay quiet during green builds
     * but reveal everything when it fails.
     */
    outputStyle?: "normal" | "quiet";

    /**
     * When true, the task is a long-running / never-ending process.
     * Persistent tasks are scheduled last, execute after all cacheable
     * tasks complete, and are never cached.
     * @default false
     */
    persistent?: boolean;

    /**
     * A preset that pre-fills a common bundle of options.
     * User-provided fields always take precedence over the preset.
     */
    preset?: TargetPreset;

    /**
     * Run the task through a pseudo-terminal so color-aware tools
     * (vitest, eslint, biome, …) render as if attached to a real TTY
     * instead of a pipe. Output is captured via task-runner's
     * `TerminalBuffer` so ANSI escapes are normalized into the final
     * rendered state before reaching the reporter.
     *
     * Forces cache to off — PTY output can include timing-dependent
     * frames (spinners) that aren't safe to replay from a cache.
     * @default false
     */
    pty?: boolean;

    /**
     * Number of times to retry the task on failure. Uses an exponential
     * backoff by default (1s, 2s, 4s, ...).
     * @default 0
     */
    retryCount?: number;

    /**
     * Delay between retry attempts in milliseconds, or `"exponential"`
     * for 2^attempt * 1000 ms.
     * @default "exponential"
     */
    retryDelay?: number | "exponential";

    /**
     * When true, the command executes with the workspace root as CWD
     * instead of the project root.
     * @default false
     */
    runFromWorkspaceRoot?: boolean;

    /**
     * Controls whether the task runs in CI environments.
     * @default true
     */
    runInCI?: RunInCI;

    /**
     * Marks this target as a long-lived service that can be started via
     * `vis service start <id>` and auto-attached when other tasks declare
     * it in `dependsOn`. Implies persistent + non-cacheable behaviour
     * (set `preset: "server"` to inherit the rest of the bundle).
     *
     * The presence of this block — not `preset: "server"` alone — is
     * what makes a target eligible for the cross-invocation registry.
     * `preset: "server"` without `service` keeps today's in-run-only
     * behaviour.
     */
    service?: ServiceConfig;

    /**
     * Per-target shell override. When set, the command runs through this
     * shell instead of the platform default.
     */
    shell?: string;

    /**
     * Maximum wall-clock milliseconds a single task run is allowed to
     * take before being killed. `0` / `undefined` means no timeout.
     *
     * When the timeout fires the task is sent SIGTERM and, if it has
     * not exited within `killGracePeriodMs`, SIGKILL. The task exits
     * with a failure status carrying the `[timeout]` marker in
     * `terminalOutput`. Retries count per-attempt, not cumulatively.
     *
     * Use this to prevent runaway tasks from eating CI wall-clock time
     * up to the job-level cutoff.
     */
    timeout?: number;

    /**
     * Per-target unix shell override, used on Linux and macOS.
     * Takes precedence over `shell` on unix-like systems.
     */
    unixShell?: string;

    /**
     * Per-target windows shell override, used on Windows.
     * Takes precedence over `shell` on Windows.
     */
    windowsShell?: string;
}

/**
 * An extended target configuration that adds the vis-specific options
 * on top of task-runner's `TargetConfiguration`.
 */
export interface VisTargetConfiguration extends Omit<TargetConfiguration, "options"> {
    /**
     * Alternate names that resolve to this target on the CLI. Useful
     * for shortening long canonical names (`test` ↔ `t`) or for
     * offering migration-friendly aliases when renaming targets.
     * Aliases must be globally unique within the workspace.
     */
    aliases?: string[];

    /**
     * One-line description surfaced by `vis list` and (in future)
     * per-task `--help`. Kept short — longer docs belong in project
     * READMEs or vis.config.ts comments.
     */
    description?: string;
    /**
     * True when the target was synthesized by a Project Crystal-style
     * detector (see {@link ../inference}) rather than declared by a
     * package.json script, project.json, or vis.task.ts file. Surfaced
     * by `vis list --inferred` and used by tooling to distinguish
     * implicit defaults from explicit user intent.
     */
    inferred?: boolean;
    /** Vis-specific target options. */
    options?: VisTargetOptions;
    /** Preset applied before user-specified options. */
    preset?: TargetPreset;

    /**
     * Semantic task type. Affects caching defaults and CI filtering.
     * @default "test"
     */
    type?: TargetType;
}
