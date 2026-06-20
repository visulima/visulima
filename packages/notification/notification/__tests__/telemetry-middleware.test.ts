import { describe, expect, it, vi } from "vitest";

import { telemetryMiddleware } from "../src/middleware/telemetry";
import type { SendContext } from "../src/middleware/types";
import type { NotificationResult, Result } from "../src/types";

const context: SendContext = {
    channel: "push",
    payload: { to: "tok" } as never,
    provider: "mock",
};

const successResult: Result<NotificationResult> = {
    data: { channel: "push", messageId: "m1", provider: "mock", sent: true, timestamp: new Date() },
    success: true,
};

/** A no-op span recording its interactions. */
const createSpan = (): { end: ReturnType<typeof vi.fn>; recordException: ReturnType<typeof vi.fn>; setStatus: ReturnType<typeof vi.fn> } => {
    return { end: vi.fn(), recordException: vi.fn(), setStatus: vi.fn() };
};

describe("telemetry middleware", () => {
    it("passes the result through with no tracer or meter", async () => {
        expect.assertions(1);

        const middleware = telemetryMiddleware();
        const result = await middleware(context, () => Promise.resolve(successResult));

        expect(result).toStrictEqual(successResult);
    });

    it("starts and ends a span with channel/provider attributes", async () => {
        expect.assertions(2);

        const span = createSpan();
        const startSpan = vi.fn(() => span);

        const middleware = telemetryMiddleware({ tracer: { startSpan } as never });

        await middleware(context, () => Promise.resolve(successResult));

        expect(startSpan).toHaveBeenCalledWith("notification.send", {
            attributes: { "notification.channel": "push", "notification.provider": "mock" },
        });
        expect(span.end).toHaveBeenCalledTimes(1);
    });

    it("records a counter and histogram with the outcome attribute", async () => {
        expect.assertions(3);

        const counter = { add: vi.fn() };
        const histogram = { record: vi.fn() };
        const meter = {
            createCounter: vi.fn(() => counter),
            createHistogram: vi.fn(() => histogram),
        };

        const middleware = telemetryMiddleware({ meter: meter as never });

        await middleware(context, () => Promise.resolve(successResult));

        expect(counter.add).toHaveBeenCalledWith(1, {
            "notification.channel": "push",
            "notification.outcome": "success",
            "notification.provider": "mock",
        });
        expect(histogram.record).toHaveBeenCalledTimes(1);
        expect((histogram.record.mock.calls[0][1] as { "notification.outcome": string })["notification.outcome"]).toBe("success");
    });

    it("marks the span and counter as failure on a failed result", async () => {
        expect.assertions(2);

        const span = createSpan();
        const counter = { add: vi.fn() };
        const histogram = { record: vi.fn() };
        const meter = { createCounter: () => counter, createHistogram: () => histogram };

        const middleware = telemetryMiddleware({ meter: meter as never, tracer: { startSpan: () => span } as never });
        const failure: Result<NotificationResult> = { error: new Error("boom"), success: false };

        await middleware(context, () => Promise.resolve(failure));

        expect(span.setStatus).toHaveBeenCalledWith({ code: 2, message: "boom" });
        expect(counter.add).toHaveBeenCalledWith(1, expect.objectContaining({ "notification.outcome": "failure" }));
    });

    it("records an exception and rethrows when next throws", async () => {
        expect.assertions(2);

        const span = createSpan();
        const counter = { add: vi.fn() };
        const histogram = { record: vi.fn() };
        const meter = { createCounter: () => counter, createHistogram: () => histogram };

        const middleware = telemetryMiddleware({ meter: meter as never, tracer: { startSpan: () => span } as never });

        await expect(middleware(context, () => Promise.reject(new Error("kaboom")))).rejects.toThrow("kaboom");
        expect(counter.add).toHaveBeenCalledWith(1, expect.objectContaining({ "notification.outcome": "error" }));
    });
});
