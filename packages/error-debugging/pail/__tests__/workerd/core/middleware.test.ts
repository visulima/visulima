import { AsyncLocalStorage } from "node:async_hooks";

import { describe, expect, it } from "vitest";

import { pailPlugin, useLogger as useElysiaLogger } from "../../../src/middleware/elysia";
import type { PailHonoContext } from "../../../src/middleware/hono";
import { pailMiddleware as honoMiddleware, useLogger as useHonoLogger } from "../../../src/middleware/hono";
import { createWithPail } from "../../../src/middleware/next/handler";
import { useLogger as useNextLogger } from "../../../src/middleware/next/storage";
import { extractSafeHeaders } from "../../../src/middleware/shared/headers";
import { createLoggerStorage } from "../../../src/middleware/shared/storage";
import type { PailBrowserType } from "../../../src/pail.browser";
import { PailBrowser } from "../../../src/pail.browser";
import { MetaCaptureReporter } from "./helpers";

const createLogger = (): { logger: PailBrowserType; reporter: MetaCaptureReporter } => {
    const reporter = new MetaCaptureReporter();
    const logger = new PailBrowser({ reporters: [reporter], throttle: 0 });

    return { logger, reporter };
};

const createHonoContext = (path: string, headers: Record<string, string> = {}): PailHonoContext => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments -- `Map`'s value parameter has no default in lib.es2015.collection.d.ts; typescript-eslint misreads it as `unknown` under TypeScript 6, and omitting it is a hard `tsc` error (TS2743).
    const store = new Map<string, unknown>();
    const requestHeaders = new Headers(headers);

    return {
        get: (key: string) => store.get(key),
        req: {
            header: (name: string) => requestHeaders.get(name) ?? undefined,
            method: "GET",
            path,
            raw: { headers: requestHeaders },
        },
        res: { status: 200 },
        set: (key: string, value: unknown) => {
            store.set(key, value);
        },
    };
};

const ENTER_WITH_REGEX = /enterWith/;
const UUID_REGEX = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/;

interface ElysiaHooks {
    afterHandle?: (context: { request: Request; set: { status?: number } }) => Promise<void>;
    derive?: (context: { request: Request }) => Record<string, unknown>;
}

const registerElysiaPlugin = (): { hooks: ElysiaHooks; reporter: MetaCaptureReporter } => {
    const { logger, reporter } = createLogger();
    const hooks: ElysiaHooks = {};

    const app = {
        derive: (_options: { as: string }, handler: (context: { request: Request }) => Record<string, unknown>) => {
            hooks.derive = handler;

            return app;
        },
        onAfterHandle: (_options: { as: string }, handler: (context: { request: Request; set: { status?: number } }) => Promise<void>) => {
            hooks.afterHandle = handler;

            return app;
        },
        onError: () => app,
    } as never;

    pailPlugin(app, { pail: logger as never });

    return { hooks, reporter };
};

describe("middleware in workerd", () => {
    describe("node:async_hooks storage", () => {
        it("propagates the store across awaited boundaries", async () => {
            expect.assertions(2);

            const { storage, useLogger } = createLoggerStorage("test context");
            const event = { name: "scoped" } as never;

            const seen = await storage.run(event, async () => {
                await new Promise((resolve) => {
                    setTimeout(resolve, 1);
                });

                return useLogger();
            });

            expect(seen).toBe(event);
            expect(storage.getStore()).toBeUndefined();
        });

        it("throws an actionable error outside of a request scope", () => {
            expect.assertions(1);

            const { useLogger } = createLoggerStorage("Express middleware context");

            expect(() => useLogger()).toThrow("[pail] useLogger() called outside of Express middleware context");
        });

        it("does not implement AsyncLocalStorage.enterWith()", () => {
            expect.assertions(1);

            const storage = new AsyncLocalStorage<string>();

            // Documented workerd limitation: `run()` is supported but `enterWith()` is not.
            // Anything in pail that relied on it has to degrade instead of throwing.
            expect(() => {
                storage.enterWith("value");
            }).toThrow(ENTER_WITH_REGEX);
        });
    });

    describe("next handler", () => {
        it("runs the handler inside AsyncLocalStorage and emits one wide event", async () => {
            expect.assertions(3);

            const { logger, reporter } = createLogger();
            const withPail = createWithPail({ pail: logger as never });

            const handler = withPail(async (_request: Request) => {
                const log = useNextLogger();

                log.set({ handled: true });

                await new Promise((resolve) => {
                    setTimeout(resolve, 1);
                });

                return new Response("ok", { status: 201 });
            });

            const response = await handler(new Request("https://example.com/api/users", { headers: { "x-request-id": "req-1" } }));
            const payload = reporter.metas[0].message as Record<string, unknown>;

            expect(response.status).toBe(201);
            expect(payload.requestId).toBe("req-1");
            expect({ handled: payload.handled, path: payload.path, status: payload.status }).toStrictEqual({
                handled: true,
                path: "/api/users",
                status: 201,
            });
        });

        it("emits the wide event with the error when the handler throws", async () => {
            expect.assertions(2);

            const { logger, reporter } = createLogger();
            const withPail = createWithPail({ pail: logger as never });

            const handler = withPail((_request: Request) => {
                throw new Error("handler exploded");
            });

            await expect(handler(new Request("https://example.com/api/boom"))).rejects.toThrow("handler exploded");

            const payload = reporter.metas[0].message as { error: { message: string }; status: number };

            expect({ message: payload.error.message, status: payload.status }).toStrictEqual({ message: "handler exploded", status: 500 });
        });
    });

    describe("hono middleware", () => {
        it("uses web-standard Headers and crypto.randomUUID", async () => {
            expect.assertions(3);

            const { logger, reporter } = createLogger();
            const middleware = honoMiddleware({ pail: logger as never });
            const context = createHonoContext("/api/items", { authorization: "Bearer secret", "x-tenant": "acme" });

            await middleware(context, async () => {
                const log = useHonoLogger(context);

                log.set({ items: 2 });
            });

            const payload = reporter.metas[0].message as { headers: Record<string, string>; items: number; requestId: string };

            expect(payload.items).toBe(2);
            expect(payload.headers).toStrictEqual({ "x-tenant": "acme" });
            // No `x-request-id` header was sent, so the middleware falls back to Web Crypto.
            expect(payload.requestId).toMatch(UUID_REGEX);
        });

        it("skips excluded routes without emitting", async () => {
            expect.assertions(1);

            const { logger, reporter } = createLogger();
            const middleware = honoMiddleware({ exclude: ["/health"], pail: logger as never });

            await middleware(createHonoContext("/health"), async () => {});

            expect(reporter.metas).toStrictEqual([]);
        });
    });

    describe("elysia plugin", () => {
        it("still injects the logger into the handler context on runtimes without enterWith()", async () => {
            expect.assertions(2);

            const { hooks, reporter } = registerElysiaPlugin();
            const request = new Request("https://example.com/api/orders");
            const derived = hooks.derive?.({ request }) as { log: { set: (data: Record<string, unknown>) => void } };

            derived.log.set({ orders: 4 });

            await hooks.afterHandle?.({ request, set: { status: 200 } });

            const payload = reporter.metas[0].message as { orders: number; path: string };

            expect(payload.orders).toBe(4);
            expect(payload.path).toBe("/api/orders");
        });

        it("reports that the ambient useLogger() accessor is unavailable", () => {
            expect.assertions(1);

            const { hooks } = registerElysiaPlugin();

            hooks.derive?.({ request: new Request("https://example.com/api/orders") });

            // `useLogger()` needs `AsyncLocalStorage.enterWith()`, which workerd does not
            // implement — the accessor must explain that rather than surfacing a generic
            // "outside of plugin context" error.
            expect(() => useElysiaLogger()).toThrow(ENTER_WITH_REGEX);
        });
    });

    describe("shared headers", () => {
        it("filters sensitive entries from a web-standard Headers object", () => {
            expect.assertions(1);

            const headers = new Headers({
                authorization: "Bearer secret",
                cookie: "session=1",
                "x-api-key": "key",
                "x-trace": "abc",
            });

            expect(extractSafeHeaders(headers)).toStrictEqual({ "x-trace": "abc" });
        });
    });
});
