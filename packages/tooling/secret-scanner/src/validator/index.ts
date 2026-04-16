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

/**
 * Evaluate a single rule's validation block against the candidate secret.
 * Returns a terminal `ValidationStatus`.
 *
 * `extraVariables` carries `depends_on_rule`-injected template vars (e.g.
 * `AKID` from `aws.1` when validating `aws.2`). `perHostLimiter`, when
 * supplied, gates outbound HTTP by authority.
 */
export const validateFinding = async (
    ruleValidation: unknown,
    secret: string,
    signal?: AbortSignal,
    extraVariables: Record<string, string> = {},
    perHostLimiter?: PerHostLimiter,
): Promise<ValidationStatus> => {
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
            extraVariables,
            perHostLimiter,
            secret,
            signal,
            validation,
        });
    }

    if (typeof type === "string" && lookupTransport(type)) {
        return runTransport(type, {
            extras: extraVariables,
            secret,
            validation,
        });
    }

    return "skipped";
};

export type { ValidationStatus } from "../types";
export { ConcurrencyLimiter } from "./concurrency";
export { PerHostLimiter } from "./per-host-limiter";
export { renderTemplate } from "./template";
