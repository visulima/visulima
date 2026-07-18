import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pailPlugin, useLogger } from "../../../src/middleware/fastify";
import { PailBrowser } from "../../../src/pail.browser";
import RawReporter from "../../../src/reporter/raw/raw-reporter.browser";

const createMockPail = () =>
    new PailBrowser({
        logLevel: "debug",
        processors: [],
        rawReporter: new RawReporter(),
        reporters: [new RawReporter()],
    });

type HookHandler = (...arguments_: any[]) => any;

const createMockFastify = () => {
    const hooks: Record<string, HookHandler[]> = {};

    return {
        addHook: (name: string, handler: HookHandler) => {
            if (!hooks[name]) {
                hooks[name] = [];
            }

            hooks[name].push(handler);
        },
        trigger: async (name: string, ...arguments_: unknown[]) => {
            for (const handler of hooks[name] ?? []) {
                // eslint-disable-next-line no-await-in-loop
                await handler(...arguments_);
            }
        },
    };
};

const createMockRequest = (overrides?: Record<string, unknown>) => {
    return {
        headers: { "content-type": "application/json" } as Record<string, string | string[] | undefined>,
        method: "GET",
        url: "/api/users",
        ...overrides,
    };
};

const createMockReply = (statusCode = 200) => {
    return {
        statusCode,
    };
};

describe("fastify plugin", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should attach logger to request.log on onRequest", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const fastify = createMockFastify();
        const request = createMockRequest();
        const reply = createMockReply();

        pailPlugin(fastify as any, { pail });

        await fastify.trigger("onRequest", request, reply, () => {});

        expect(request.log).toBeDefined();
    });

    it("should emit on onResponse with status code", async () => {
        expect.assertions(2);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const fastify = createMockFastify();
        const request = createMockRequest();
        const reply = createMockReply(201);

        pailPlugin(fastify as any, { pail });

        await fastify.trigger("onRequest", request, reply, () => {});
        await fastify.trigger("onResponse", request, reply);

        expect(consoleSpy).toHaveBeenCalledTimes(1);

        const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

        expect(emitted.status).toBe(201);
    });

    it("should emit on onError with error", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const errorSpy = vi.spyOn(console, "error");
        const fastify = createMockFastify();
        const request = createMockRequest();
        const reply = createMockReply();
        const testError = new Error("handler error");

        pailPlugin(fastify as any, { pail });

        await fastify.trigger("onRequest", request, reply, () => {});
        await fastify.trigger("onError", request, reply, testError);

        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("should not double-emit if both onError and onResponse fire", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const errorSpy = vi.spyOn(console, "error");
        const consoleSpy = vi.spyOn(console, "log");
        const fastify = createMockFastify();
        const request = createMockRequest();
        const reply = createMockReply();
        const testError = new Error("handler error");

        pailPlugin(fastify as any, { pail });

        await fastify.trigger("onRequest", request, reply, () => {});
        await fastify.trigger("onError", request, reply, testError);
        await fastify.trigger("onResponse", request, reply);

        expect(errorSpy.mock.calls.length + consoleSpy.mock.calls.length).toBe(1);
    });

    it("should ignore onError when no request state was registered", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const errorSpy = vi.spyOn(console, "error");
        const consoleSpy = vi.spyOn(console, "log");
        const fastify = createMockFastify();
        const request = createMockRequest();
        const reply = createMockReply();

        pailPlugin(fastify as any, { pail });

        // onError fires without a preceding onRequest, so requestState has no entry.
        await fastify.trigger("onError", request, reply, new Error("orphan error"));

        expect(errorSpy.mock.calls.length + consoleSpy.mock.calls.length).toBe(0);
    });

    it("should skip excluded routes", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const fastify = createMockFastify();
        const request = createMockRequest({ url: "/health" });
        const reply = createMockReply();

        pailPlugin(fastify as any, { exclude: ["/health"], pail });

        await fastify.trigger("onRequest", request, reply, () => {});
        await fastify.trigger("onResponse", request, reply);

        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should strip the query string from the logged path", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const fastify = createMockFastify();
        const request = createMockRequest({ url: "/api/users?token=secret" });
        const reply = createMockReply();

        pailPlugin(fastify as any, { pail });

        await fastify.trigger("onRequest", request, reply, () => {});

        const data = (request.log as { getData: () => unknown }).getData() as Record<string, unknown>;

        expect(data.path).toBe("/api/users");
    });

    it("should exclude routes even when a query string is present", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const fastify = createMockFastify();
        const request = createMockRequest({ url: "/health?probe=1" });
        const reply = createMockReply();

        pailPlugin(fastify as any, { exclude: ["/health"], pail });

        await fastify.trigger("onRequest", request, reply, () => {});
        await fastify.trigger("onResponse", request, reply);

        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should make logger available via useLogger in async context", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const fastify = createMockFastify();
        const request = createMockRequest();
        const reply = createMockReply();

        pailPlugin(fastify as any, { pail });

        await new Promise<void>((resolve) => {
            fastify.trigger("onRequest", request, reply, () => {
                const log = useLogger();

                expect(log).toBe(request.log);

                resolve();
            });
        });
    });

    it("should use x-request-id header when present", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const fastify = createMockFastify();
        const request = createMockRequest({
            headers: { "x-request-id": "fastify-req-123" },
        });
        const reply = createMockReply();

        pailPlugin(fastify as any, { pail });

        await fastify.trigger("onRequest", request, reply, () => {});

        const data = (request.log as { getData: () => unknown }).getData() as Record<string, unknown>;

        expect(data.requestId).toBe("fastify-req-123");
    });
});
