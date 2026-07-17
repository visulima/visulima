import EmailError from "../errors/email-error";
import type { Result } from "../types";
import { REQUEST_TIMEOUT_CODE } from "./make-request";

/**
 * Status codes that are safe to repeat: the server answered without acting on the request, so a
 * second attempt cannot duplicate its effect.
 *
 * - `408` — the server gave up waiting for the request body, so it never processed one.
 * - `429` — rate limited; the request was rejected outright.
 * - `503` — the server is not accepting work at all.
 *
 * Other 5xx codes are deliberately absent. A `500`, `502` or `504` can be raised *after* the
 * server has already acted, so repeating a non-idempotent send risks a duplicate.
 */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 503]);

/**
 * Decides whether a failed {@link Result} is worth another attempt.
 *
 * The send endpoints behind these providers take no idempotency key, so a retry is only safe when
 * the request provably had no effect. That splits failures three ways.
 *
 * When the server answered, its status code settles it — see {@link RETRYABLE_STATUS_CODES}. A 4xx
 * is a rejection a retry would only reproduce, and an ambiguous 5xx may already have sent.
 *
 * When the request timed out, the server may have received and acted on it, so it is left alone.
 *
 * Anything else — a refused connection, a DNS failure, a caller that is not HTTP at all — never
 * reached a server, so retrying is both safe and useful.
 * @param result The failed result to classify.
 * @returns Whether the call may be repeated.
 */
const isRetryableResult = (result: Result): boolean => {
    const { statusCode } = (result.data ?? {}) as { statusCode?: number };

    if (statusCode !== undefined) {
        return RETRYABLE_STATUS_CODES.has(statusCode);
    }

    return !(result.error instanceof EmailError && result.error.code === REQUEST_TIMEOUT_CODE);
};

export default isRetryableResult;
