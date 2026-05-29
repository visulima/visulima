import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pailPlugin, useLogger } from "../../../src/middleware/elysia";
import { PailBrowser } from "../../../src/pail.browser";
import RawReporter from "../../../src/reporter/raw/raw-reporter.browser";

const createMockPail = () =>
    new PailBrowser({
        logLevel: "debug",
        processors: [],
        rawReporter: new RawReporter(),
        reporters: [new RawReporter()],
    });

type DeriveHandler = (context: { request: Request }) => Record<string, unknown>;
type AfterHandleHandler = (context: { request: Request; set: { status?: number } }) => Promise<void>;
type ErrorHandler = (context: { error: Error; request: Request }) => Promise<void>;

const getHandler = <T>(handler: T | undefined): T => {
    if (!handler) {
        throw new Error("Handler not registered");
    }

    return handler;
};

const createMockElysia = () => {
    let deriveHandler: DeriveHandler | undefined;
    let afterHandleHandler: AfterHandleHandler | undefined;
    let errorHandler: ErrorHandler | undefined;

    const instance = {
        derive: (_options: { as: string }, handler: DeriveHandler) => {
            deriveHandler = handler;

            return instance;
        },
        getAfterHandleHandler: () => afterHandleHandler,
        getDeriveHandler: () => deriveHandler,
        getErrorHandler: () => errorHandler,
        onAfterHandle: (_options: { as: string }, handler: AfterHandleHandler) => {
            afterHandleHandler = handler;

            return instance;
        },
        onError: (_options: { as: string }, handler: ErrorHandler) => {
            errorHandler = handler;

            return instance;
        },
    };

    return instance;
};

const createMockRequest = (path = "/api/users", headers?: Record<string, string>) => {
    const h = new Headers(headers);

    return new Request(`http://localhost${path}`, { headers: h });
};

describe("elysia plugin", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should inject log into derive context", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const elysia = createMockElysia();

        pailPlugin(elysia as any, { pail });

        const request = createMockRequest();
        const result = getHandler(elysia.getDeriveHandler())({ request });

        expect(result.log).toBeDefined();
    });

    it("should emit on successful response via onAfterHandle", async () => {
        expect.assertions(2);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const elysia = createMockElysia();

        pailPlugin(elysia as any, { pail });

        const request = createMockRequest();

        getHandler(elysia.getDeriveHandler())({ request });
        await getHandler(elysia.getAfterHandleHandler())({ request, set: { status: 200 } });

        expect(consoleSpy).toHaveBeenCalledTimes(1);

        const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

        expect(emitted.status).toBe(200);
    });

    it("should emit on error via onError", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const errorSpy = vi.spyOn(console, "error");
        const elysia = createMockElysia();

        pailPlugin(elysia as any, { pail });

        const request = createMockRequest();

        getHandler(elysia.getDeriveHandler())({ request });
        await getHandler(elysia.getErrorHandler())({ error: new Error("handler error"), request });

        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("should not double-emit if both onError and onAfterHandle fire", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const errorSpy = vi.spyOn(console, "error");
        const consoleSpy = vi.spyOn(console, "log");
        const elysia = createMockElysia();

        pailPlugin(elysia as any, { pail });

        const request = createMockRequest();

        getHandler(elysia.getDeriveHandler())({ request });
        await getHandler(elysia.getErrorHandler())({ error: new Error("handler error"), request });
        await getHandler(elysia.getAfterHandleHandler())({ request, set: { status: 500 } });

        expect(errorSpy.mock.calls.length + consoleSpy.mock.calls.length).toBe(1);
    });

    it("should skip excluded routes", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const elysia = createMockElysia();

        pailPlugin(elysia as any, { exclude: ["/health"], pail });

        const request = createMockRequest("/health");

        getHandler(elysia.getDeriveHandler())({ request });
        await getHandler(elysia.getAfterHandleHandler())({ request, set: { status: 200 } });

        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should default to status 200 when set.status is undefined", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const elysia = createMockElysia();

        pailPlugin(elysia as any, { pail });

        const request = createMockRequest();

        getHandler(elysia.getDeriveHandler())({ request });
        await getHandler(elysia.getAfterHandleHandler())({ request, set: {} });

        const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

        expect(emitted.status).toBe(200);
    });

    it("should return the active logger from useLogger inside the request context", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const elysia = createMockElysia();

        pailPlugin(elysia as any, { pail });

        const request = createMockRequest();

        getHandler(elysia.getDeriveHandler())({ request });

        // The derive handler calls storage.enterWith(), so useLogger() resolves the active logger.
        expect(useLogger()).toBeDefined();
    });

    it("should not emit again when onError fires after onAfterHandle already emitted", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const errorSpy = vi.spyOn(console, "error");
        const elysia = createMockElysia();

        pailPlugin(elysia as any, { pail });

        const request = createMockRequest();

        getHandler(elysia.getDeriveHandler())({ request });
        await getHandler(elysia.getAfterHandleHandler())({ request, set: { status: 200 } });
        await getHandler(elysia.getErrorHandler())({ error: new Error("late error"), request });

        // onError must short-circuit once the request was already emitted by onAfterHandle.
        expect(consoleSpy.mock.calls.length + errorSpy.mock.calls.length).toBe(1);
    });

    it("should throw when useLogger is called outside context", async () => {
        expect.assertions(1);

        // Reset modules to get a fresh AsyncLocalStorage instance,
        // since enterWith() leaks store state across tests.
        vi.resetModules();

        const { useLogger: freshUseLogger } = await import("../../../src/middleware/elysia");

        expect(() => freshUseLogger()).toThrow("[pail]");
    });
});
