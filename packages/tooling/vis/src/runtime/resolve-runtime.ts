/**
 * `resolveRuntime` — picks the JS runtime (node | bun) for a given directory.
 *
 * The keystone of the cross-runtime multi-tool (see
 * `rfc/design-runtime-multitool.md`). Mirrors the existing `resolveInstaller`
 * pattern, generalized from "which PM" to "which runtime". Intentionally
 * native-free (pure fs + path) so detection is testable without the `#native`
 * binding and adds no cold-start cost.
 *
 * Precedence (highest first):
 *   1. explicit `--runtime` flag
 *   2. `VIS_RUNTIME` env var
 *   3. `runtime:` in vis config
 *   4. lockfile walk (bun.lock(b) → bun; npm/pnpm/yarn → node)
 *   5. default → node   (zero regression for existing users)
 *
 * Deno is deferred: an explicit request (flag/env/config) hard-errors with a
 * pointer to the RFC; a detected `deno.lock` returns node + a `deferredNotice`
 * the caller should surface (an explicit "not yet" rather than a silent fallback).
 */
import { isAccessibleSync } from "@visulima/fs";
import { dirname, join, parse as parsePath } from "@visulima/path";

import { bunAdapter } from "./adapters/bun";
import { nodeAdapter } from "./adapters/node";
import type { RuntimeAdapter, RuntimeId } from "./adapters/types";

const ADAPTERS: Readonly<Record<RuntimeId, RuntimeAdapter>> = {
    bun: bunAdapter,
    node: nodeAdapter,
};

const SUPPORTED: ReadonlyArray<RuntimeId> = ["node", "bun"];

/**
 * Lockfiles that map to a runtime vis can't target yet. Detecting one is an
 * explicit "not yet supported" rather than a silent fall-through to node.
 */
const DEFERRED_LOCKFILES: Readonly<Record<string, string>> = {
    "deno.lock": "deno",
};

/** Lockfile → runtime, built from each adapter's declared lockfiles. */
const LOCKFILE_RUNTIME: ReadonlyArray<readonly [string, RuntimeId]> = SUPPORTED.flatMap((id) =>
    ADAPTERS[id].lockfiles.map((file) => [file, id] as const),
);

const DEFERRED_HINT = "Deno is not supported yet (deferred — see rfc/design-runtime-multitool.md).";

export type RuntimeSource = "config" | "default" | "env" | "flag" | "lockfile";

export interface RuntimeResolution {
    /** The resolved adapter. */
    adapter: RuntimeAdapter;

    /**
     * Set when a deferred runtime (e.g. Deno) was *detected* (not explicitly
     * requested). The caller should warn; resolution falls back to node.
     */
    deferredNotice?: string;
    /** The chosen runtime id. */
    runtime: RuntimeId;
    /** Which precedence rule decided it (for `--why` / diagnostics). */
    source: RuntimeSource;
}

export interface ResolveRuntimeOverride {
    /** From `vis.config.ts` `runtime:`. */
    config?: RuntimeId;
    /** Injectable for tests; defaults to `process.env`. */
    env?: NodeJS.ProcessEnv;
    /** From the `--runtime` CLI flag (raw string). */
    flag?: string;
}

/** Look up the adapter for a known runtime id. */
export const getRuntimeAdapter = (id: RuntimeId): RuntimeAdapter => ADAPTERS[id];

/** Parse an explicit runtime request, hard-erroring on unknown/deferred values. */
const parseExplicit = (value: string, origin: string): RuntimeId => {
    if (value === "node" || value === "bun") {
        return value;
    }

    if (value in DEFERRED_LOCKFILES || value === "deno") {
        throw new Error(`${origin} requested runtime "${value}", but ${DEFERRED_HINT}`);
    }

    throw new Error(`${origin} requested unknown runtime "${value}". Supported: ${SUPPORTED.join(", ")}.`);
};

/**
 * Walk up from `cwd` looking for a lockfile. Returns the matched runtime, or a
 * deferred marker, or undefined if none found before the filesystem root.
 */
const detectFromLockfile = (cwd: string): { deferred?: string; runtime?: RuntimeId } => {
    let dir = cwd;

    for (;;) {
        for (const [file, runtime] of LOCKFILE_RUNTIME) {
            if (isAccessibleSync(join(dir, file))) {
                return { runtime };
            }
        }

        for (const file of Object.keys(DEFERRED_LOCKFILES)) {
            if (isAccessibleSync(join(dir, file))) {
                return { deferred: DEFERRED_LOCKFILES[file] };
            }
        }

        const parent = dirname(dir);

        if (parent === dir || parsePath(dir).root === dir) {
            return {};
        }

        dir = parent;
    }
};

export const resolveRuntime = (cwd: string, override: ResolveRuntimeOverride = {}): RuntimeResolution => {
    const env = override.env ?? process.env;

    const make = (runtime: RuntimeId, source: RuntimeSource, deferredNotice?: string): RuntimeResolution => {
        return {
            adapter: ADAPTERS[runtime],
            deferredNotice,
            runtime,
            source,
        };
    };

    if (override.flag !== undefined && override.flag !== "") {
        return make(parseExplicit(override.flag, "--runtime"), "flag");
    }

    const fromEnv = env.VIS_RUNTIME;

    if (fromEnv !== undefined && fromEnv !== "") {
        return make(parseExplicit(fromEnv, "VIS_RUNTIME"), "env");
    }

    if (override.config !== undefined) {
        return make(parseExplicit(override.config, "config runtime:"), "config");
    }

    const detected = detectFromLockfile(cwd);

    if (detected.runtime !== undefined) {
        return make(detected.runtime, "lockfile");
    }

    if (detected.deferred !== undefined) {
        return make(
            "node",
            "default",
            `Detected a ${detected.deferred} project but ${DEFERRED_HINT} Falling back to node.`,
        );
    }

    return make("node", "default");
};
