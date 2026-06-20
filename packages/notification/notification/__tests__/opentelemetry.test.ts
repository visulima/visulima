import { describe, expect, it, vi } from "vitest";

import { otelProvider } from "../src/providers/opentelemetry";
import type { Provider } from "../src/providers/provider";
import type { NotificationResult, PushPayload, Result } from "../src/types";

const successResult: Result<NotificationResult> = {
    data: { channel: "push", messageId: "m1", provider: "mock", sent: true, timestamp: new Date() },
    success: true,
};

/** Builds a minimal mock push provider whose `send` returns the supplied result. */
const mockProvider = (result: Result<NotificationResult>, sendImpl?: () => Promise<Result<NotificationResult>>): Provider<unknown, PushPayload> => {
    return {
        channel: "push",
        id: "mock",
        initialize: () => {},
        isAvailable: () => true,
        send: sendImpl ?? (() => Promise.resolve(result)),
    };
};

/** A no-op span that records every interaction for assertions. */
const createSpan = (): { end: ReturnType<typeof vi.fn>; recordException: ReturnType<typeof vi.fn>; setStatus: ReturnType<typeof vi.fn> } => {
    return {
        end: vi.fn(),
        recordException: vi.fn(),
        setStatus: vi.fn(),
    };
};

describe("otel provider wrapper", () => {
    it("delegates send and returns the inner result without a tracer", async () => {
        expect.assertions(1);

        const wrapped = otelProvider(mockProvider(successResult));
        const result = await wrapped.send({ body: "x", to: "tok" });

        expect(result).toStrictEqual(successResult);
    });

    it("starts and ends a span with channel/provider attributes when a tracer is supplied", async () => {
        expect.assertions(3);

        const span = createSpan();
        const startSpan = vi.fn(() => span);

        const wrapped = otelProvider(mockProvider(successResult), { tracer: { startSpan } as never });
        const result = await wrapped.send({ body: "x", to: "tok" });

        expect(result.success).toBe(true);
        expect(startSpan).toHaveBeenCalledWith("notification.send", {
            attributes: { "notification.channel": "push", "notification.provider": "mock" },
        });
        expect(span.end).toHaveBeenCalledTimes(1);
    });

    it("sets an error status on a failed result", async () => {
        expect.assertions(2);

        const span = createSpan();
        const failure: Result<NotificationResult> = { error: new Error("boom"), success: false };

        const wrapped = otelProvider(mockProvider(failure), { tracer: { startSpan: () => span } as never });
        const result = await wrapped.send({ body: "x", to: "tok" });

        expect(result.success).toBe(false);
        expect(span.setStatus).toHaveBeenCalledWith({ code: 2, message: "boom" });
    });

    it("records an exception and rethrows when send throws", async () => {
        expect.assertions(2);

        const span = createSpan();
        const thrower = mockProvider(successResult, () => Promise.reject(new Error("kaboom")));

        const wrapped = otelProvider(thrower, { tracer: { startSpan: () => span } as never });

        await expect(wrapped.send({ body: "x", to: "tok" })).rejects.toThrow("kaboom");
        expect(span.recordException).toHaveBeenCalledTimes(1);
    });
});
