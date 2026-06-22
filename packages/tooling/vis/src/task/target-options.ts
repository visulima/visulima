import { platform } from "node:os";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { isAbsolute, join } from "@visulima/path";

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
 * Resolves a task's effective working directory. Returns the workspace
 * root when `runFromWorkspaceRoot` is set, otherwise resolves
 * `projectRoot` — keeping absolute paths as-is and prefixing relative
 * ones with the workspace root.
 */
export const resolveTaskCwd = (workspaceRoot: string, projectRoot: string | undefined, runFromWorkspaceRoot: boolean): string => {
    if (runFromWorkspaceRoot || !projectRoot) {
        return workspaceRoot;
    }

    // `startsWith("/")` misses Windows absolute paths (`C:/...`), which
    // then got concatenated with `workspaceRoot` and yielded a bogus
    // cwd — every spawn died with UV_ENOENT (-4058) on Windows CI.
    return isAbsolute(projectRoot) ? projectRoot : join(workspaceRoot, projectRoot);
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
        // Later files in the cascade can interpolate values defined by earlier
        // ones, so pass the accumulated map down as the lookup scope.
        Object.assign(merged, loadSingleEnvFile(projectRoot, file, merged));
    }

    return merged;
};

/**
 * Expand `${VAR}` / `$VAR` references in a dotenv value (dotenv-expand
 * semantics). Lookup order: the already-loaded cascade `scope` wins, then
 * `process.env`. Supports:
 *
 * - `${VAR}` / `$VAR` — substitute, or empty string when unset.
 * - `${VAR:-default}` — substitute, falling back to `default` when `VAR`
 *   is unset or empty (the default may itself reference other vars).
 * - `\$` — a literal `$` (the backslash is consumed).
 *
 * Callers must NOT pass single-quoted values here — those are literal.
 */
const expandEnvValue = (value: string, scope: Record<string, string>): string => {
    const lookup = (name: string): string => {
        const fromScope = scope[name];

        if (fromScope !== undefined) {
            return fromScope;
        }

        const fromProcess = process.env[name];

        return fromProcess ?? "";
    };

    let result = "";

    for (let index = 0; index < value.length; index += 1) {
        const char = value[index] as string;

        // `\$` → literal `$`. Any other `\x` is left untouched (dotenv keeps
        // the backslash for non-`$` escapes).
        if (char === "\\" && value[index + 1] === "$") {
            result += "$";
            index += 1;

            continue;
        }

        if (char !== "$") {
            result += char;

            continue;
        }

        const next = value[index + 1];

        if (next === "{") {
            // Find the MATCHING close brace, tracking depth so a nested `${...}`
            // in a `:-default` (e.g. `${A:-${B}}`) closes on the outer `}`, not
            // the inner one.
            let depth = 1;
            let scan = index + 2;

            while (scan < value.length) {
                const current = value[scan];

                if (current === "}") {
                    depth -= 1;

                    if (depth === 0) {
                        break;
                    }
                } else if (current === "{" && value[scan - 1] === "$") {
                    depth += 1;
                }

                scan += 1;
            }

            if (depth !== 0) {
                // Unterminated `${` — emit verbatim and stop scanning specials.
                result += value.slice(index);
                break;
            }

            const close = scan;
            const expression = value.slice(index + 2, close);
            const separator = expression.indexOf(":-");

            if (separator === -1) {
                result += lookup(expression);
            } else {
                const name = expression.slice(0, separator);
                const fallback = expression.slice(separator + 2);
                const resolved = scope[name] ?? process.env[name];

                result += resolved !== undefined && resolved !== "" ? resolved : expandEnvValue(fallback, scope);
            }

            // eslint-disable-next-line sonarjs/updated-loop-counter -- manual scanner: jump past the consumed `${...}` span.
            index = close;

            continue;
        }

        // Bare `$VAR` — a name is `[A-Za-z_][A-Za-z0-9_]*`. A lone `$` (no
        // valid name follows) is kept literally.
        if (next !== undefined && /[A-Z_]/i.test(next)) {
            let end = index + 1;

            while (end < value.length && /\w/.test(value[end] as string)) {
                end += 1;
            }

            result += lookup(value.slice(index + 1, end));
            // eslint-disable-next-line sonarjs/updated-loop-counter -- manual scanner: jump past the consumed bare `$VAR`.
            index = end - 1;

            continue;
        }

        result += char;
    }

    return result;
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

const loadSingleEnvFile = (projectRoot: string, envFile: string, scope: Record<string, string> = {}): Record<string, string> => {
    // `startsWith("/")` only recognised POSIX absolute paths — a Windows
    // absolute path like `C:\foo\.env` would fall through and get joined
    // onto `projectRoot`, breaking the absolute-path branch on Windows.
    const absolutePath = isAbsolute(envFile) ? envFile : join(projectRoot, envFile);

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

        // Single-quoted values are LITERAL — no `${VAR}` expansion (dotenv-expand
        // semantics). Double-quoted and unquoted values are interpolated.
        const singleQuoted = value.length >= 2 && value.startsWith("'") && value.endsWith("'");

        if ((value.startsWith("\"") && value.endsWith("\"")) || singleQuoted) {
            value = value.slice(1, -1);
        }

        if (!singleQuoted) {
            value = expandEnvValue(value, { ...scope, ...env });
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
