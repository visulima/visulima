import type { Span, Tracer } from "@opentelemetry/api";

import type { BaseNotificationPayload, NotificationResult, Result } from "../../types";
import type { Provider } from "../provider";

const SPAN_NAME = "notification.send";

/** Mirrors `SpanStatusCode.ERROR` from `@opentelemetry/api` without importing it at runtime. */
const STATUS_CODE_ERROR = 2;

export interface OtelProviderConfig {
    /**
     * The OpenTelemetry {@link Tracer} used to create spans. When omitted, a no-op tracer is
     * used so the wrapper is inert until the host application supplies one (keeping
     * `@opentelemetry/api` an optional peer dependency).
     */
    tracer?: Tracer;
}

/**
 * Wraps any {@link Provider} and records an OpenTelemetry span per `send` call. Edge-safe:
 * `@opentelemetry/api` is runtime-agnostic and the tracer is injected, so nothing is bundled
 * when tracing is disabled.
 * @param inner The provider to wrap.
 * @param config Optional config; supply a `tracer` to emit real spans.
 * @returns A provider that delegates to `inner` while tracing each send.
 */
export const otelProvider = <PayloadT extends BaseNotificationPayload>(
    inner: Provider<unknown, PayloadT>,
    config: OtelProviderConfig = {},
): Provider<unknown, PayloadT> => {
    const { tracer } = config;

    return {
        ...inner,
        send: async (payload: PayloadT): Promise<Result<NotificationResult>> => {
            if (!tracer) {
                return inner.send(payload);
            }

            const span: Span = tracer.startSpan(SPAN_NAME, {
                attributes: { "notification.channel": inner.channel, "notification.provider": inner.id },
            });

            try {
                const result = await inner.send(payload);

                if (!result.success) {
                    const message = result.error instanceof Error ? result.error.message : String(result.error);

                    span.setStatus({ code: STATUS_CODE_ERROR, message });
                }

                return result;
            } catch (error) {
                span.recordException(error as Error);
                span.setStatus({ code: STATUS_CODE_ERROR, message: error instanceof Error ? error.message : String(error) });

                throw error;
            } finally {
                span.end();
            }
        },
    };
};
