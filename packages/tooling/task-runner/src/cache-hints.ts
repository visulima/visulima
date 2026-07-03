import { resolve } from "@visulima/path";

import type { FileAccess } from "./file-access-tracker";

/**
 * Environment variable the runner sets on a tracked child, pointing at
 * the per-task NDJSON hints file. The cooperative client
 * (`@visulima/task-runner-client`) appends one JSON line per call; when
 * the variable is absent every client call is a graceful no-op.
 */
export const HINTS_ENV = "TASK_RUNNER_HINTS";

/**
 * Environment variable carrying the wire-protocol version, so a future
 * client can degrade gracefully against an older runner (and vice
 * versa). Bump {@link HINTS_PROTOCOL_VERSION} on any breaking change to
 * the {@link Hint} shape.
 */
export const PROTOCOL_ENV = "TASK_RUNNER_PROTOCOL";

/** Current wire-protocol version. */
export const HINTS_PROTOCOL_VERSION = "1";

/**
 * A single cooperative cache hint emitted by a task during execution.
 *
 * The transport is an append-only NDJSON file — one object per line —
 * read by the runner after the child exits. Unknown `op` values are
 * skipped by {@link collectHints} so a newer client degrades gracefully
 * against an older runner.
 */
export type Hint
    = | { op: "disableCache" }
        | { op: "ignoreInput"; path: string }
        | { op: "ignoreOutput"; path: string }
        | { name: string; op: "trackEnv" }
        | { op: "trackEnvPattern"; pattern: string };

/**
 * Hints aggregated from a task's NDJSON file, with paths resolved to
 * absolute form against the child's cwd. Consumed by the orchestrator
 * to refine the auto-fingerprint before it's sealed.
 */
export interface CollectedHints {
    /** The task asked not to cache this run (via `disableCache()`). */
    cacheDisabled: boolean;
    /** Absolute paths whose reads should be dropped from inferred inputs. */
    ignoredInputs: string[];
    /** Absolute paths whose writes should be dropped from inferred outputs. */
    ignoredOutputs: string[];
    /** Env var names registered as cache dependencies via `getEnv`. */
    trackedEnv: string[];
    /** Env glob patterns registered as cache dependencies via `getEnvs`. */
    trackedEnvPatterns: string[];
}

/** An empty hint set — the result when no client ran or the file is absent. */
export const emptyHints = (): CollectedHints => {
    return {
        cacheDisabled: false,
        ignoredInputs: [],
        ignoredOutputs: [],
        trackedEnv: [],
        trackedEnvPatterns: [],
    };
};

/**
 * Normalises a path for prefix comparison. Strace/seccomp emit POSIX
 * paths and the Node preload emits native paths; collapsing back-slashes
 * lets the Windows preload path match hints regardless of separator.
 */
const normalize = (path: string): string => path.replaceAll("\\", "/");

/**
 * True when `path` is `root` itself or lives beneath it. Both arguments
 * must already be absolute + normalised.
 */
const isUnder = (path: string, root: string): boolean => path === root || path.startsWith(`${root}/`);

const isUnderAny = (path: string, roots: string[]): boolean => {
    const normalized = normalize(path);

    return roots.some((root) => isUnder(normalized, root));
};

/**
 * Parses a per-task NDJSON hints file into a {@link CollectedHints}
 * aggregate. Tolerant by design: blank lines, malformed JSON, and
 * unknown `op` values are skipped so a buggy or newer client can never
 * abort fingerprinting. Relative paths are resolved against `cwd` (the
 * child's working directory) to mirror how `file-access-tracker.ts`
 * resolves relative syscall paths.
 */
export const collectHints = (content: string, cwd: string): CollectedHints => {
    const hints = emptyHints();

    for (const line of content.split("\n")) {
        const trimmed = line.trim();

        if (!trimmed) {
            continue;
        }

        let hint: Hint;

        try {
            hint = JSON.parse(trimmed) as Hint;
        } catch {
            continue;
        }

        switch (hint.op) {
            case "disableCache": {
                hints.cacheDisabled = true;

                break;
            }
            case "ignoreInput": {
                if (typeof hint.path === "string" && hint.path) {
                    hints.ignoredInputs.push(normalize(resolve(cwd, hint.path)));
                }

                break;
            }
            case "ignoreOutput": {
                if (typeof hint.path === "string" && hint.path) {
                    hints.ignoredOutputs.push(normalize(resolve(cwd, hint.path)));
                }

                break;
            }
            case "trackEnv": {
                if (typeof hint.name === "string" && hint.name) {
                    hints.trackedEnv.push(hint.name);
                }

                break;
            }
            case "trackEnvPattern": {
                if (typeof hint.pattern === "string" && hint.pattern) {
                    hints.trackedEnvPatterns.push(hint.pattern);
                }

                break;
            }
            default: {
                // Unknown op from a newer client — skip.
                break;
            }
        }
    }

    return hints;
};

/**
 * Drops file accesses the task asked to ignore: `write` accesses under
 * any {@link CollectedHints.ignoredOutputs} root, and every other access
 * type under any {@link CollectedHints.ignoredInputs} root. Returns the
 * input array unchanged when there's nothing to ignore.
 */
export const applyAccessHints = (accesses: FileAccess[], hints: CollectedHints): FileAccess[] => {
    if (hints.ignoredInputs.length === 0 && hints.ignoredOutputs.length === 0) {
        return accesses;
    }

    return accesses.filter((access) => {
        if (access.type === "write") {
            return !isUnderAny(access.path, hints.ignoredOutputs);
        }

        return !isUnderAny(access.path, hints.ignoredInputs);
    });
};

/**
 * Distils a {@link CollectedHints} aggregate into the provenance object
 * attached to a `TaskResult` for `--summarize` — the four hint buckets
 * minus the behavioural `cacheDisabled` flag (which the orchestrator
 * already exposes as `TaskResult.cacheDisabledByTask`). Returns
 * `undefined` when the task registered no path/env hints, so the common
 * path leaves `TaskResult.cacheHints` unset.
 */
export const summarizeHints = (
    hints: CollectedHints,
): { ignoredInputs: string[]; ignoredOutputs: string[]; trackedEnv: string[]; trackedEnvPatterns: string[] } | undefined => {
    if (hints.ignoredInputs.length === 0 && hints.ignoredOutputs.length === 0 && hints.trackedEnv.length === 0 && hints.trackedEnvPatterns.length === 0) {
        return undefined;
    }

    return {
        ignoredInputs: hints.ignoredInputs,
        ignoredOutputs: hints.ignoredOutputs,
        trackedEnv: hints.trackedEnv,
        trackedEnvPatterns: hints.trackedEnvPatterns,
    };
};

/**
 * Combines the configured fingerprint env patterns with the per-run
 * patterns/names a task registered via `getEnv`/`getEnvs`. Returns the
 * base array unchanged when the task registered nothing, so the common
 * (no-cooperation) path allocates nothing extra.
 */
export const mergeEnvPatterns = (base: string[], hints: CollectedHints): string[] => {
    if (hints.trackedEnv.length === 0 && hints.trackedEnvPatterns.length === 0) {
        return base;
    }

    return [...base, ...hints.trackedEnv, ...hints.trackedEnvPatterns];
};
