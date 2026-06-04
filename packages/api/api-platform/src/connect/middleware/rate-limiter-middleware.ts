import type { IncomingMessage, ServerResponse } from "node:http";

import type { NextHandler } from "@visulima/connect";
import createHttpError from "http-errors";
import type { NextApiResponse } from "next/types";
import type { RateLimiterAbstract, RateLimiterRes } from "rate-limiter-flexible";

const getIP: (request: IncomingMessage & { ip?: string }) => string | undefined = (request) =>
    request.ip
    ?? (request.headers["x-forwarded-for"] as string | undefined)
    ?? (request.headers["x-real-ip"] as string | undefined)
    ?? request.socket.remoteAddress;

type HeaderValue = ReadonlyArray<string> | number | string;

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- Request/Response generics flow into the returned function so callers retain their concrete types */
const rateLimiterMiddleware
    = (
        rateLimiter: RateLimiterAbstract,
        headers?: (limiterResponse: RateLimiterRes) => Record<string, HeaderValue>,
    ): <Request extends IncomingMessage, Response extends ServerResponse>(
        request: Request,
        response: NextApiResponse | Response,
        next: NextHandler,
    ) => Promise<void> =>
        async <Request extends IncomingMessage, Response extends ServerResponse>(
            request: Request,
            response: NextApiResponse | Response,
            next: NextHandler,
        ): Promise<void> => {
            const ip = getIP(request);

            if (ip === undefined) {
                throw createHttpError(400, "Missing IP");
            }

            try {
                const limiter = await rateLimiter.consume(ip);

                const mergedHeaders: Record<string, HeaderValue> = {
                    "Retry-After": Math.round(limiter.msBeforeNext / 1000) || 1,
                    "X-RateLimit-Remaining": limiter.remainingPoints,
                    "X-RateLimit-Reset": new Date(Date.now() + limiter.msBeforeNext).toISOString(),
                    ...(typeof headers === "function" ? headers(limiter) : {}),
                };

                Object.keys(mergedHeaders).forEach((key) => {
                    response.setHeader(key, mergedHeaders[key] as HeaderValue);
                });

                await next();
            } catch {
                throw createHttpError(429, "Too Many Requests");
            }
        };
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

export default rateLimiterMiddleware;
