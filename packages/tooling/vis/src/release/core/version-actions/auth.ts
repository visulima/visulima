/**
 * Shared trusted-publishing (OIDC) vs static-token precedence.
 *
 * python (`TWINE_PASSWORD`), cargo (`CARGO_REGISTRY_TOKEN`) and jsr
 * (`JSR_API_KEY`) all resolved the exact same decision independently; the
 * only thing that varied was the static-token env-var name. The invariant
 * was being maintained by cross-referencing comments ("aligned with cargo.ts /
 * python.ts") rather than by shared code — a drift hazard. This module is the
 * single source of truth.
 *
 * Not used by native-addon: that adapter performs the npm OIDC token exchange
 * itself (async) and has no `preferStaticToken` escape hatch, so it has a
 * genuinely different shape.
 */
import type { VisReleaseConfig } from "../../types";

/** GitHub Actions CI signal that `permissions: id-token: write` was granted. */
const OIDC_ENV_SIGNAL = "ACTIONS_ID_TOKEN_REQUEST_URL";

export type AuthMode = "missing" | "oidc" | "token";

export interface ResolveAuthModeOptions {
    /** Process env to read the OIDC + static-token signals from. */
    env: NodeJS.ProcessEnv;
    /** Registry-specific static-token env var (e.g. `TWINE_PASSWORD`). */
    staticTokenVar: string;
    /** Workspace config — read for the `publish.preferStaticToken` escape hatch. */
    workspaceConfig?: VisReleaseConfig;
}

/**
 * Resolve which credential path a trusted-publishing adapter should take,
 * without performing any token exchange.
 *
 * Precedence:
 *   - OIDC wins whenever the `ACTIONS_ID_TOKEN_REQUEST_URL` env signal is
 *     present — a leftover static token in the env is more likely stale than
 *     an explicit downgrade.
 *   - Escape hatch: `release.publish.preferStaticToken: true` flips that, so a
 *     present static token wins over OIDC (useful when migrating auth modes).
 *   - Neither signal → `"missing"`, so the caller's `AUTH_MISSING` gate fires
 *     early rather than as a confusing 403 mid-upload.
 * @param options resolution inputs.
 * @returns `"oidc"`, `"token"`, or `"missing"`.
 */
export const resolveAuthMode = (options: ResolveAuthModeOptions): AuthMode => {
    const hasOidc = Boolean(options.env[OIDC_ENV_SIGNAL]);
    const hasStatic = Boolean(options.env[options.staticTokenVar]);
    const preferStatic = options.workspaceConfig?.publish?.preferStaticToken === true;

    if (hasOidc && !(preferStatic && hasStatic)) {
        return "oidc";
    }

    if (hasStatic) {
        return "token";
    }

    return "missing";
};

/**
 * Convenience predicate for adapters that only need a yes/no on OIDC.
 * Equivalent to `resolveAuthMode(options) === "oidc"`.
 * @param options resolution inputs.
 * @returns true when OIDC trusted publishing should be used.
 */
export const shouldUseTrustedPublishing = (options: ResolveAuthModeOptions): boolean => resolveAuthMode(options) === "oidc";
