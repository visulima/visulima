import { NextHandler } from "@visulima/connect";
import createHttpError from "http-errors";
import { NextApiResponse } from "next";
import { IncomingMessage, ServerResponse } from "node:http";
import { RateLimiterAbstract, RateLimiterRes } from "rate-limiter-flexible";

// eslint-disable-next-line max-len
const getIP: (request: IncomingMessage & { ip?: string }) => string | undefined = (request) => request?.ip
    || (request.headers["x-forwarded-for"] as string | undefined)
    || (request.headers["x-real-ip"] as string | undefined)
    || request.connection.remoteAddress;

type HeaderValue = string | number | ReadonlyArray<string>;

// eslint-disable-next-line max-len
const rateLimiterMiddleware = (rateLimiter: RateLimiterAbstract, headers?: (limiterResponse: RateLimiterRes) => { [key: string]: HeaderValue }) => async <Request extends IncomingMessage, Response extends ServerResponse>(request: Request, response: Response | NextApiResponse, next: NextHandler) => {
    const ip = getIP(request);

    if (typeof ip === "undefined") {
        throw createHttpError(400, "Missing IP");
    }

    try {
        const limiter = await rateLimiter.consume(ip);

        const mergedHeaders: { [key: string]: HeaderValue } = {
            "Retry-After": Math.round(limiter.msBeforeNext / 1000) || 1,
            "X-RateLimit-Remaining": limiter.remainingPoints,
            "X-RateLimit-Reset": new Date(Date.now() + limiter.msBeforeNext).toISOString(),
            ...headers,
        };

        Object.keys(mergedHeaders).forEach((key) => {
            response.setHeader(key, mergedHeaders[key] as HeaderValue);
        });

        await next();
    } catch {
        throw createHttpError(429, "Too Many Requests");
    }
};

export default rateLimiterMiddleware;
