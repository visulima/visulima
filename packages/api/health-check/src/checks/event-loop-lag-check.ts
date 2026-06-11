import { performance } from "node:perf_hooks";

import type { Checker } from "../types";

const DISPLAY_NAME = "Event loop lag check";

interface EventLoopLagCheckOptions {
    /**
     * Maximum tolerated event loop lag, in milliseconds, before the check
     * reports unhealthy. Defaults to `70`.
     */
    maxLagMs?: number;

    /**
     * The delay, in milliseconds, scheduled to measure lag. The measured lag is
     * the overshoot of the actual delay over this value. Defaults to `30`.
     */
    sampleDelayMs?: number;
}

/**
 * Register a checker that measures event loop lag and reports unhealthy when it
 * exceeds the configured threshold. A `setTimeout` is scheduled for
 * `sampleDelayMs`; the difference between the scheduled and actual elapsed time
 * is the lag. High lag indicates the loop is blocked by synchronous work.
 *
 * This is a cheap, self-contained probe — a good fit for a `liveness` check.
 */
const eventLoopLagCheck
    = (options: EventLoopLagCheckOptions = {}): Checker =>
        async () => {
            const { maxLagMs = 70, sampleDelayMs = 30 } = options;

            const start = performance.now();

            await new Promise<void>((resolve) => {
                setTimeout(resolve, sampleDelayMs);
            });

            const lag = Math.max(0, performance.now() - start - sampleDelayMs);
            const healthy = lag <= maxLagMs;

            return {
                displayName: DISPLAY_NAME,
                health: {
                    healthy,
                    message: healthy
                        ? `${DISPLAY_NAME} passed.`
                        : `Event loop lag ${lag.toFixed(2)}ms exceeds limit ${maxLagMs}ms`,
                    timestamp: new Date().toISOString(),
                },
                meta: {
                    lag,
                    maxLagMs,
                },
            };
        };

export type { EventLoopLagCheckOptions };

export default eventLoopLagCheck;
