import type { Middleware } from "./types";

/**
 * A minimal metrics sink — implement it with prom-client, OpenTelemetry metrics, StatsD, etc.
 */
export interface MetricsRecorder {
    /**
     * Increments a counter.
     * @param metric The metric name.
     * @param labels Optional labels/dimensions.
     */
    increment: (metric: string, labels?: Record<string, string>) => void;

    /**
     * Records an observation (e.g. a duration) on a histogram/summary.
     * @param metric The metric name.
     * @param value The observed value.
     * @param labels Optional labels/dimensions.
     */
    observe: (metric: string, value: number, labels?: Record<string, string>) => void;
}

/**
 * Options for {@link withMetrics}.
 */
export interface MetricsMiddlewareOptions {
    /**
     * Prefix for emitted metric names.
     * @default "email_"
     */
    prefix?: string;
}

/**
 * Records per-send metrics (a `*_sent_total` counter and a `*_duration_ms` observation, labelled by
 * provider and status) into an injected {@link MetricsRecorder}. Dependency-free — wire it to
 * prom-client or any metrics backend.
 * @param recorder The metrics sink.
 * @param options Middleware options. See {@link MetricsMiddlewareOptions}.
 * @returns A middleware that records send metrics.
 */
export const withMetrics = (recorder: MetricsRecorder, options: MetricsMiddlewareOptions = {}): Middleware => {
    const prefix = options.prefix ?? "email_";

    return async (email, next) => {
        const start = Date.now();
        const result = await next(email);
        const labels = {
            provider: result.data?.provider ?? "unknown",
            status: result.success ? "success" : "failure",
        };

        recorder.increment(`${prefix}sent_total`, labels);
        recorder.observe(`${prefix}duration_ms`, Date.now() - start, labels);

        return result;
    };
};
