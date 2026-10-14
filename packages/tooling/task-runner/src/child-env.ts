import { HINTS_ENV, PROTOCOL_ENV } from "./cache-hints";
import { createEnvMatcher } from "./fingerprint";

/**
 * Environment policy for a task's child process.
 *
 * - `inherit` (default): the child receives the whole parent `process.env`.
 * - `clean`: the child receives only the parent variables the allow-list
 *   keeps (see {@link CLEAN_ENV_BASE_NAMES} and the platform essentials),
 *   plus whatever the executor injects on top of that.
 */
export interface ChildEnvOptions {
    /**
     * Names and `*` wildcard patterns kept from the parent environment in
     * `clean` mode. Ignored under `inherit`. Matching is case-insensitive on
     * Windows, where environment names are case-insensitive.
     */
    allow?: string[];
    /** Whether the child inherits the parent environment. */
    mode: "inherit" | "clean";
}

/**
 * Parent variables that clean mode keeps on every platform. Anything a
 * command needs beyond these (and the platform essentials) must be
 * allow-listed or injected by the executor.
 */
export const CLEAN_ENV_BASE_NAMES: ReadonlyArray<string> = ["PATH", "HOME", "TERM", "CI"];

/**
 * Parent variables that clean mode keeps on Windows. Without these,
 * `cmd.exe` and the system libraries misbehave, so a clean child would
 * fail for reasons unrelated to the task.
 */
export const CLEAN_ENV_WIN32_NAMES: ReadonlyArray<string> = ["SystemRoot", "TEMP", "TMP", "USERPROFILE", "PATHEXT", "COMSPEC"];

/**
 * Parent variables that clean mode keeps on POSIX. `LC_*` covers the locale
 * family.
 */
export const CLEAN_ENV_POSIX_NAMES: ReadonlyArray<string> = ["TMPDIR", "SHELL", "LANG", "LC_*", "USER"];

/**
 * Variables the file-access tracker writes into a traced child. They are laid
 * on top of the policy, so clean mode never drops them and tracking keeps
 * working:
 * - `TASK_RUNNER_HINTS` / `TASK_RUNNER_PROTOCOL`: where the cooperative client
 *   appends its hints, and the protocol version it speaks.
 * - `NODE_OPTIONS`: the `--import` preload that records a Node child's file
 *   accesses. Appended to any `NODE_OPTIONS` the child already has.
 *
 * Native trackers (seccomp, macOS interpose, IAT) also set variables on the
 * child, but they inherit the parent environment, so the tracked path does not
 * use them under clean mode (see `TrackedTaskExecutor.execute`).
 */
export const TRACKER_INJECTED_ENV_NAMES: ReadonlyArray<string> = [HINTS_ENV, PROTOCOL_ENV, "NODE_OPTIONS"];

/**
 * Returns the names clean mode keeps from the parent environment for the
 * given platform, before any allow-list is applied.
 */
export const cleanEnvEssentialNames = (platform: NodeJS.Platform = process.platform): ReadonlyArray<string> => [
    ...CLEAN_ENV_BASE_NAMES,
    ...(platform === "win32" ? CLEAN_ENV_WIN32_NAMES : CLEAN_ENV_POSIX_NAMES),
];

/**
 * Resolves the effective policy for one task from the workspace setting and
 * an optional per-target override.
 *
 * - No target override: the workspace policy applies (inherit when unset).
 * - Target `inherit`: that task opts out of a workspace `clean` policy.
 * - Target `clean`: the task is clean. Its allow-list is the workspace
 *   allow-list (when the workspace is also clean) plus the target's own names,
 *   so a target can add names without repeating the workspace list.
 */
export const resolveChildEnvPolicy = (workspace?: ChildEnvOptions, target?: ChildEnvOptions): Required<ChildEnvOptions> => {
    if (target === undefined) {
        return { allow: [...(workspace?.allow ?? [])], mode: workspace?.mode ?? "inherit" };
    }

    if (target.mode === "inherit") {
        return { allow: [], mode: "inherit" };
    }

    const inherited = workspace?.mode === "clean" ? (workspace.allow ?? []) : [];

    return { allow: [...inherited, ...(target.allow ?? [])], mode: "clean" };
};

/**
 * Returns the predicate that says whether a parent variable survives clean
 * mode. Under `inherit` every name survives.
 */
export const childEnvNameFilter = (policy: ChildEnvOptions, platform: NodeJS.Platform = process.platform): ((name: string) => boolean) => {
    if (policy.mode !== "clean") {
        return () => true;
    }

    const fold = platform === "win32" ? (value: string) => value.toUpperCase() : (value: string) => value;
    const matches = createEnvMatcher([...cleanEnvEssentialNames(platform), ...(policy.allow ?? [])].map(fold));

    return (name: string): boolean => matches(fold(name));
};

/**
 * Returns the parent variables a child under `policy` would see. Values are
 * kept as strings; unset entries are dropped.
 */
export const pickChildParentEnv = (
    parentEnv: NodeJS.ProcessEnv,
    policy: ChildEnvOptions,
    platform: NodeJS.Platform = process.platform,
): Record<string, string> => {
    const keep = childEnvNameFilter(policy, platform);
    const result: Record<string, string> = {};

    for (const [name, value] of Object.entries(parentEnv)) {
        if (value !== undefined && keep(name)) {
            result[name] = value;
        }
    }

    return result;
};

/**
 * Builds the full environment for a child process under `policy`: the
 * parent variables the policy keeps, with the executor's `injected` entries
 * laid on top. Injected entries are never filtered, because the executor
 * sets them on purpose.
 *
 * On Windows names are case-insensitive, so an injected name replaces a kept
 * parent name that differs only in case (`PATH` over `Path`). Keeping both
 * would hand the child two values for one variable.
 */
export const buildChildEnv = (options: {
    injected: Record<string, string | undefined>;
    parentEnv: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    policy: ChildEnvOptions;
}): Record<string, string> => {
    const platform = options.platform ?? process.platform;
    const injected: Record<string, string> = {};

    for (const [name, value] of Object.entries(options.injected)) {
        if (value !== undefined) {
            injected[name] = value;
        }
    }

    const picked = pickChildParentEnv(options.parentEnv, options.policy, platform);
    const injectedNames = new Set(Object.keys(injected).map((name) => (platform === "win32" ? name.toUpperCase() : name)));
    const kept = Object.entries(picked).filter(([name]) => !injectedNames.has(platform === "win32" ? name.toUpperCase() : name));

    return { ...Object.fromEntries(kept), ...injected };
};
