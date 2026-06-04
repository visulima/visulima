import { appendFileSync } from "node:fs";

/**
 * Environment variable the task runner sets on a tracked child, pointing
 * at the per-task NDJSON hints file. When it's absent — i.e. the tool is
 * run outside a runner-managed task — every function in this module is a
 * graceful no-op.
 *
 * Kept as a string literal (not imported from `@visulima/task-runner`) so
 * this package stays dependency-free and a tool can adopt it without
 * pulling in the runner. The name is the stable wire contract.
 */
const HINTS_ENV = "TASK_RUNNER_HINTS";

/**
 * Appends one NDJSON line to the hints file. Synchronous + append-only so
 * the hint is durable the instant the call returns — even if the tool
 * crashes immediately after, the runner still sees every prior hint. A
 * hint must never break the user's task, so all failures are swallowed.
 */
const emit = (message: Record<string, unknown>): void => {
    const file = process.env[HINTS_ENV];

    if (!file) {
        return;
    }

    try {
        appendFileSync(file, `${JSON.stringify(message)}\n`);
    } catch {
        // Best-effort: a failed hint must never fail the task.
    }
};

/**
 * Resolves a `*`-glob (e.g. `VITE_*`, `*_TOKEN`, `A*B`) against an env
 * map and returns the matching entries with defined values.
 */
const escapeGlobChar = (character: string): string => {
    if (character === "*") {
        return ".*";
    }

    return `\\${character}`;
};

const globRegexCache = new Map<string, RegExp>();

const matchEnv = (pattern: string, environment: NodeJS.ProcessEnv): Record<string, string> => {
    let regex = globRegexCache.get(pattern);

    if (regex === undefined) {
        regex = new RegExp(`^${pattern.replaceAll(/[.*+?^${}()|[\]\\]/g, escapeGlobChar)}$`);
        globRegexCache.set(pattern, regex);
    }

    // Collect into a Map first so reserved names like `__proto__`/`constructor`
    // can't trigger prototype-pollution setters, then materialize via
    // Object.fromEntries (defines own data properties, never invokes setters)
    // so the returned value keeps a normal Object prototype.
    const result = new Map<string, string>();

    for (const [key, value] of Object.entries(environment)) {
        if (value !== undefined && regex.test(key)) {
            result.set(key, value);
        }
    }

    return Object.fromEntries(result);
};

/**
 * Tell the runner to ignore reads under `path` when inferring this run's
 * cache inputs — for tool-private caches (`node_modules/.cache/*`,
 * `.eslintcache`) that are read every run but aren't real inputs.
 *
 * No-op when not running inside a runner.
 */
export const ignoreInput = (path: string): void => {
    emit({ op: "ignoreInput", path });
};

/**
 * Tell the runner to ignore writes under `path` when inferring this run's
 * cache outputs — for scratch/temp files that aren't real build outputs.
 *
 * No-op when not running inside a runner.
 */
export const ignoreOutput = (path: string): void => {
    emit({ op: "ignoreOutput", path });
};

/**
 * Tell the runner not to cache this run — for runs the tool knows are
 * non-deterministic (a network flake, debug mode, an aborted watch).
 *
 * No-op when not running inside a runner.
 */
export const disableCache = (): void => {
    emit({ op: "disableCache" });
};

/**
 * Return `process.env[name]` and, with `tracked: true` (the default),
 * register `name` as a cache dependency so a change to its value
 * invalidates this run's cache entry.
 *
 * Unlike a bare `process.env` read, this makes the dependency visible to
 * the runner at the point of use — closing the silent under-tracking gap
 * where a var consumed deep inside a tool isn't covered by the runner's
 * configured env patterns. Outside a runner it simply returns the value.
 */
export const getEnv = (name: string, options?: { tracked?: boolean }): string | undefined => {
    if (options?.tracked !== false) {
        emit({ name, op: "trackEnv" });
    }

    return process.env[name];
};

/**
 * Return every env var whose name matches the `*`-glob `pattern` (e.g.
 * `VITE_*`) and, with `tracked: true` (the default), register the pattern
 * as a cache dependency so adding, removing, or changing a matching var
 * invalidates this run's cache entry.
 *
 * Returns the matched values regardless of runner presence; only the
 * dependency registration is gated on running inside a runner.
 */
export const getEnvs = (pattern: string, options?: { tracked?: boolean }): Record<string, string> => {
    if (options?.tracked !== false) {
        emit({ op: "trackEnvPattern", pattern });
    }

    return matchEnv(pattern, process.env);
};
