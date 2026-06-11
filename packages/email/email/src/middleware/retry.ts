import type { EmailOptions, EmailResult, Result } from "../types";
import type { Middleware } from "./types";

const defaultSleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

/**
 * Options for the {@link retryMiddleware}.
 */
export interface RetryMiddlewareOptions {
    /**
     * The base backoff delay in milliseconds. Actual delays grow exponentially and are jittered.
     * @default 200
     */
    baseDelay?: number;

    /**
     * Called when all retries are exhausted — a dead-letter hook for durable storage/alerting.
     * @param options The message that ultimately failed.
     * @param result The final failed result.
     */
    onDeadLetter?: (options: EmailOptions, result: Result<EmailResult>) => Promise<void> | void;

    /**
     * Maximum number of attempts (including the first).
     * @default 3
     */
    retries?: number;

    /**
     * Decides whether a failed result is retryable. Defaults to retrying every failure.
     * @param result The failed result.
     */
    shouldRetry?: (result: Result<EmailResult>) => boolean;

    /**
     * Sleep implementation — injectable for tests. Defaults to `setTimeout`.
     * @param ms Milliseconds to wait.
     */
    sleep?: (ms: number) => Promise<void>;
}

/**
 * Retries failed sends with full-jitter exponential backoff, optionally dead-lettering the final
 * failure.
 *
 * Full jitter (`random(0, base * 2^attempt)`) avoids the thundering-herd retries a fixed schedule
 * causes.
 * @param options Retry configuration. See {@link RetryMiddlewareOptions}.
 * @returns A middleware that re-attempts failed sends before giving up.
 */
export const retryMiddleware = (options: RetryMiddlewareOptions = {}): Middleware => {
    const { baseDelay = 200, onDeadLetter, retries = 3, shouldRetry = () => true, sleep = defaultSleep } = options;

    return async (emailOptions, next) => {
        let lastResult: Result<EmailResult> = { error: new Error("retry middleware ran with retries < 1"), success: false };

        for (let attempt = 0; attempt < retries; attempt += 1) {
            // eslint-disable-next-line no-await-in-loop
            lastResult = await next(emailOptions);

            if (lastResult.success) {
                return lastResult;
            }

            if (!shouldRetry(lastResult) || attempt === retries - 1) {
                break;
            }

            // Full jitter: a random delay in [0, baseDelay * 2^attempt].
            const ceiling = baseDelay * 2 ** attempt;
            // eslint-disable-next-line sonarjs/pseudo-random
            const delay = Math.floor(Math.random() * ceiling);

            // eslint-disable-next-line no-await-in-loop
            await sleep(delay);
        }

        if (onDeadLetter) {
            await onDeadLetter(emailOptions, lastResult);
        }

        return lastResult;
    };
};
