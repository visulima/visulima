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
 */
import { isAccessibleSync } from "@visulima/fs";
import { dirname, join, parse as parsePath } from "@visulima/path";

import { bunAdapter } from "./adapters/bun";
import { nodeAdapter } from "./adapters/node";
import type { RuntimeAdapter, RuntimeId } from "./adapters/types";
import { isRuntimeId, RUNTIME_IDS } from "./adapters/types";

const ADAPTERS: Readonly<Record<RuntimeId, RuntimeAdapter>> = {
    bun: bunAdapter,
    node: nodeAdapter,
};

const SUPPORTED: ReadonlyArray<RuntimeId> = RUNTIME_IDS;

/** Lockfile → runtime, built from each adapter's declared lockfiles. */
const LOCKFILE_RUNTIME: ReadonlyArray<readonly [string, RuntimeId]> = SUPPORTED.flatMap((id) => ADAPTERS[id].lockfiles.map((file) => [file, id] as const));

export type RuntimeSource = "config" | "default" | "env" | "flag" | "lockfile";

export interface RuntimeResolution {
    /** The resolved adapter. */
    adapter: RuntimeAdapter;
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

/** Parse an explicit runtime request, hard-erroring on unknown values. */
const parseExplicit = (value: string, origin: string): RuntimeId => {
    if (isRuntimeId(value)) {
        return value;
    }

    throw new Error(`${origin} requested unknown runtime "${value}". Supported: ${SUPPORTED.join(", ")}.`);
};

/**
 * Walk up from `cwd` looking for a lockfile. Returns the matched runtime, or
 * undefined if none found before the filesystem root.
 */
const detectFromLockfile = (cwd: string): RuntimeId | undefined => {
    let dir = cwd;

    for (;;) {
        for (const [file, runtime] of LOCKFILE_RUNTIME) {
            if (isAccessibleSync(join(dir, file))) {
                return runtime;
            }
        }

        const parent = dirname(dir);

        if (parent === dir || parsePath(dir).root === dir) {
            return undefined;
        }

        dir = parent;
    }
};

export const resolveRuntime = (cwd: string, override: ResolveRuntimeOverride = {}): RuntimeResolution => {
    const env = override.env ?? process.env;

    const make = (runtime: RuntimeId, source: RuntimeSource): RuntimeResolution => {
        return {
            adapter: ADAPTERS[runtime],
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

    if (detected !== undefined) {
        return make(detected, "lockfile");
    }

    return make("node", "default");
};
