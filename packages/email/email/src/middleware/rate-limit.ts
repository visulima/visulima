import type { Middleware } from "./types";

const defaultSleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

/**
 * Options for the {@link rateLimitMiddleware}.
 */
export interface RateLimitMiddlewareOptions {
    /**
     * Maximum burst capacity (tokens). Defaults to {@link RateLimitMiddlewareOptions.rate}.
     */
    burst?: number;

    /**
     * Time source in milliseconds — injectable for tests. Defaults to `Date.now`.
     */
    now?: () => number;

    /**
     * Sustained send rate, in messages per second.
     */
    rate: number;

    /**
     * Sleep implementation — injectable for tests. Defaults to `setTimeout`.
     * @param ms Milliseconds to wait.
     */
    sleep?: (ms: number) => Promise<void>;
}

/**
 * Pre-tuned per-second rate presets for common providers' default plans. Override as needed for your
 * own quota.
 */
export const RATE_LIMIT_PRESETS = {
    "aws-ses": 14,
    mailgun: 100,
    postmark: 100,
    resend: 10,
    sendgrid: 100,
} as const;

/**
 * Throttles sends with a token-bucket limiter, awaiting capacity rather than failing when the rate is
 * exceeded.
 * @param options Rate configuration. See {@link RateLimitMiddlewareOptions} and {@link RATE_LIMIT_PRESETS}.
 * @returns A middleware that paces sends to the configured rate.
 */
export const rateLimitMiddleware = (options: RateLimitMiddlewareOptions): Middleware => {
    const { burst, now = Date.now, rate, sleep = defaultSleep } = options;

    if (rate <= 0 || Number.isNaN(rate)) {
        // A non-positive rate would make the token bucket never refill, spinning the acquire loop forever.
        throw new TypeError("rateLimitMiddleware: `rate` must be a positive number");
    }

    const capacity = burst ?? rate;

    let tokens = capacity;
    let lastRefill = now();
    // Serializes token acquisition so concurrent sends don't all read the same token count.
    let queue: Promise<void> = Promise.resolve();

    const acquire = async (): Promise<void> => {
        const refill = (): void => {
            const current = now();
            const elapsed = (current - lastRefill) / 1000;

            tokens = Math.min(capacity, tokens + elapsed * rate);
            lastRefill = current;
        };

        refill();

        while (tokens < 1) {
            const deficit = 1 - tokens;

            // eslint-disable-next-line no-await-in-loop
            await sleep(Math.ceil((deficit / rate) * 1000));
            refill();
        }

        tokens -= 1;
    };

    return async (emailOptions, next) => {
        const ticket = queue.then(() => acquire());

        queue = ticket.catch(() => undefined);

        await ticket;

        return next(emailOptions);
    };
};
