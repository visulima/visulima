import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pailMiddleware, useLogger } from "../../../src/middleware/hono";
import { PailBrowser } from "../../../src/pail.browser";
import RawReporter from "../../../src/reporter/raw/raw-reporter.browser";

const createMockPail = () =>
    new PailBrowser({
        logLevel: "debug",
        processors: [],
        rawReporter: new RawReporter(),
        reporters: [new RawReporter()],
    });

const createMockContext = (overrides?: { headers?: Record<string, string>; method?: string; path?: string }) => {
    const store: Record<string, unknown> = {};
    const headers = new Headers(overrides?.headers ?? {});

    return {
        get: (key: string) => store[key],
        req: {
            header: (name: string) => headers.get(name) ?? undefined,
            method: overrides?.method ?? "GET",
            path: overrides?.path ?? "/api/users",
            raw: { headers },
        },
        res: { status: 200 },
        set: (key: string, value: unknown) => {
            store[key] = value;
        },
    };
};

describe("hono middleware", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should set logger on context", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const middleware = pailMiddleware({ pail });
        const c = createMockContext();

        await middleware(c, async () => {});

        expect(c.get("log")).toBeDefined();
    });

    it("should emit on successful response", async () => {
        expect.assertions(2);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const middleware = pailMiddleware({ pail });
        const c = createMockContext();

        await middleware(c, async () => {});

        expect(consoleSpy).toHaveBeenCalledTimes(1);

        const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

        expect(emitted.status).toBe(200);
    });

    it("should emit on error and re-throw", async () => {
        expect.assertions(2);

        const pail = createMockPail();
        const errorSpy = vi.spyOn(console, "error");
        const middleware = pailMiddleware({ pail });
        const c = createMockContext();

        await expect(
            middleware(c as any, async () => {
                throw new Error("handler error");
            }),
        ).rejects.toThrow("handler error");

        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("should skip excluded routes", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const middleware = pailMiddleware({ exclude: ["/health"], pail });
        const c = createMockContext({ path: "/health" });

        await middleware(c, async () => {});

        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should provide logger via useLogger helper", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const middleware = pailMiddleware({ pail });
        const c = createMockContext();

        await middleware(c, async () => {
            const log = useLogger(c);

            expect(log).toBeDefined();
        });
    });

    it("should throw when useLogger is called without middleware", () => {
        expect.assertions(1);

        const c = createMockContext();

        expect(() => useLogger(c as any)).toThrow("[pail]");
    });
});
