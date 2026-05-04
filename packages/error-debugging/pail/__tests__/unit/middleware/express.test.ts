import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pailMiddleware, useLogger } from "../../../src/middleware/express";
import { PailBrowser } from "../../../src/pail.browser";
import RawReporter from "../../../src/reporter/raw/raw-reporter.browser";

const createMockPail = () =>
    new PailBrowser({
        logLevel: "debug",
        processors: [],
        rawReporter: new RawReporter(),
        reporters: [new RawReporter()],
    });

const createMockRequest = (overrides?: Record<string, unknown>) => {
    return {
        headers: { "content-type": "application/json" } as Record<string, string | string[] | undefined>,
        method: "GET",
        originalUrl: "/api/users",
        path: "/api/users",
        ...overrides,
    };
};

const createMockResponse = () => {
    const listeners: Record<string, (() => void)[]> = {};

    return {
        on: (event: string, listener: () => void) => {
            if (!listeners[event]) {
                listeners[event] = [];
            }

            (listeners[event] as (() => void)[]).push(listener);
        },
        statusCode: 200,
        trigger: (event: string) => {
            for (const listener of listeners[event] ?? []) {
                listener();
            }
        },
    };
};

describe("express middleware", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should attach logger to req.log", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const middleware = pailMiddleware({ pail });
        const request = createMockRequest();
        const response = createMockResponse();

        middleware(request, response, () => {});

        expect(request.log).toBeDefined();
    });

    it("should emit on response finish", () => {
        expect.assertions(2);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const middleware = pailMiddleware({ pail });
        const request = createMockRequest();
        const response = createMockResponse();

        middleware(request, response, () => {});
        response.trigger("finish");

        expect(consoleSpy).toHaveBeenCalledTimes(1);

        const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

        expect(emitted.status).toBe(200);
    });

    it("should skip excluded routes", () => {
        expect.assertions(2);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const middleware = pailMiddleware({ exclude: ["/health"], pail });
        const request = createMockRequest({ originalUrl: "/health", path: "/health" });
        const response = createMockResponse();
        let nextCalled = false;

        middleware(request, response, () => {
            nextCalled = true;
        });

        response.trigger("finish");

        expect(nextCalled).toBe(true);
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should make logger available via useLogger in async context", async () => {
        expect.assertions(1);

        const pail = createMockPail();
        const middleware = pailMiddleware({ pail });
        const request = createMockRequest();
        const response = createMockResponse();

        await new Promise<void>((resolve) => {
            middleware(request, response, () => {
                const log = useLogger();

                expect(log).toBe(request.log);

                resolve();
            });
        });
    });

    it("should use x-request-id header when present", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const middleware = pailMiddleware({ pail });
        const request = createMockRequest({
            headers: { "x-request-id": "custom-id-123" },
        });
        const response = createMockResponse();

        middleware(request, response, () => {});

        const data = (request.log as { getData: () => unknown }).getData() as Record<string, unknown>;

        expect(data.requestId).toBe("custom-id-123");
    });

    it("should call next()", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const middleware = pailMiddleware({ pail });
        const request = createMockRequest();
        const response = createMockResponse();
        let nextCalled = false;

        middleware(request, response, () => {
            nextCalled = true;
        });

        expect(nextCalled).toBe(true);
    });
});
