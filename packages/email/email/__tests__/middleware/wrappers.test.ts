import { describe, expect, it, vi } from "vitest";

import { MemorySuppressionStore } from "../../src/deliverability/suppression";
import type { EmailEvent } from "../../src/events";
import { EventBus } from "../../src/events";
import { composeMiddleware, withEvents, withMetrics, withRender, withSuppression, withTelemetry } from "../../src/middleware";
import type { EmailOptions, EmailResult, Result } from "../../src/types";

const message: EmailOptions = {
    from: { email: "from@x.com" },
    subject: "Hi",
    text: "body",
    to: { email: "to@x.com" },
};

const okResult = (): Result<EmailResult> => {
    return {
        data: { messageId: "m1", provider: "stub", sent: true, timestamp: new Date(0) },
        success: true,
    };
};

describe("middleware wrappers", () => {
    describe(withRender, () => {
        it("transforms the message before sending", async () => {
            expect.assertions(1);

            const send = vi.fn(() => Promise.resolve(okResult()));
            const composed = composeMiddleware(
                [
                    withRender((email) => {
                        return { ...email, html: "<p>rendered</p>" };
                    }),
                ],
                send,
            );

            await composed(message);

            expect(send).toHaveBeenCalledWith(expect.objectContaining({ html: "<p>rendered</p>" }));
        });
    });

    describe(withSuppression, () => {
        it("filters suppressed recipients and short-circuits when all are suppressed", async () => {
            expect.assertions(3);

            const store = new MemorySuppressionStore([{ address: "blocked@x.com", reason: "bounce" }]);
            const send = vi.fn(() => Promise.resolve(okResult()));
            const onSuppressed = vi.fn();
            const composed = composeMiddleware([withSuppression(store, { onSuppressed })], send);

            const filtered = await composed({ ...message, to: [{ email: "ok@x.com" }, { email: "blocked@x.com" }] });

            expect(filtered.success).toBe(true);
            expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: [{ email: "ok@x.com" }] }));

            const blocked = await composed({ ...message, to: { email: "blocked@x.com" } });

            expect((blocked.error as Error).message).toContain("All recipients are suppressed");
        });
    });

    describe(withEvents, () => {
        it("emits queued then sent on the bus", async () => {
            expect.assertions(2);

            const bus = new EventBus();
            const events: EmailEvent[] = [];

            bus.on("*", (event) => events.push(event));

            const send = vi.fn(() => Promise.resolve(okResult()));

            await composeMiddleware([withEvents(bus)], send)(message);

            expect(events.map((event) => event.type)).toStrictEqual(["queued", "sent"]);
            expect(events[1]?.messageId).toBe("m1");
        });
    });

    describe(withMetrics, () => {
        it("records a counter and a duration observation", async () => {
            expect.assertions(2);

            const recorder = { increment: vi.fn(), observe: vi.fn() };
            const send = vi.fn(() => Promise.resolve(okResult()));

            await composeMiddleware([withMetrics(recorder)], send)(message);

            expect(recorder.increment).toHaveBeenCalledWith("email_sent_total", { provider: "stub", status: "success" });
            expect(recorder.observe).toHaveBeenCalledWith("email_duration_ms", expect.any(Number), { provider: "stub", status: "success" });
        });
    });

    describe(withTelemetry, () => {
        it("opens a span and ends it", async () => {
            expect.assertions(2);

            const span = { end: vi.fn(), setAttribute: vi.fn(), setStatus: vi.fn() };
            const tracer = { startActiveSpan: vi.fn((_name: string, run: (s: typeof span) => unknown) => run(span)) };
            const send = vi.fn(() => Promise.resolve(okResult()));

            await composeMiddleware([withTelemetry(tracer as never)], send)(message);

            expect(tracer.startActiveSpan).toHaveBeenCalledWith("email.send", expect.any(Function));
            expect(span.end).toHaveBeenCalledTimes(1);
        });
    });
});
