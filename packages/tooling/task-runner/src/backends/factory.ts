import { HttpRemoteCache } from "./http";
import { ReapiRemoteCache } from "./reapi";
import type { CacheMode, RemoteCacheBackend, RemoteCacheOptions } from "./types";

/**
 * Resolves the canonical {@link CacheMode}. `mode` defaults to
 * `"readwrite"` when unset — the safe choice for CI and the most
 * common config in dev. Kept as a separate helper so vis-side code
 * (CLI flag merge, doctor probes) can reuse the resolution rule.
 */
export const resolveCacheMode = (options: { mode?: CacheMode }): CacheMode => options.mode ?? "readwrite";

/**
 * Fill missing HTTP-backend fields from Turborepo's environment
 * variables so a workspace migrating from Turbo can keep its existing
 * CI secrets:
 *
 * - `TURBO_API`   → `url`
 * - `TURBO_TOKEN` → `token`
 * - `TURBO_TEAM`  → `teamId`
 *
 * Explicit values in `input` always win. Returns `undefined` when
 * neither config nor env supplies a URL, which is the signal callers
 * use to mean "no remote cache configured." REAPI users are unaffected
 * — the env vars are Turborepo-shaped and only resolve `http` fields.
 */
export const resolveTurboEnvCompat = (
    input?: Partial<RemoteCacheOptions>,
    env: NodeJS.ProcessEnv = process.env,
): RemoteCacheOptions | undefined => {
    const backend = input?.backend ?? "http";

    if (backend !== "http") {
        return input?.url ? (input as RemoteCacheOptions) : undefined;
    }

    const url = input?.url ?? env["TURBO_API"];

    if (!url) {
        return undefined;
    }

    return {
        ...input,
        teamId: input?.teamId ?? env["TURBO_TEAM"],
        token: input?.token ?? env["TURBO_TOKEN"],
        url,
    };
};

/**
 * Construct the configured remote cache backend. Selects between the
 * Turborepo-compatible HTTP client and the Bazel REAPI gRPC client
 * via `options.backend`.
 */
export const createRemoteCacheBackend = (options: RemoteCacheOptions): RemoteCacheBackend => {
    const mode = resolveCacheMode(options);
    const resolved: RemoteCacheOptions = { ...options, mode };

    switch (options.backend ?? "http") {
        case "http": {
            return new HttpRemoteCache(resolved);
        }

        case "reapi": {
            return new ReapiRemoteCache(resolved);
        }

        default: {
            return new HttpRemoteCache(resolved);
        }
    }
};
