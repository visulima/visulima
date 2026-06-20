import { describe, expect, it, vi } from "vitest";

import { NotificationEventBus } from "../src/events";
import { circuitBreakerMiddleware } from "../src/middleware/circuit-breaker";
import { dedupeMiddleware } from "../src/middleware/dedupe";
import { retryMiddleware } from "../src/middleware/retry";
import { createNotification } from "../src/notification";
import { failoverProvider } from "../src/providers/failover";
import { mockProvider } from "../src/providers/mock";
import { roundRobinProvider } from "../src/providers/roundrobin";
import { createQueueWorker, MemoryQueue } from "../src/queue";
import { route } from "../src/routing";

describe("failover + roundrobin", () => {
    it("failover falls through to the next provider on failure", async () => {
        expect.assertions(2);

        const failing = mockProvider({ channel: "sms", failWith: "down", id: "p1" });
        const healthy = mockProvider({ channel: "sms", id: "p2" });

        const provider = failoverProvider([failing, healthy]);
        const result = await provider.send({ text: "hi", to: "+1" } as never);

        expect(result.success).toBe(true);
        expect(result.data?.provider).toBe("p2");
    });

    it("failover fails when all providers fail", async () => {
        expect.assertions(1);

        const provider = failoverProvider([mockProvider({ failWith: "a", id: "p1" }), mockProvider({ failWith: "b", id: "p2" })]);
        const result = await provider.send({ text: "hi", to: "+1" } as never);

        expect(result.success).toBe(false);
    });

    it("roundrobin alternates providers across calls", async () => {
        expect.assertions(2);

        const a = mockProvider({ channel: "sms", id: "a" });
        const b = mockProvider({ channel: "sms", id: "b" });
        const provider = roundRobinProvider([a, b]);

        const first = await provider.send({ text: "1", to: "+1" } as never);
        const second = await provider.send({ text: "2", to: "+2" } as never);

        expect(first.data?.provider).toBe("a");
        expect(second.data?.provider).toBe("b");
    });
});

describe("middleware", () => {
    it("retry retries a failing send until it succeeds", async () => {
        expect.assertions(2);

        let attempts = 0;
        const provider = mockProvider({ channel: "sms" });

        vi.spyOn(provider, "send").mockImplementation((() => {
            attempts += 1;

            if (attempts < 3) {
                return { error: new Error("transient"), success: false };
            }

            return { data: { channel: "sms", messageId: "ok", provider: "mock", sent: true, timestamp: new Date() }, success: true };
        }) as never);

        const notify = createNotification({ sms: provider }).use(retryMiddleware({ baseDelay: 1, retries: 5 }));
        const receipt = await notify.sendToChannel("sms", { text: "x", to: "+1" });

        expect(receipt.successful).toBe(true);
        expect(attempts).toBe(3);
    });

    it("circuit breaker opens after the threshold", async () => {
        expect.assertions(1);

        const provider = mockProvider({ channel: "sms", failWith: "boom" });
        const notify = createNotification({ sms: provider }).use(circuitBreakerMiddleware({ threshold: 2 }));

        await notify.sendToChannel("sms", { text: "1", to: "+1" });
        await notify.sendToChannel("sms", { text: "2", to: "+1" });
        const third = await notify.sendToChannel("sms", { text: "3", to: "+1" });

        expect(third.successful ? "" : third.errorMessages[0]).toContain("Circuit open");
    });

    it("dedupe suppresses a repeated idempotency key", async () => {
        expect.assertions(2);

        const provider = mockProvider({ channel: "sms" });
        const notify = createNotification({ sms: provider }).use(dedupeMiddleware());

        await notify.sendToChannel("sms", { idempotencyKey: "k1", text: "x", to: "+1" });
        await notify.sendToChannel("sms", { idempotencyKey: "k1", text: "x", to: "+1" });

        expect(provider.getInstance?.().sent).toHaveLength(1);

        const again = await notify.sendToChannel("sms", { idempotencyKey: "k1", text: "x", to: "+1" });

        expect(again.successful && again.messageId.startsWith("deduped:")).toBe(true);
    });
});

describe("routing", () => {
    it("best-of stops at the first successful channel", async () => {
        expect.assertions(2);

        const sms = mockProvider({ channel: "sms", failWith: "down", id: "sms" });
        const push = mockProvider({ channel: "push", id: "push" });

        const notify = createNotification({ push, sms });

        const receipts = await route(notify, { push: { body: "hi", to: "tok" }, sms: { text: "hi", to: "+1" } }, { order: ["sms", "push"] });

        expect(receipts).toHaveLength(2);
        expect(receipts.at(-1)?.successful).toBe(true);
    });

    it("gate skips channels that return false", async () => {
        expect.assertions(1);

        const sms = mockProvider({ channel: "sms", id: "sms" });
        const notify = createNotification({ sms });

        const receipts = await route(notify, { sms: { text: "hi", to: "+1" } }, { gate: () => false });

        expect(receipts).toHaveLength(0);
    });
});

describe("queue + worker", () => {
    it("drains enqueued messages through the facade", async () => {
        expect.assertions(2);

        const provider = mockProvider({ channel: "sms" });
        const notify = createNotification({ sms: provider });
        const queue = new MemoryQueue();

        queue.enqueue({ sms: { text: "1", to: "+1" } });
        queue.enqueue({ sms: { text: "2", to: "+2" } });

        const worker = createQueueWorker(queue, notify);

        await worker.drain();

        expect(queue.size()).toBe(0);
        expect(provider.getInstance?.().sent).toHaveLength(2);
    });
});

describe("event bus", () => {
    it("delivers events to typed and wildcard listeners", () => {
        expect.assertions(2);

        const bus = new NotificationEventBus();
        const sent = vi.fn();
        const all = vi.fn();

        bus.on("sent", sent);
        bus.on("*", all);
        bus.emit({ channel: "sms", messageId: "m1", provider: "mock", timestamp: new Date(), type: "sent" });

        expect(sent).toHaveBeenCalledTimes(1);
        expect(all).toHaveBeenCalledTimes(1);
    });
});
