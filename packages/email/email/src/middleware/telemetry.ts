import type { Tracer } from "@opentelemetry/api";

import type { Middleware } from "./types";

// SpanStatusCode.ERROR from @opentelemetry/api, inlined to avoid a runtime import of the optional peer.
const SPAN_STATUS_ERROR = 2;

/**
 * Options for {@link withTelemetry}.
 */
export interface TelemetryMiddlewareOptions {
    /**
     * The span name.
     * @default "email.send"
     */
    spanName?: string;
}

/**
 * Wraps each send in an OpenTelemetry span, recording the provider, recipient count and outcome.
 *
 * The `@opentelemetry/api` `Tracer` is injected (type-only import here), so this middleware adds no
 * runtime dependency — pass `trace.getTracer("email")` from your instrumented app.
 * @param tracer An OpenTelemetry `Tracer`.
 * @param options Middleware options. See {@link TelemetryMiddlewareOptions}.
 * @returns A middleware that traces sends.
 */
export const withTelemetry = (tracer: Tracer, options: TelemetryMiddlewareOptions = {}): Middleware => {
    const spanName = options.spanName ?? "email.send";

    return async (email, next) =>
        tracer.startActiveSpan(spanName, async (span) => {
            span.setAttribute("email.recipients", Array.isArray(email.to) ? email.to.length : 1);

            try {
                const result = await next(email);

                span.setAttribute("email.success", result.success);

                if (result.data?.provider) {
                    span.setAttribute("email.provider", result.data.provider);
                }

                if (!result.success) {
                    span.setStatus({ code: SPAN_STATUS_ERROR, message: result.error instanceof Error ? result.error.message : "send failed" });
                }

                return result;
            } catch (error) {
                // A thrown send (vs. a failed result) must still be recorded on the span before it ends.
                if (error instanceof Error) {
                    span.recordException(error);
                }

                span.setStatus({ code: SPAN_STATUS_ERROR, message: error instanceof Error ? error.message : "send failed" });

                throw error;
            } finally {
                span.end();
            }
        });
};
