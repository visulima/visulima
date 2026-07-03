import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { circuitBreakerMiddleware } from "../src/middleware/circuit-breaker";
import { dedupeMiddleware } from "../src/middleware/dedupe";
import { retryMiddleware } from "../src/middleware/retry";
import { telemetryMiddleware } from "../src/middleware/telemetry";
import type { SendContext } from "../src/middleware/types";
import { createNotification } from "../src/notification";
import { MemoryPreferenceStore, preferencesGate } from "../src/preferences";
import { failoverProvider } from "../src/providers/failover";
import { mockProvider } from "../src/providers/mock";
import type { Provider } from "../src/providers/provider";
import { roundRobinProvider } from "../src/providers/roundrobin";
import { isRetryableStatus, makeRequest, requestWithRetry } from "../src/providers/utils/http";
import generateMessageId from "../src/providers/utils/id";
import { route } from "../src/routing";
import type { NotificationResult, Result } from "../src/types";

const success = (provider = "mock"): Result<NotificationResult> => {
    return {
        data: { channel: "sms", messageId: "ok", provider, sent: true, timestamp: new Date() },
        success: true,
    };
};

const failure = (message = "boom"): Result<NotificationResult> => {
    return { error: new Error(message), success: false };
};

describe("notification facade branches", () => {
    it("throws when send() is called with an empty message", async () => {
        expect.assertions(1);

        const notify = createNotification({ sms: mockProvider({ channel: "sms" }) });

        await expect(notify.send({})).rejects.toThrow("empty message");
    });

    it("getProvider returns the registered provider or undefined", () => {
        expect.assertions(2);

        const sms = mockProvider({ channel: "sms", id: "sms-1" });
        const notify = createNotification({ sms });

        expect(notify.getProvider("sms")).toBe(sms);
        expect(notify.getProvider("push")).toBeUndefined();
    });

    it("initialize() initializes every registered provider once", async () => {
        expect.assertions(2);

        const sms = mockProvider({ channel: "sms", id: "sms-init" });
        const push = mockProvider({ channel: "push", id: "push-init" });
        const smsInit = vi.spyOn(sms, "initialize");
        const pushInit = vi.spyOn(push, "initialize");

        const notify = createNotification({ push, sms });

        await notify.initialize();

        expect(smsInit).toHaveBeenCalledTimes(1);
        expect(pushInit).toHaveBeenCalledTimes(1);
    });

    it("shutdown() calls shutdown only on providers that support it", async () => {
        expect.assertions(2);

        const shutdown = vi.fn();
        const sms = mockProvider({ channel: "sms", id: "sms-shut" });
        const push = { ...mockProvider({ channel: "push", id: "push-shut" }), shutdown } as Provider;

        const notify = createNotification({ push, sms });

        await expect(notify.shutdown()).resolves.toBeUndefined();
        expect(shutdown).toHaveBeenCalledTimes(1);
    });

    it("returns a failed receipt when a provider initialize() throws", async () => {
        expect.assertions(2);

        const provider = {
            ...mockProvider({ channel: "sms", id: "init-throws" }),
            initialize: () => {
                throw new Error("init blew up");
            },
        } as Provider;

        const notify = createNotification({ sms: provider });

        const receipt = await notify.sendToChannel("sms", { text: "x", to: "+1" });

        expect(receipt.successful).toBe(false);
        expect(receipt.successful ? "" : receipt.errorMessages[0]).toContain("init blew up");
    });

    it("sendMany processes multiple messages across batches", async () => {
        expect.assertions(2);

        const provider = mockProvider({ channel: "sms", id: "many" });
        const notify = createNotification({ sms: provider });

        const messages = [
            { sms: { text: "1", to: "+1" } },
            { sms: { text: "2", to: "+2" } },
            { sms: { text: "3", to: "+3" } },
            { sms: { text: "4", to: "+4" } },
            { sms: { text: "5", to: "+5" } },
        ];

        const collected = [];

        for await (const receipts of notify.sendMany(messages, { concurrency: 2 })) {
            collected.push(...receipts);
        }

        expect(collected).toHaveLength(5);
        expect(collected.every((receipt) => receipt.successful)).toBe(true);
    });
});

describe("failover provider branches", () => {
    it("aggregates messages when all providers fail", async () => {
        expect.assertions(2);

        const provider = failoverProvider([mockProvider({ failWith: "a", id: "p1" }), mockProvider({ failWith: "b", id: "p2" })]);
        const result = await provider.send({ text: "hi", to: "+1" } as never);

        expect(result.success).toBe(false);
        expect(result.success ? "" : (result.error as Error).message).toContain("p1: ");
    });

    it("isAvailable is true when any provider is available", async () => {
        expect.assertions(1);

        const down = { ...mockProvider({ id: "down" }), isAvailable: () => false } as Provider;
        const up = mockProvider({ id: "up" });

        const provider = failoverProvider([down, up]);

        await expect(provider.isAvailable()).resolves.toBe(true);
    });

    it("throws when constructed with an empty provider array", () => {
        expect.assertions(1);

        expect(() => failoverProvider([])).toThrow("At least one provider is required");
    });
});

describe("roundrobin provider branches", () => {
    it("rotation wraps back to the first provider", async () => {
        expect.assertions(3);

        const a = mockProvider({ channel: "sms", id: "a" });
        const b = mockProvider({ channel: "sms", id: "b" });
        const provider = roundRobinProvider([a, b]);

        const first = await provider.send({ text: "1", to: "+1" } as never);
        const second = await provider.send({ text: "2", to: "+2" } as never);
        const third = await provider.send({ text: "3", to: "+3" } as never);

        expect(first.data?.provider).toBe("a");
        expect(second.data?.provider).toBe("b");
        expect(third.data?.provider).toBe("a");
    });

    it("with failover:false only tries one provider", async () => {
        expect.assertions(2);

        const failing = mockProvider({ channel: "sms", failWith: "down", id: "first" });
        const healthy = mockProvider({ channel: "sms", id: "second" });
        const healthySend = vi.spyOn(healthy, "send");

        const provider = roundRobinProvider([failing, healthy], { failover: false });
        const result = await provider.send({ text: "x", to: "+1" } as never);

        expect(result.success).toBe(false);
        expect(healthySend).not.toHaveBeenCalled();
    });

    it("fails when all providers fail with failover", async () => {
        expect.assertions(2);

        const provider = roundRobinProvider([mockProvider({ failWith: "a", id: "p1" }), mockProvider({ failWith: "b", id: "p2" })]);
        const result = await provider.send({ text: "x", to: "+1" } as never);

        expect(result.success).toBe(false);
        expect(result.success ? "" : (result.error as Error).message).toContain("Send failed");
    });

    it("isAvailable is true when any provider is available", async () => {
        expect.assertions(1);

        const down = { ...mockProvider({ id: "rr-down" }), isAvailable: () => false } as Provider;
        const up = mockProvider({ id: "rr-up" });

        await expect(roundRobinProvider([down, up]).isAvailable()).resolves.toBe(true);
    });

    it("throws when constructed with an empty provider array", () => {
        expect.assertions(1);

        expect(() => roundRobinProvider([])).toThrow("At least one provider is required");
    });
});

const context = (overrides: Partial<SendContext> = {}): SendContext => {
    return { channel: "sms", payload: { to: "+1" } as never, provider: "mock", ...overrides };
};

describe("circuit breaker middleware branches", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("opens after the threshold, then half-opens after resetTimeout and resets on success", async () => {
        expect.assertions(4);

        let mode: "fail" | "ok" = "fail";
        const next = vi.fn(() => Promise.resolve(mode === "fail" ? failure() : success()));

        const middleware = circuitBreakerMiddleware({ resetTimeout: 1000, threshold: 2 });

        await middleware(context(), next);
        await middleware(context(), next);

        const shortCircuited = await middleware(context(), next);

        expect(shortCircuited.success ? "" : (shortCircuited.error as Error).message).toContain("Circuit open");
        expect(next).toHaveBeenCalledTimes(2);

        vi.advanceTimersByTime(1000);
        mode = "ok";

        const trial = await middleware(context(), next);

        expect(trial.success).toBe(true);

        const afterReset = await middleware(context(), next);

        expect(afterReset.success).toBe(true);
    });
});

describe("dedupe middleware branches", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("passes through when no idempotency key is present", async () => {
        expect.assertions(2);

        const next = vi.fn(() => Promise.resolve(success()));
        const middleware = dedupeMiddleware();

        await middleware(context({ payload: { to: "+1" } as never }), next);
        await middleware(context({ payload: { to: "+1" } as never }), next);

        expect(next).toHaveBeenCalledTimes(2);
        expect(next.mock.results[0]?.value).toBeDefined();
    });

    it("purges expired keys after the TTL window", async () => {
        expect.assertions(1);

        const next = vi.fn(() => Promise.resolve(success()));
        const middleware = dedupeMiddleware({ ttl: 1000 });
        const payload = context({ payload: { idempotencyKey: "k1", to: "+1" } as never });

        await middleware(payload, next);

        vi.advanceTimersByTime(2000);

        await middleware(payload, next);

        expect(next).toHaveBeenCalledTimes(2);
    });

    it("does not commit the key when the send fails so a retry can occur", async () => {
        expect.assertions(2);

        let mode: "fail" | "ok" = "fail";
        const next = vi.fn(() => Promise.resolve(mode === "fail" ? failure() : success()));
        const middleware = dedupeMiddleware();
        const payload = context({ payload: { idempotencyKey: "retryable", to: "+1" } as never });

        const first = await middleware(payload, next);

        expect(first.success).toBe(false);

        mode = "ok";

        const second = await middleware(payload, next);

        expect(second.success).toBe(true);
    });
});

describe("retry middleware branches", () => {
    it("stops early when shouldRetry returns false", async () => {
        expect.assertions(1);

        const next = vi.fn(() => Promise.resolve(failure("permanent")));
        const middleware = retryMiddleware({ baseDelay: 1, retries: 5, shouldRetry: () => false });

        await middleware(context(), next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    it("does not retry when the first attempt succeeds", async () => {
        expect.assertions(2);

        const next = vi.fn(() => Promise.resolve(success()));
        const middleware = retryMiddleware({ baseDelay: 1, retries: 3 });

        const result = await middleware(context(), next);

        expect(result.success).toBe(true);
        expect(next).toHaveBeenCalledTimes(1);
    });
});

describe("telemetry middleware branches", () => {
    it("records span and metrics on success and failure", async () => {
        expect.assertions(4);

        const span = { end: vi.fn(), recordException: vi.fn(), setStatus: vi.fn() };
        const counter = { add: vi.fn() };
        const histogram = { record: vi.fn() };
        const meter = { createCounter: () => counter, createHistogram: () => histogram };
        const tracer = { startSpan: () => span };

        const middleware = telemetryMiddleware({ meter: meter as never, tracer: tracer as never });

        await middleware(context(), () => Promise.resolve(success()));
        await middleware(context(), () => Promise.resolve(failure("nope")));

        expect(span.setStatus).toHaveBeenCalledWith({ code: 2, message: "nope" });
        expect(span.end).toHaveBeenCalledTimes(2);
        expect(counter.add).toHaveBeenCalledWith(1, expect.objectContaining({ "notification.outcome": "success" }));
        expect(counter.add).toHaveBeenCalledWith(1, expect.objectContaining({ "notification.outcome": "failure" }));
    });

    it("is a no-op when neither tracer nor meter is provided", async () => {
        expect.assertions(1);

        const middleware = telemetryMiddleware();
        const result = await middleware(context(), () => Promise.resolve(success()));

        expect(result.success).toBe(true);
    });
});

describe("routing branches", () => {
    it("skips channels whose gate returns false", async () => {
        expect.assertions(1);

        const sms = mockProvider({ channel: "sms", id: "sms" });
        const push = mockProvider({ channel: "push", id: "push" });
        const notify = createNotification({ push, sms });

        const receipts = await route(notify, { push: { body: "hi", to: "tok" }, sms: { text: "hi", to: "+1" } }, { gate: (channel) => channel === "push" });

        expect(receipts).toHaveLength(1);
    });

    it("mode:all broadcasts to every allowed channel", async () => {
        expect.assertions(2);

        const sms = mockProvider({ channel: "sms", id: "sms" });
        const push = mockProvider({ channel: "push", id: "push" });
        const notify = createNotification({ push, sms });

        const receipts = await route(notify, { push: { body: "hi", to: "tok" }, sms: { text: "hi", to: "+1" } }, { mode: "all" });

        expect(receipts).toHaveLength(2);
        expect(receipts.every((receipt) => receipt.successful)).toBe(true);
    });

    it("best-of continues past a failure and stops at the first success", async () => {
        expect.assertions(3);

        const sms = mockProvider({ channel: "sms", failWith: "down", id: "sms" });
        const push = mockProvider({ channel: "push", id: "push" });
        const notify = createNotification({ push, sms });

        const receipts = await route(notify, { push: { body: "hi", to: "tok" }, sms: { text: "hi", to: "+1" } }, { order: ["sms", "push"] });

        expect(receipts).toHaveLength(2);
        expect(receipts[0]?.successful).toBe(false);
        expect(receipts.at(-1)?.successful).toBe(true);
    });
});

describe("preferences branches", () => {
    it("isAllowed bypasses opt-outs for critical sends", () => {
        expect.assertions(2);

        const store = new MemoryPreferenceStore();

        store.set("user-1", { channels: { sms: false } });

        expect(store.isAllowed("user-1", "sms")).toBe(false);
        expect(store.isAllowed("user-1", "sms", { critical: true })).toBe(true);
    });

    it("treats an unset channel as allowed and an explicit false as denied", () => {
        expect.assertions(2);

        const store = new MemoryPreferenceStore();

        store.set("user-2", { channels: { push: false } });

        expect(store.isAllowed("user-2", "sms")).toBe(true);
        expect(store.isAllowed("user-2", "push")).toBe(false);
    });

    it("preferencesGate uses a custom subscriberId resolver", async () => {
        expect.assertions(2);

        const store = new MemoryPreferenceStore();

        store.set("tenant-9", { channels: { sms: false } });

        const gate = preferencesGate(store, { subscriberId: () => "tenant-9" });

        await expect(gate("sms", { to: "ignored" } as never)).resolves.toBe(false);
        await expect(gate("push", { to: "ignored" } as never)).resolves.toBe(true);
    });

    it("preferencesGate default resolver uses the payload `to` field and allows when absent", async () => {
        expect.assertions(3);

        const store = new MemoryPreferenceStore();

        store.set("+1555", { channels: { sms: false } });
        store.set("{\"id\":7}", { channels: { sms: false } });

        const gate = preferencesGate(store);

        await expect(gate("sms", { to: "+1555" } as never)).resolves.toBe(false);
        await expect(gate("sms", { to: { id: 7 } } as never)).resolves.toBe(false);
        await expect(gate("sms", {} as never)).resolves.toBe(true);
    });
});

describe("http util branches", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("returns a failed result when the request aborts on timeout", async () => {
        expect.assertions(2);

        vi.useFakeTimers();

        const fetchMock = vi.fn(
            async (_url: string, init?: { signal?: AbortSignal }) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener("abort", () => {
                        reject(new DOMException("Aborted", "AbortError"));
                    });
                }),
        );

        vi.stubGlobal("fetch", fetchMock);

        const pending = makeRequest("https://example.test", { timeout: 50 });

        await vi.advanceTimersByTimeAsync(50);

        const result = await pending;

        expect(result.success).toBe(false);
        expect(result.success ? "" : (result.error as Error).name).toBe("AbortError");
    });

    it("parses a non-JSON body as text", async () => {
        expect.assertions(2);

        const fetchMock = vi.fn(() => Promise.resolve(new Response("plain text body", { status: 200, statusText: "OK" })));

        vi.stubGlobal("fetch", fetchMock);

        const result = await makeRequest<string>("https://example.test");

        expect(result.success).toBe(true);
        expect(result.success ? result.data.body : "").toBe("plain text body");
    });

    it("isRetryableStatus is true for transient codes and false otherwise", () => {
        expect.assertions(5);

        expect(isRetryableStatus(408)).toBe(true);
        expect(isRetryableStatus(429)).toBe(true);
        expect(isRetryableStatus(500)).toBe(true);
        expect(isRetryableStatus(200)).toBe(false);
        expect(isRetryableStatus(400)).toBe(false);
    });

    it("requestWithRetry returns immediately on a non-retryable status", async () => {
        expect.assertions(2);

        const fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 200, statusText: "OK" })));

        vi.stubGlobal("fetch", fetchMock);

        const result = await requestWithRetry("https://example.test", {}, 3, 1);

        expect(result.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe("id util branches", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("uses crypto.randomUUID when available", () => {
        expect.assertions(1);

        vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-1111-1111-111111111111" });

        expect(generateMessageId("p")).toBe("p-11111111-1111-1111-1111-111111111111");
    });

    it("falls back to a random suffix when crypto.randomUUID is unavailable", () => {
        expect.assertions(2);

        vi.stubGlobal("crypto", undefined);

        const id = generateMessageId("fallback");

        expect(id.startsWith("fallback-")).toBe(true);
        expect(id).not.toContain("-1111-");
    });
});
