import type { Counter, Histogram, Meter, Span, Tracer } from "@opentelemetry/api";

import type { Middleware } from "./types";

const SPAN_NAME = "notification.send";

/** Mirrors `SpanStatusCode.ERROR` from `@opentelemetry/api` without importing it at runtime. */
const STATUS_CODE_ERROR = 2;

export interface TelemetryMiddlewareOptions {
    /**
     * The OpenTelemetry {@link Meter} used to record a send counter and duration histogram.
     * When omitted, no metrics are recorded.
     */
    meter?: Meter;

    /**
     * The OpenTelemetry {@link Tracer} used to create a span per send. When omitted, no span
     * is recorded (keeping `@opentelemetry/api` an optional peer dependency).
     */
    tracer?: Tracer;
}

/**
 * Records an OpenTelemetry span plus a send counter and duration histogram for each send.
 * Edge-safe: `@opentelemetry/api` is runtime-agnostic and both the tracer and meter are
 * injected, so nothing is emitted until the host application supplies them.
 * @param options Provide a `tracer` and/or `meter` to enable tracing and metrics.
 * @returns A middleware.
 */
export const telemetryMiddleware = (options: TelemetryMiddlewareOptions = {}): Middleware => {
    const { meter, tracer } = options;

    let counter: Counter | undefined;
    let histogram: Histogram | undefined;

    if (meter) {
        counter = meter.createCounter("notification.send.count", { description: "Number of notification send attempts" });
        histogram = meter.createHistogram("notification.send.duration", { description: "Notification send duration in milliseconds", unit: "ms" });
    }

    return async (context, next) => {
        const attributes = { "notification.channel": context.channel, "notification.provider": context.provider };
        const span: Span | undefined = tracer?.startSpan(SPAN_NAME, { attributes });
        const startedAt = Date.now();

        try {
            const result = await next(context);
            const outcome = result.success ? "success" : "failure";

            if (!result.success && span) {
                const message = result.error instanceof Error ? result.error.message : String(result.error);

                span.setStatus({ code: STATUS_CODE_ERROR, message });
            }

            counter?.add(1, { ...attributes, "notification.outcome": outcome });
            histogram?.record(Date.now() - startedAt, { ...attributes, "notification.outcome": outcome });

            return result;
        } catch (error) {
            if (span) {
                span.recordException(error as Error);
                span.setStatus({ code: STATUS_CODE_ERROR, message: error instanceof Error ? error.message : String(error) });
            }

            counter?.add(1, { ...attributes, "notification.outcome": "error" });
            histogram?.record(Date.now() - startedAt, { ...attributes, "notification.outcome": "error" });

            throw error;
        } finally {
            span?.end();
        }
    };
};
