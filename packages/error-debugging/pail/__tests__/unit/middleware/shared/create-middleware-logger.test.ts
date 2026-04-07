import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiddlewareLogger } from "../../../../src/middleware/shared/create-middleware-logger";
import { PailBrowser } from "../../../../src/pail.browser";
import RawReporter from "../../../../src/reporter/raw/raw-reporter.browser";

const createMockPail = () =>
    new PailBrowser({
        logLevel: "debug",
        processors: [],
        rawReporter: new RawReporter(),
        reporters: [new RawReporter()],
    });

describe(createMiddlewareLogger, () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should create a logger for a request", () => {
        expect.assertions(3);

        const pail = createMockPail();
        const result = createMiddlewareLogger({ pail }, { method: "GET", path: "/api/users", requestId: "req-123" });

        expect(result.skipped).toBe(false);
        expect(result.logger).toBeDefined();
        expect(result.finish).toBeInstanceOf(Function);
    });

    it("should skip excluded paths", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const result = createMiddlewareLogger({ exclude: ["/health"], pail }, { method: "GET", path: "/health", requestId: "req-123" });

        expect(result.skipped).toBe(true);
    });

    it("should skip non-included paths", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const result = createMiddlewareLogger({ include: ["/api/**"], pail }, { method: "GET", path: "/health", requestId: "req-123" });

        expect(result.skipped).toBe(true);
    });

    it("should not skip included paths", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const result = createMiddlewareLogger({ include: ["/api/**"], pail }, { method: "GET", path: "/api/users", requestId: "req-123" });

        expect(result.skipped).toBe(false);
    });

    it("should set method, path, and requestId on the logger", () => {
        expect.assertions(3);

        const pail = createMockPail();
        const result = createMiddlewareLogger({ pail }, { method: "POST", path: "/api/users", requestId: "req-456" });

        const data = result.logger.getData() as Record<string, unknown>;

        expect(data.method).toBe("POST");
        expect(data.path).toBe("/api/users");
        expect(data.requestId).toBe("req-456");
    });

    it("should include safe headers when provided", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const result = createMiddlewareLogger(
            { pail },
            {
                headers: { "content-type": "application/json" },
                method: "GET",
                path: "/api",
                requestId: "req-1",
            },
        );

        const data = result.logger.getData() as Record<string, unknown>;

        expect(data.headers).toStrictEqual({ "content-type": "application/json" });
    });

    it("should use default service name", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const result = createMiddlewareLogger({ pail, service: "my-service" }, { method: "GET", path: "/api", requestId: "req-1" });

        result.finish({ status: 200 });

        // eslint-disable-next-line no-console
        const emitted = (console.log as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;

        expect(emitted.service).toBe("my-service");
    });

    it("should use route-specific service over default", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const result = createMiddlewareLogger(
            {
                pail,
                routes: { "/api/auth/**": { service: "auth-service" } },
                service: "default-service",
            },
            { method: "GET", path: "/api/auth/login", requestId: "req-1" },
        );

        result.finish({ status: 200 });

        // eslint-disable-next-line no-console
        const emitted = (console.log as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;

        expect(emitted.service).toBe("auth-service");
    });

    it("should set event name to 'METHOD path'", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const result = createMiddlewareLogger({ pail }, { method: "POST", path: "/api/users", requestId: "req-1" });

        expect(result.logger.name).toBe("POST /api/users");
    });

    it("should emit on finish with status", () => {
        expect.assertions(2);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const result = createMiddlewareLogger({ pail }, { method: "GET", path: "/api", requestId: "req-1" });

        result.finish({ status: 200 });

        expect(consoleSpy).toHaveBeenCalledTimes(1);

        const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

        expect(emitted.status).toBe(200);
    });

    it("should emit on finish with error", () => {
        expect.assertions(2);

        const pail = createMockPail();
        const errorSpy = vi.spyOn(console, "error");
        const result = createMiddlewareLogger({ pail }, { method: "GET", path: "/api", requestId: "req-1" });

        result.finish({ error: new Error("test") });

        expect(errorSpy).toHaveBeenCalledTimes(1);

        const emitted = errorSpy.mock.calls[0]?.[0] as Record<string, unknown>;

        expect(emitted.error).toBeDefined();
    });

    it("should only emit once from finish", () => {
        expect.assertions(1);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const result = createMiddlewareLogger({ pail }, { method: "GET", path: "/api", requestId: "req-1" });

        result.finish({ status: 200 });
        result.finish({ status: 500 });

        expect(consoleSpy).toHaveBeenCalledTimes(1);
    });

    it("should provide a noop finish for skipped routes", () => {
        expect.assertions(2);

        const pail = createMockPail();
        const consoleSpy = vi.spyOn(console, "log");
        const result = createMiddlewareLogger({ exclude: ["/health"], pail }, { method: "GET", path: "/health", requestId: "req-1" });

        result.finish({ status: 200 });

        expect(result.skipped).toBe(true);
        expect(consoleSpy).not.toHaveBeenCalled();
    });
});
