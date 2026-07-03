import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Environment variable the task runner sets on a tracked child, pointing
 * at the per-task NDJSON hints file. When it's absent — i.e. the tool is
 * run outside a runner-managed task — every function in this module is a
 * graceful no-op.
 *
 * Kept as a string literal (not imported from `@visulima/task-runner`) so
 * this package stays dependency-free and a tool can adopt it without
 * pulling in the runner. The name is the stable wire contract.
 *
 * Exported so tools can branch on the runner's presence (see
 * {@link isManaged}) or wire it up in integration tests without
 * re-hardcoding the literal.
 */
const HINTS_ENV = "TASK_RUNNER_HINTS";

/**
 * Environment variable carrying the wire-protocol version the runner
 * speaks. Mirrors `@visulima/task-runner`'s `TASK_RUNNER_PROTOCOL`. A
 * client can read {@link getProtocolVersion} to degrade gracefully across
 * a future breaking wire change (the current runner emits `"1"`).
 *
 * Kept as a string literal for the same dependency-free reason as
 * {@link HINTS_ENV}.
 */
const PROTOCOL_ENV = "TASK_RUNNER_PROTOCOL";

/** The wire-protocol version this client was authored against. */
const SUPPORTED_PROTOCOL_VERSION = "1";

/**
 * Options shared by the env-tracking helpers ({@link getEnv} /
 * {@link getEnvs}). Exported so wrapper authors can reference the shape.
 */
interface TrackOptions {
    /**
     * Register the read as a cache dependency. Defaults to `true`; pass
     * `false` to read the value without making it invalidate the cache.
     */
    tracked?: boolean;
}

/**
 * Returns `true` when the current process runs inside a
 * runner-managed task (i.e. {@link HINTS_ENV} is set). Tools can gate
 * expensive hint computation — e.g. resolving a large set of ignore
 * paths — on this so they pay nothing when run standalone.
 */
const isManaged = (): boolean => Boolean(process.env[HINTS_ENV]);

/**
 * Returns the runner's advertised wire-protocol version, or `undefined`
 * when not running inside a runner (or an older runner that predates the
 * handshake). Compare against {@link SUPPORTED_PROTOCOL_VERSION} to
 * decide whether to emit ops a newer runner understands.
 */
const getProtocolVersion = (): string | undefined => process.env[PROTOCOL_ENV];

/**
 * Cache of hint payloads already written to the current hints file. The
 * runner aggregates idempotent ops (it pushes onto arrays / sets a flag),
 * so a tool that calls e.g. `getEnv("CI")` inside a per-file loop would
 * otherwise append thousands of identical lines for the runner to dedupe.
 *
 * Keyed on the serialized payload; reset whenever the hints file path
 * changes (a new task, or the var being toggled in tests) so the first
 * write to any given file is always durable.
 */
let emittedFor: string | undefined;
let emitted = new Set<string>();

/**
 * Appends one NDJSON line to the hints file. Synchronous + append-only so
 * the hint is durable the instant the call returns — even if the tool
 * crashes immediately after, the runner still sees every prior hint. A
 * hint must never break the user's task, so all failures are swallowed.
 *
 * Idempotent ops are de-duplicated per hints file: the first write of a
 * given payload is durable, repeats are free. The dedupe is skipped only
 * if the very first write fails, so a transient failure still retries.
 */
const emit = (message: Record<string, unknown>): void => {
    const file = process.env[HINTS_ENV];

    if (!file) {
        return;
    }

    if (emittedFor !== file) {
        emittedFor = file;
        emitted = new Set<string>();
    }

    const payload = JSON.stringify(message);

    if (emitted.has(payload)) {
        return;
    }

    try {
        appendFileSync(file, `${payload}\n`);
        emitted.add(payload);
    } catch {
        // Best-effort: a failed hint must never fail the task. Leave the
        // payload out of `emitted` so a later call can retry the write.
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
 * The path is resolved to absolute form against the *current* working
 * directory at the moment of the call, so a tool that called
 * `process.chdir()` still gets the root it means — instead of having the
 * runner re-resolve the raw string against the child's initial cwd.
 *
 * No-op when not running inside a runner.
 */
export const ignoreInput = (path: string): void => {
    emit({ op: "ignoreInput", path: resolve(path) });
};

/**
 * Tell the runner to ignore writes under `path` when inferring this run's
 * cache outputs — for scratch/temp files that aren't real build outputs.
 *
 * Resolved to absolute form against the current working directory at the
 * moment of the call (see {@link ignoreInput}).
 *
 * No-op when not running inside a runner.
 */
export const ignoreOutput = (path: string): void => {
    emit({ op: "ignoreOutput", path: resolve(path) });
};

/**
 * Tell the runner that `path` IS a cache input even though the tracer
 * couldn't observe the read — e.g. a file read by an untracked grandchild
 * process, or state the tracer can't see on platforms with weaker child
 * propagation (macOS/Windows). The additive counterpart to
 * {@link ignoreInput}.
 *
 * Resolved to absolute form against the current working directory.
 *
 * No-op when not running inside a runner.
 */
export const trackInput = (path: string): void => {
    emit({ op: "trackInput", path: resolve(path) });
};

/**
 * Tell the runner that `path` IS a cache output even though the tracer
 * couldn't observe the write. The additive counterpart to
 * {@link ignoreOutput}.
 *
 * Resolved to absolute form against the current working directory.
 *
 * No-op when not running inside a runner.
 */
export const trackOutput = (path: string): void => {
    emit({ op: "trackOutput", path: resolve(path) });
};

/**
 * Register a custom cache-key input: an arbitrary `key`/`value` pair that
 * participates in this run's fingerprint. For non-file, non-env
 * determinism inputs the tracer can never see — a DB schema revision, a
 * remote API version, a flag computed at runtime. Changing the `value`
 * for a `key` invalidates the cache entry; this is the precise
 * alternative to a blunt {@link disableCache}.
 *
 * No-op when not running inside a runner.
 */
export const trackValue = (key: string, value: string): void => {
    emit({ key, op: "trackValue", value });
};

/**
 * Tell the runner not to cache this run — for runs the tool knows are
 * non-deterministic (a network flake, debug mode, an aborted watch).
 *
 * Pass an optional `reason` to make "why did my cache stop hitting?"
 * debugging tractable; the runner may surface it in the run summary. The
 * field is ignored by runners that don't understand it, so it's
 * wire-safe.
 *
 * No-op when not running inside a runner.
 */
export const disableCache = (reason?: string): void => {
    emit(reason === undefined ? { op: "disableCache" } : { op: "disableCache", reason });
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
export const getEnv = (name: string, options?: TrackOptions): string | undefined => {
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
export const getEnvs = (pattern: string, options?: TrackOptions): Record<string, string> => {
    if (options?.tracked !== false) {
        emit({ op: "trackEnvPattern", pattern });
    }

    return matchEnv(pattern, process.env);
};

export { getProtocolVersion, HINTS_ENV, isManaged, PROTOCOL_ENV, SUPPORTED_PROTOCOL_VERSION };
export type { TrackOptions };
