import type { IncomingMessage, ServerResponse } from "node:http";

import type { NextHandler } from "@visulima/connect";
import createHttpError from "http-errors";
import type { NextApiResponse } from "next/types";
import type { RateLimiterAbstract, RateLimiterRes } from "rate-limiter-flexible";

type HeaderValue = ReadonlyArray<string> | number | string;

/**
 * Resolve the client IP for the rate-limit key.
 *
 * By default this uses the socket's `remoteAddress` only, because the
 * `X-Forwarded-For` / `X-Real-IP` headers are attacker-controlled — a direct
 * client can send a fresh forged value per request to bypass rate limiting
 * entirely and grow memory-backed limiter stores without bound.
 *
 * Set `trustProxy: true` (only when the app actually sits behind a trusted
 * reverse proxy that overwrites these headers) to honour the left-most entry of
 * `X-Forwarded-For`, falling back to `X-Real-IP`.
 */
const getIP = (request: IncomingMessage & { ip?: string }, trustProxy: boolean): string | undefined => {
    if (trustProxy) {
        const forwardedFor = request.headers["x-forwarded-for"];
        const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

        if (typeof forwarded === "string" && forwarded.length > 0) {
            // X-Forwarded-For is a comma-separated list; the client IP is the first hop.
            return forwarded.split(",")[0]?.trim();
        }

        const realIp = request.headers["x-real-ip"];

        if (typeof realIp === "string" && realIp.length > 0) {
            return realIp;
        }
    }

    // `request.ip` is populated by frameworks (e.g. Express) that have already
    // applied their own trusted-proxy resolution, so it is safe to prefer it.
    return request.ip ?? request.socket.remoteAddress;
};

interface RateLimiterMiddlewareOptions {
    /**
     * Build the rate-limit key from the request. Use this to limit by API key,
     * authenticated user id, etc. instead of by IP. Returning a stable,
     * non-spoofable value also closes the forged-`X-Forwarded-For` bypass.
     */
    keyGenerator?: (request: IncomingMessage & { ip?: string }) => string | undefined;

    /**
     * Emit the IETF draft `RateLimit-Limit` / `RateLimit-Remaining` /
     * `RateLimit-Reset` headers in addition to the legacy `X-RateLimit-*` ones.
     * @default false
     */
    standardHeaders?: boolean;

    /**
     * Trust the `X-Forwarded-For` / `X-Real-IP` headers when deriving the IP.
     * Only enable this behind a trusted reverse proxy. Ignored when a custom
     * `keyGenerator` is provided.
     * @default false
     */
    trustProxy?: boolean;
}

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- Request/Response generics flow into the returned function so callers retain their concrete types */
const rateLimiterMiddleware
    = (
        rateLimiter: RateLimiterAbstract,
        headers?: ((limiterResponse: RateLimiterRes) => Record<string, HeaderValue>) | RateLimiterMiddlewareOptions,
        options: RateLimiterMiddlewareOptions = {},
    ): <Request extends IncomingMessage, Response extends ServerResponse>(
        request: Request,
        response: NextApiResponse | Response,
        next: NextHandler,
    ) => Promise<void> => {
        // Backwards-compatible overload: the second argument used to be the
        // header callback. Support both `(limiter, headersFn)` and
        // `(limiter, headersFn, options)` plus `(limiter, options)`.
        let headersFunction: ((limiterResponse: RateLimiterRes) => Record<string, HeaderValue>) | undefined;
        let resolvedOptions: RateLimiterMiddlewareOptions;

        if (typeof headers === "function") {
            headersFunction = headers;
            resolvedOptions = options;
        } else {
            headersFunction = undefined;
            resolvedOptions = headers ?? options;
        }

        const { keyGenerator, standardHeaders = false, trustProxy = false } = resolvedOptions;

        return async <Request extends IncomingMessage, Response extends ServerResponse>(
            request: Request,
            response: NextApiResponse | Response,
            next: NextHandler,
        ): Promise<void> => {
            const key = keyGenerator ? keyGenerator(request) : getIP(request, trustProxy);

            if (key === undefined || key === "") {
                throw createHttpError(400, "Missing IP");
            }

            let limiter: RateLimiterRes;

            try {
                limiter = await rateLimiter.consume(key);
            } catch {
                throw createHttpError(429, "Too Many Requests");
            }

            const resetSeconds = Math.round(limiter.msBeforeNext / 1000) || 1;

            const mergedHeaders: Record<string, HeaderValue> = {
                "Retry-After": resetSeconds,
                "X-RateLimit-Remaining": limiter.remainingPoints,
                "X-RateLimit-Reset": new Date(Date.now() + limiter.msBeforeNext).toISOString(),
            };

            if (standardHeaders) {
                // IETF draft "RateLimit header fields for HTTP" (draft-ietf-httpapi-ratelimit-headers).
                mergedHeaders["RateLimit-Remaining"] = limiter.remainingPoints;
                mergedHeaders["RateLimit-Reset"] = resetSeconds;

                const limit = limiter.remainingPoints + limiter.consumedPoints;

                if (Number.isFinite(limit)) {
                    mergedHeaders["RateLimit-Limit"] = limit;
                }
            }

            if (typeof headersFunction === "function") {
                Object.assign(mergedHeaders, headersFunction(limiter));
            }

            Object.keys(mergedHeaders).forEach((headerKey) => {
                response.setHeader(headerKey, mergedHeaders[headerKey] as HeaderValue);
            });

            // `next()` is intentionally called outside the consume try/catch:
            // a downstream handler throwing (e.g. a genuine NotFound) must not
            // be reported to the client as "429 Too Many Requests".
            await next();
        };
    };
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

export type { RateLimiterMiddlewareOptions };
export default rateLimiterMiddleware;
