import type { Middleware } from "./types";

const sleep = async (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

export interface RateLimitMiddlewareOptions {
    /** Time window in ms over which `rate` tokens are available (default 1000). */
    interval?: number;
    /** Number of sends allowed per `interval` (token bucket capacity). */
    rate: number;
}

/**
 * Throttles sends with a token-bucket rate limiter.
 * @param options Bucket `rate` (capacity) and refill `interval` (ms).
 * @returns A middleware.
 */
export const rateLimitMiddleware = (options: RateLimitMiddlewareOptions): Middleware => {
    const interval = options.interval ?? 1000;
    const capacity = Math.max(1, options.rate);
    let tokens = capacity;
    let last = Date.now();

    const refill = (): void => {
        const now = Date.now();
        const elapsed = now - last;

        tokens = Math.min(capacity, tokens + (elapsed / interval) * capacity);
        last = now;
    };

    return async (context, next) => {
        refill();

        while (tokens < 1) {
            // eslint-disable-next-line no-await-in-loop
            await sleep(Math.ceil(interval / capacity));
            refill();
        }

        tokens -= 1;

        return next(context);
    };
};
