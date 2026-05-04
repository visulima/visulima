import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPailHooks, pailHandle, pailHandleError, useLogger } from "../../../src/middleware/sveltekit";
import { PailBrowser } from "../../../src/pail.browser";
import RawReporter from "../../../src/reporter/raw/raw-reporter.browser";

const createMockPail = () =>
    new PailBrowser({
        logLevel: "debug",
        processors: [],
        rawReporter: new RawReporter(),
        reporters: [new RawReporter()],
    });

const createMockEvent = (overrides?: { method?: string; path?: string }) => {
    return {
        locals: {} as Record<string, unknown>,
        request: new Request(`http://localhost${overrides?.path ?? "/api/users"}`, {
            method: overrides?.method ?? "GET",
        }),
        url: new URL(`http://localhost${overrides?.path ?? "/api/users"}`),
    };
};

describe("svelteKit middleware", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe(pailHandle, () => {
        it("should attach logger to event.locals.log", async () => {
            expect.assertions(1);

            const pail = createMockPail();
            const handle = pailHandle({ pail });
            const event = createMockEvent();

            await handle({
                event,
                resolve: async () => new Response("ok", { status: 200 }),
            });

            expect(event.locals.log).toBeDefined();
        });

        it("should emit on successful response", async () => {
            expect.assertions(2);

            const pail = createMockPail();
            const consoleSpy = vi.spyOn(console, "log");
            const handle = pailHandle({ pail });
            const event = createMockEvent();

            await handle({
                event,
                resolve: async () => new Response("ok", { status: 200 }),
            });

            expect(consoleSpy).toHaveBeenCalledTimes(1);

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted.status).toBe(200);
        });

        it("should emit on error and re-throw", async () => {
            expect.assertions(2);

            const pail = createMockPail();
            const errorSpy = vi.spyOn(console, "error");
            const handle = pailHandle({ pail });
            const event = createMockEvent();

            await expect(
                handle({
                    event: event as any,
                    resolve: async () => {
                        throw new Error("resolve error");
                    },
                }),
            ).rejects.toThrow("resolve error");

            expect(errorSpy).toHaveBeenCalledTimes(1);
        });

        it("should skip excluded routes", async () => {
            expect.assertions(1);

            const pail = createMockPail();
            const consoleSpy = vi.spyOn(console, "log");
            const handle = pailHandle({ exclude: ["/health"], pail });
            const event = createMockEvent({ path: "/health" });

            await handle({
                event,
                resolve: async () => new Response("ok"),
            });

            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it("should make logger available via useLogger", async () => {
            expect.assertions(1);

            const pail = createMockPail();
            const handle = pailHandle({ pail });
            const event = createMockEvent();

            await handle({
                event,
                resolve: async () => {
                    const log = useLogger();

                    expect(log).toBe(event.locals.log);

                    return new Response("ok");
                },
            });
        });
    });

    describe(pailHandleError, () => {
        it("should record error on the logger", async () => {
            expect.assertions(1);

            const pail = createMockPail();
            const handle = pailHandle({ pail });
            const handleError = pailHandleError();
            const event = createMockEvent();

            // First set up the logger via handle
            await handle({
                event,
                resolve: async () => new Response("ok", { status: 200 }),
            });

            const testError = new Error("test error");

            handleError({
                error: testError,
                event,
                message: "test",
                status: 500,
            });

            const logs = (event.locals.log as any).getRequestLogs();

            expect(logs).toHaveLength(1);
        });

        it("should not crash when logger is not present", () => {
            expect.assertions(1);

            const handleError = pailHandleError();
            const event = createMockEvent();

            expect(() => {
                handleError({
                    error: new Error("test"),
                    event,
                    message: "test",
                    status: 500,
                });
            }).not.toThrow();
        });
    });

    describe(createPailHooks, () => {
        it("should return both handle and handleError", () => {
            expect.assertions(2);

            const pail = createMockPail();
            const hooks = createPailHooks({ pail });

            expect(hooks.handle).toBeInstanceOf(Function);
            expect(hooks.handleError).toBeInstanceOf(Function);
        });
    });
});
