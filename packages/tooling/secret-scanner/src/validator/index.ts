// Top-level `validateFinding` entry — the pipeline's only external call into
// the validator surface. Dispatches by `validation.type`:
//
//   - `"HttpMultiStep"`   → always skipped (only used in `revocation:` blocks)
//   - `"Http"`            → built-in fetch-based validator (`./http`)
//   - registered transport → dynamic-import peer dep + run (`../transports`)
//   - otherwise           → skipped
//
// JWT is registered in `../transports` so it flows through the same lookup —
// one dispatch table, no special cases.
//
// Template rendering and concurrency primitives are re-exported from this
// barrel so existing callers (`src/pipeline.ts`, tests) only import the
// validator package.

import { lookupTransport, runTransport } from "../transports";
import type { ValidationStatus } from "../types";
import { runHttpValidation } from "./http";
import type { PerHostLimiter } from "./per-host-limiter";

const asObject = (value: unknown): Record<string, unknown> | undefined => {
    if (typeof value === "object" && value !== null) {
        return value as Record<string, unknown>;
    }

    return undefined;
};

/** Optional knobs for {@link validateFinding}. */
export interface ValidateFindingOptions {
    /**
     * Host allowlist for HTTP validators. When set, a rendered request whose
     * host is not in the set is skipped without firing — closes the
     * untrusted-config secret-exfiltration channel.
     */
    allowedHosts?: ReadonlySet<string>;
    /** `depends_on_rule`-injected template vars (e.g. `AKID` from `aws.1`). */
    extraVariables?: Record<string, string>;
    /** Per-authority outbound-HTTP gate shared across the validation pool. */
    perHostLimiter?: PerHostLimiter;
    /** Abort signal — propagated to the underlying `fetch()`. */
    signal?: AbortSignal;
}

/**
 * Evaluate a single rule's validation block against the candidate secret.
 * Returns a terminal `ValidationStatus`.
 *
 * `extraVariables` carries `depends_on_rule`-injected template vars (e.g.
 * `AKID` from `aws.1` when validating `aws.2`). `perHostLimiter`, when
 * supplied, gates outbound HTTP by authority. `allowedHosts`, when supplied,
 * restricts which hosts an HTTP validator may contact.
 *
 * Two call forms are accepted: the options-object form
 * `validateFinding(block, secret, { signal, extraVariables, perHostLimiter, allowedHosts })`,
 * and the legacy positional form
 * `validateFinding(block, secret, signal, extraVariables, perHostLimiter)`.
 */
export async function validateFinding(ruleValidation: unknown, secret: string, options?: ValidateFindingOptions): Promise<ValidationStatus>;
export async function validateFinding(
    ruleValidation: unknown,
    secret: string,
    signal?: AbortSignal,
    extraVariables?: Record<string, string>,
    perHostLimiter?: PerHostLimiter,
): Promise<ValidationStatus>;
export async function validateFinding(
    ruleValidation: unknown,
    secret: string,
    optionsOrSignal?: AbortSignal | ValidateFindingOptions,
    legacyExtraVariables?: Record<string, string>,
    legacyPerHostLimiter?: PerHostLimiter,
): Promise<ValidationStatus> {
    let options: ValidateFindingOptions;

    if (optionsOrSignal instanceof AbortSignal) {
        options = { extraVariables: legacyExtraVariables, perHostLimiter: legacyPerHostLimiter, signal: optionsOrSignal };
    } else if (optionsOrSignal === undefined && (legacyExtraVariables !== undefined || legacyPerHostLimiter !== undefined)) {
        // Legacy positional call with an explicit `undefined` signal slot.
        options = { extraVariables: legacyExtraVariables, perHostLimiter: legacyPerHostLimiter };
    } else {
        options = optionsOrSignal ?? {};
    }

    const { allowedHosts, extraVariables = {}, perHostLimiter, signal } = options;
    const validation = asObject(ruleValidation);

    if (!validation) {
        return "skipped";
    }

    const { type } = validation;

    if (type === "HttpMultiStep") {
        // Kingfisher only uses HttpMultiStep in upstream `revocation:` blocks
        // — revocation is destructive (DELETE tokens, rotate keys) and
        // deliberately out of scope for a scanner. Guard explicitly so a
        // future upstream rule migrating to HttpMultiStep validation gets
        // `"skipped"` not a crash.
        return "skipped";
    }

    if (type === "Http") {
        return runHttpValidation({
            allowedHosts,
            extraVariables,
            perHostLimiter,
            secret,
            signal,
            validation,
        });
    }

    if (typeof type === "string" && lookupTransport(type)) {
        return runTransport(type, {
            allowedHosts,
            extras: extraVariables,
            secret,
            signal,
            validation,
        });
    }

    return "skipped";
}

export type { ValidationStatus } from "../types";
export { ConcurrencyLimiter } from "./concurrency";
export { PerHostLimiter } from "./per-host-limiter";
export { renderTemplate } from "./template";
