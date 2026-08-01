import { describe, expect, it } from "vitest";

import type { PailBrowserType } from "../../../src/pail.browser";
import { PailBrowser } from "../../../src/pail.browser";
import { createWideEvent } from "../../../src/wide-event";
import { MetaCaptureReporter } from "./helpers";

const createLogger = (): { logger: PailBrowserType; reporter: MetaCaptureReporter } => {
    const reporter = new MetaCaptureReporter();
    const logger = new PailBrowser({ reporters: [reporter], throttle: 0 });

    return { logger, reporter };
};

describe("wideEvent in workerd", () => {
    it("measures duration with performance.now()", async () => {
        expect.assertions(3);

        // workerd exposes `performance.now()` as a wall-clock reading rather than a
        // monotonic offset from `timeOrigin`. Durations must still come out finite,
        // non-negative and in milliseconds.
        expect(performance.now()).toBeTypeOf("number");

        const { logger, reporter } = createLogger();
        const event = createWideEvent({ name: "workerd.request", pail: logger as never });

        await new Promise((resolve) => {
            setTimeout(resolve, 10);
        });

        event.finish({ status: 200 });

        const payload = reporter.metas[0].message as Record<string, unknown>;

        expect(Number.isFinite(payload.duration_ms)).toBe(true);
        expect(payload.duration_ms as number).toBeGreaterThanOrEqual(0);
    });

    it("emits a single record carrying the accumulated context", () => {
        expect.assertions(3);

        const { logger, reporter } = createLogger();
        const event = createWideEvent<{ cart: { items: number }; user: { id: number } }>({
            name: "api.checkout",
            pail: logger as never,
            service: "checkout",
        });

        event.set({ user: { id: 1 } });
        event.info("validated cart");
        event.set({ cart: { items: 3 } });
        event.finish({ status: 201 });
        event.finish({ status: 500 });

        const payload = reporter.metas[0].message as Record<string, unknown>;

        expect(reporter.metas).toHaveLength(1);
        expect(payload.event).toBe("api.checkout");
        expect({ cart: payload.cart, service: payload.service, status: payload.status, user: payload.user }).toStrictEqual({
            cart: { items: 3 },
            service: "checkout",
            status: 201,
            user: { id: 1 },
        });
    });

    it("escalates the log type and serializes the attached error", () => {
        expect.assertions(3);

        const { logger, reporter } = createLogger();
        const event = createWideEvent({ name: "api.fail", pail: logger as never });

        event.error("payment failed", new Error("card declined", { cause: new Error("issuer down") }));
        event.finish({ status: 402 });

        const payload = reporter.metas[0].message as { error: { cause?: { message: string }; message: string; name: string } };

        expect(reporter.metas[0].type.name).toBe("error");
        expect(payload.error.message).toBe("card declined");
        expect(payload.error.cause?.message).toBe("issuer down");
    });

    it("auto-emits through Symbol.dispose", () => {
        expect.assertions(2);

        // Explicit Resource Management relies on the runtime providing `Symbol.dispose`.
        expect(Symbol.dispose).toBeTypeOf("symbol");

        const { logger, reporter } = createLogger();

        {
            const event = createWideEvent({ name: "scoped.work", pail: logger as never });

            event.set({ done: true });
            event[Symbol.dispose]();
        }

        expect(reporter.metas).toHaveLength(1);
    });

    it("timestamps lifecycle entries with ISO dates", () => {
        expect.assertions(2);

        const { logger, reporter } = createLogger();
        const event = createWideEvent({ name: "worker.job", pail: logger as never });

        event.warn("retrying", { attempt: 2 });
        event.emit();

        const payload = reporter.metas[0].message as { requestLogs: { level: string; timestamp: string }[] };

        expect(payload.requestLogs[0].level).toBe("warn");
        expect(new Date(payload.requestLogs[0].timestamp).toISOString()).toBe(payload.requestLogs[0].timestamp);
    });
});
