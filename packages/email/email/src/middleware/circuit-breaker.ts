import EmailError from "../errors/email-error";
import type { Middleware } from "./types";

/**
 * The state of a {@link circuitBreakerMiddleware}.
 *
 * `closed` = healthy; `open` = failing fast; `half-open` = trialing one request to test recovery.
 */
export type CircuitState = "closed" | "half-open" | "open";

/**
 * Options for the {@link circuitBreakerMiddleware}.
 */
export interface CircuitBreakerMiddlewareOptions {
    /**
     * Consecutive failures before the circuit opens.
     * @default 5
     */
    failureThreshold?: number;

    /**
     * Time source in milliseconds — injectable for tests. Defaults to `Date.now`.
     */
    now?: () => number;

    /**
     * Notified whenever the circuit changes state.
     * @param state The new state.
     */
    onStateChange?: (state: CircuitState) => void;

    /**
     * How long, in milliseconds, the circuit stays open before allowing a half-open trial.
     * @default 30000
     */
    resetTimeout?: number;
}

/**
 * Trips a circuit after repeated provider failures, failing fast while open and trialing recovery via
 * a half-open state — protecting a struggling provider from being hammered.
 * @param options Breaker configuration. See {@link CircuitBreakerMiddlewareOptions}.
 * @returns A middleware that fails fast while the provider is unhealthy.
 */
export const circuitBreakerMiddleware = (options: CircuitBreakerMiddlewareOptions = {}): Middleware => {
    const { failureThreshold = 5, now = Date.now, onStateChange, resetTimeout = 30_000 } = options;

    let state: CircuitState = "closed";
    let failures = 0;
    let openedAt = 0;
    // True while a single half-open trial request is in flight.
    let probing = false;

    const transition = (next: CircuitState): void => {
        if (state !== next) {
            state = next;
            onStateChange?.(next);
        }
    };

    const openError = (): { error: EmailError; success: false } => {
        return {
            error: new EmailError("middleware", "Circuit breaker is open", { code: "CIRCUIT_OPEN" }),
            success: false,
        };
    };

    return async (emailOptions, next) => {
        // Once the cooldown elapses, move to half-open and let a single probe through.
        if (state === "open" && now() - openedAt >= resetTimeout) {
            transition("half-open");
            probing = false;
        }

        if (state === "open") {
            return openError();
        }

        // Track whether THIS request is the half-open probe, so a concurrent closed-state request's
        // `finally` can't clear the flag out from under an in-flight probe.
        let isProbe = false;

        if (state === "half-open") {
            // Allow only one concurrent trial; everyone else fails fast until it resolves.
            if (probing) {
                return openError();
            }

            probing = true;
            isProbe = true;
        }

        let result;

        try {
            result = await next(emailOptions);
        } finally {
            if (isProbe) {
                probing = false;
            }
        }

        if (result.success) {
            failures = 0;
            transition("closed");

            return result;
        }

        failures += 1;

        if (state === "half-open" || failures >= failureThreshold) {
            openedAt = now();
            transition("open");
        }

        return result;
    };
};
