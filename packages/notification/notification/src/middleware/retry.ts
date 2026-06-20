import type { Middleware } from "./types";

const sleep = async (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

export interface RetryMiddlewareOptions {
    /** Base backoff delay in ms (default 250). */
    baseDelay?: number;
    /** Maximum retry attempts after the first try (default 3). */
    retries?: number;
    /** Decide whether a failed result is retryable (default: always retry). */
    shouldRetry?: (error: unknown) => boolean;
}

/**
 * Retries failed sends with exponential backoff + jitter.
 * @param options Attempt count (`retries`), `baseDelay` (ms) and a `shouldRetry` predicate.
 * @returns A middleware.
 */
export const retryMiddleware = (options: RetryMiddlewareOptions = {}): Middleware => {
    const retries = options.retries ?? 3;
    const baseDelay = options.baseDelay ?? 250;

    return async (context, next) => {
        let last = await next(context);

        for (let attempt = 0; attempt < retries && !last.success; attempt += 1) {
            if (options.shouldRetry && !options.shouldRetry(last.error)) {
                break;
            }

            // eslint-disable-next-line no-await-in-loop,sonarjs/pseudo-random
            await sleep(baseDelay * 2 ** attempt + Math.floor(Math.random() * baseDelay));
            // eslint-disable-next-line no-await-in-loop
            last = await next(context);
        }

        return last;
    };
};
