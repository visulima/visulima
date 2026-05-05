import { platform } from "node:os";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { TargetOsType, TargetPreset, TargetType, VisTargetConfiguration, VisTargetOptions } from "./types";

export type { AffectedFilesMode, RunInCI, ServiceConfig, TargetOsType, TargetPreset, TargetType, VisTargetConfiguration, VisTargetOptions } from "./types";

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
 * Returns `true` if the task is eligible to run on a runner whose
 * advertised tag set is `runnerTags`.
 *
 * - `runnerTags === undefined` → filter is inactive, every task runs
 *   (back-compat — no `--runner-tags` flag, no `VIS_RUNNER_TAGS` env).
 * - Task has no `runnerTags` (undefined or empty) → general-purpose,
 *   eligible on any runner.
 * - Task has `runnerTags` → eligible iff at least one tag overlaps
 *   with the runner's advertised set.
 *
 * The asymmetry is intentional: untagged tasks are the default lane,
 * while tagged tasks declare a hard capability requirement that the
 * runner must satisfy.
 */
export const matchesRunnerTags = (options: VisTargetOptions | undefined, runnerTags: ReadonlySet<string> | undefined): boolean => {
    if (!runnerTags || runnerTags.size === 0) {
        return true;
    }

    const taskTags = options?.runnerTags;

    if (!taskTags || taskTags.length === 0) {
        return true;
    }

    return taskTags.some((tag) => runnerTags.has(tag));
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
 * Resolves the `envFile` target option into a merged env map.
 *
 * - `string` → load that single file
 * - `string[]` → load each in order; later entries win on key collision
 * - `true` → load the Next/Vite cascade:
 *   `.env` → `.env.{NODE_ENV}` → `.env.local` → `.env.{NODE_ENV}.local`
 *   (`.env.local` skipped for NODE_ENV=test, matching Next.js)
 *
 * Silently skips files that don't exist. Returns `{}` when no file in
 * the cascade is present — safe to merge directly into the child env.
 */
export const loadEnvFile = (projectRoot: string, envFile: boolean | string | string[]): Record<string, string> => {
    if (envFile === false) {
        return {};
    }

    const files = envFile === true ? resolveEnvCascade(process.env["NODE_ENV"]) : Array.isArray(envFile) ? envFile : [envFile];
    const merged: Record<string, string> = {};

    for (const file of files) {
        Object.assign(merged, loadSingleEnvFile(projectRoot, file));
    }

    return merged;
};

/**
 * Returns the ordered dotenv filenames used by auto-cascade mode.
 * Mirrors Next.js loading order: specific files override base files.
 */
const resolveEnvCascade = (nodeEnv: string | undefined): string[] => {
    const files = [".env"];

    if (nodeEnv) {
        files.push(`.env.${nodeEnv}`);
    }

    // `.env.local` is intentionally skipped when running tests so CI
    // secrets don't leak into the test environment — matches Next.js.
    if (nodeEnv !== "test") {
        files.push(".env.local");
    }

    if (nodeEnv && nodeEnv !== "test") {
        files.push(`.env.${nodeEnv}.local`);
    }

    return files;
};

const loadSingleEnvFile = (projectRoot: string, envFile: string): Record<string, string> => {
    const absolutePath = envFile.startsWith("/") ? envFile : join(projectRoot, envFile);

    if (!isAccessibleSync(absolutePath)) {
        return {};
    }

    let contents: string;

    try {
        contents = readFileSync(absolutePath);
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
