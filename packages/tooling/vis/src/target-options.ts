import { existsSync, readFileSync } from "node:fs";
import { platform } from "node:os";

import { join } from "@visulima/path";
import type { TargetConfiguration } from "@visulima/task-runner";

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
 */
export interface VisTargetOptions {
    /**
     * How to forward affected files to the task process.
     * Only used when invoked via `vis affected <target>`.
     * @default false
     */
    affectedFiles?: AffectedFilesMode;

    /**
     * Load environment variables from the given dotenv file before running.
     * Path is resolved relative to the project root.
     */
    envFile?: string;

    /**
     * When true, the task is hidden from CLI listings and can only be invoked
     * as a dependency of another task.
     * @default false
     */
    internal?: boolean;

    /**
     * When true, the task is serialized with respect to parallel execution
     * and must be run on the main process (claims stdin). Used for commands
     * that read from the terminal.
     * @default false
     */
    interactive?: boolean;

    /**
     * Serializes all tasks that share the same mutex name. Useful for tasks
     * that contend on a shared resource (e.g., a database migration).
     */
    mutex?: string;

    /**
     * Restricts execution to specific operating systems. Tasks run on
     * unmatched platforms are skipped with a warning.
     */
    osType?: TargetOsType | TargetOsType[];

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
     * Controls whether the task runs in CI environments.
     * @default true
     */
    runInCI?: RunInCI;

    /**
     * When true, the command executes with the workspace root as CWD
     * instead of the project root.
     * @default false
     */
    runFromWorkspaceRoot?: boolean;

    /**
     * Per-target shell override. When set, the command runs through this
     * shell instead of the platform default.
     */
    shell?: string;

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

/**
 * Option defaults applied by each preset. User options override these.
 */
const PRESETS: Record<TargetPreset, Partial<VisTargetOptions> & { cache?: boolean }> = {
    server: {
        cache: false,
        interactive: false,
        persistent: true,
        runInCI: false,
    },
    utility: {
        cache: false,
        runInCI: false,
    },
};

/**
 * Apply preset defaults to a target configuration. Returns a new
 * object — never mutates its input.
 */
export const applyPreset = (target: VisTargetConfiguration): VisTargetConfiguration => {
    const preset = target.preset ?? target.options?.preset;

    if (!preset) {
        return target;
    }

    const presetDefaults = PRESETS[preset];

    if (!presetDefaults) {
        return target;
    }

    const { cache: presetCache, ...optionDefaults } = presetDefaults;

    return {
        ...target,
        cache: target.cache ?? presetCache,
        options: {
            ...optionDefaults,
            ...target.options,
        },
    };
};

/** Normalises an `osType` option to an array. */
const normalizeOsType = (osType: VisTargetOptions["osType"]): TargetOsType[] | undefined => {
    if (osType === undefined) {
        return undefined;
    }

    return Array.isArray(osType) ? osType : [osType];
};

/** Detects the current operating system as a {@link TargetOsType}. */
export const detectCurrentOs = (): TargetOsType => {
    const p = platform();

    if (p === "darwin") {
        return "macos";
    }

    if (p === "win32") {
        return "windows";
    }

    return "linux";
};

/**
 * Returns `true` if the given OS matches the target's `osType` filter.
 * Tasks without an `osType` option always match.
 */
export const matchesOs = (options: VisTargetOptions | undefined, currentOs: TargetOsType = detectCurrentOs()): boolean => {
    const osType = normalizeOsType(options?.osType);

    if (!osType || osType.length === 0) {
        return true;
    }

    return osType.includes(currentOs);
};

/**
 * Returns `true` if the task should run in the current environment based
 * on its `runInCI` option. `affectedInCi` should indicate whether the
 * project is in the current affected set (only relevant for `"affected"`).
 */
export const shouldRunInCI = (options: VisTargetOptions | undefined, isCi: boolean, affectedInCi = true): boolean => {
    const mode = options?.runInCI ?? true;

    if (mode === true || mode === "always") {
        return true;
    }

    if (mode === false) {
        return !isCi;
    }

    if (mode === "affected") {
        return !isCi || affectedInCi;
    }

    return true;
};

/**
 * Parses a dotenv file into a map. Minimal parser — sufficient for
 * `KEY=value` lines, `#` comments, and optional surrounding quotes.
 * Returns an empty object if the file doesn't exist or can't be parsed.
 */
export const loadEnvFile = (projectRoot: string, envFile: string): Record<string, string> => {
    const absolutePath = envFile.startsWith("/") ? envFile : join(projectRoot, envFile);

    if (!existsSync(absolutePath)) {
        return {};
    }

    let contents: string;

    try {
        contents = readFileSync(absolutePath, "utf8");
    } catch {
        return {};
    }

    const env: Record<string, string> = {};

    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (line === "" || line.startsWith("#")) {
            continue;
        }

        const equalsIndex = line.indexOf("=");

        if (equalsIndex === -1) {
            continue;
        }

        const key = line.slice(0, equalsIndex).trim();

        if (key === "") {
            continue;
        }

        let value = line.slice(equalsIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        env[key] = value;
    }

    return env;
};

/**
 * Pick the effective shell for a target on the current platform.
 * Returns `undefined` if no per-target shell is configured.
 */
export const resolveTargetShell = (options: VisTargetOptions | undefined, currentOs: TargetOsType = detectCurrentOs()): string | undefined => {
    if (!options) {
        return undefined;
    }

    if (currentOs === "windows" && options.windowsShell) {
        return options.windowsShell;
    }

    if ((currentOs === "linux" || currentOs === "macos") && options.unixShell) {
        return options.unixShell;
    }

    return options.shell;
};

/**
 * Returns the default `cache` value implied by the target type.
 * - `build`: cached by default.
 * - `run`: never cached.
 * - `test`: cached by default.
 */
export const defaultCacheForType = (type: TargetType | undefined): boolean | undefined => {
    if (type === "run") {
        return false;
    }

    if (type === "build" || type === "test") {
        return true;
    }

    return undefined;
};
