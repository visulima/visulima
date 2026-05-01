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
