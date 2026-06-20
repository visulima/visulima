import NotificationError from "../errors/notification-error";
import type { Middleware } from "./types";

type CircuitState = "closed" | "half-open" | "open";

export interface CircuitBreakerMiddlewareOptions {
    /** Time in ms the circuit stays open before a trial request (default 30000). */
    resetTimeout?: number;
    /** Consecutive failures before the circuit opens (default 5). */
    threshold?: number;
}

/**
 * Trips a circuit after consecutive failures, short-circuiting further sends until a
 * cool-off elapses (then allows a single trial request).
 * @param options Failure `threshold` and open-circuit `resetTimeout` (ms).
 * @returns A middleware.
 */
export const circuitBreakerMiddleware = (options: CircuitBreakerMiddlewareOptions = {}): Middleware => {
    const threshold = options.threshold ?? 5;
    const resetTimeout = options.resetTimeout ?? 30_000;

    let failures = 0;
    let openedAt = 0;
    let state: CircuitState = "closed";

    return async (context, next) => {
        if (state === "open") {
            if (Date.now() - openedAt >= resetTimeout) {
                state = "half-open";
            } else {
                return { error: new NotificationError("circuit-breaker", `Circuit open for "${context.provider}"`), success: false };
            }
        }

        const result = await next(context);

        if (result.success) {
            failures = 0;
            state = "closed";
        } else {
            failures += 1;

            if (failures >= threshold) {
                state = "open";
                openedAt = Date.now();
            }
        }

        return result;
    };
};
