import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWithPail, useLogger } from "../../../src/middleware/next/handler";
import { pailMiddleware } from "../../../src/middleware/next/middleware";
import { PailBrowser } from "../../../src/pail.browser";
import RawReporter from "../../../src/reporter/raw/raw-reporter.browser";

const createMockPail = () =>
    new PailBrowser({
        logLevel: "debug",
        processors: [],
        rawReporter: new RawReporter(),
        reporters: [new RawReporter()],
    });

describe("next.js adapter", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe(createWithPail, () => {
        it("should wrap a handler and emit on success", async () => {
            expect.assertions(2);

            const pail = createMockPail();
            const consoleSpy = vi.spyOn(console, "log");
            const withPail = createWithPail({ pail });

            const handler = withPail(async (_request: Request) => Response.json({ ok: true }));

            const request = new Request("http://localhost/api/users", { method: "GET" });

            await handler(request);

            expect(consoleSpy).toHaveBeenCalledTimes(1);

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted.status).toBe(200);
        });

        it("should emit on error and re-throw", async () => {
            expect.assertions(2);

            const pail = createMockPail();
            const errorSpy = vi.spyOn(console, "error");
            const withPail = createWithPail({ pail });

            const handler = withPail(async () => {
                throw new Error("handler error");
            });

            const request = new Request("http://localhost/api/users");

            await expect(handler(request)).rejects.toThrow("handler error");
            expect(errorSpy).toHaveBeenCalledTimes(1);
        });

        it("should wrap a non-Error thrown value before emitting", async () => {
            expect.assertions(2);

            const pail = createMockPail();
            const errorSpy = vi.spyOn(console, "error");
            const withPail = createWithPail({ pail });

            const handler = withPail(async () => {
                // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally throwing a non-Error to exercise the wrapping branch
                throw "string failure";
            });

            const request = new Request("http://localhost/api/users");

            await expect(handler(request)).rejects.toBe("string failure");
            expect(errorSpy).toHaveBeenCalledTimes(1);
        });

        it("should make logger available via useLogger", async () => {
            expect.assertions(1);

            const pail = createMockPail();
            const withPail = createWithPail({ pail });

            const handler = withPail(async () => {
                const log = useLogger();

                expect(log).toBeDefined();

                return new Response("ok");
            });

            await handler(new Request("http://localhost/api/users"));
        });

        it("should extract method and path from Request", async () => {
            expect.assertions(2);

            const pail = createMockPail();
            const consoleSpy = vi.spyOn(console, "log");
            const withPail = createWithPail({ pail });

            const handler = withPail(async () => new Response("ok"));

            await handler(new Request("http://localhost/api/users", { method: "POST" }));

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted.method).toBe("POST");
            expect(emitted.path).toBe("/api/users");
        });

        it("should reuse x-request-id from request headers", async () => {
            expect.assertions(1);

            const pail = createMockPail();
            const consoleSpy = vi.spyOn(console, "log");
            const withPail = createWithPail({ pail });

            const handler = withPail(async () => new Response("ok"));

            const request = new Request("http://localhost/api/users", {
                headers: { "x-request-id": "custom-id" },
            });

            await handler(request);

            const emitted = consoleSpy.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(emitted.requestId).toBe("custom-id");
        });

        it("should skip excluded routes", async () => {
            expect.assertions(1);

            const pail = createMockPail();
            const consoleSpy = vi.spyOn(console, "log");
            const withPail = createWithPail({ exclude: ["/health"], pail });

            const handler = withPail(async () => new Response("ok"));

            await handler(new Request("http://localhost/health"));

            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it("should work with non-Request arguments", async () => {
            expect.assertions(1);

            const pail = createMockPail();
            const consoleSpy = vi.spyOn(console, "log");
            const withPail = createWithPail({ pail });

            const handler = withPail(async (_formData: FormData) => {
                return { success: true };
            });

            await handler(new FormData());

            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe(pailMiddleware, () => {
        it("should set x-request-id and x-pail-start headers", () => {
            expect.assertions(2);

            const MockNextResponse = {
                next: (_options?: { request?: { headers?: Headers } }) => {
                    return {
                        headers: new Headers(),
                    };
                },
            };

            const middleware = pailMiddleware(MockNextResponse);
            const request = {
                headers: new Headers(),
                nextUrl: { pathname: "/api/users" },
            };

            const response = middleware(request);

            expect(response.headers.get("x-request-id")).toBeTypeOf("string");
            expect(response.headers).toBeDefined();
        });

        it("should reuse existing x-request-id", () => {
            expect.assertions(1);

            const capturedHeaders: Headers[] = [];
            const MockNextResponse = {
                next: (options?: { request?: { headers?: Headers } }) => {
                    if (options?.request?.headers) {
                        capturedHeaders.push(options.request.headers);
                    }

                    return { headers: new Headers() };
                },
            };

            const middleware = pailMiddleware(MockNextResponse);
            const request = {
                headers: new Headers({ "x-request-id": "existing-id" }),
                nextUrl: { pathname: "/api/users" },
            };

            middleware(request);

            expect(capturedHeaders[0]?.get("x-request-id")).toBe("existing-id");
        });

        it("should skip excluded paths and call next without rewriting headers", () => {
            expect.assertions(1);

            let nextOptions: unknown = "unset";
            const MockNextResponse = {
                next: (options?: { request?: { headers?: Headers } }) => {
                    nextOptions = options;

                    return { headers: new Headers() };
                },
            };

            const middleware = pailMiddleware(MockNextResponse, { exclude: ["/health/**"] });
            const request = {
                headers: new Headers(),
                nextUrl: { pathname: "/health/live" },
            };

            middleware(request);

            // The excluded path returns NextResponse.next() with no request rewrite.
            expect(nextOptions).toBeUndefined();
        });

        it("should skip paths absent from the include list and call next without rewriting headers", () => {
            expect.assertions(1);

            let nextOptions: unknown = "unset";
            const MockNextResponse = {
                next: (options?: { request?: { headers?: Headers } }) => {
                    nextOptions = options;

                    return { headers: new Headers() };
                },
            };

            const middleware = pailMiddleware(MockNextResponse, { include: ["/api/**"] });
            const request = {
                headers: new Headers(),
                nextUrl: { pathname: "/other" },
            };

            middleware(request);

            // A path outside the include list returns NextResponse.next() with no request rewrite.
            expect(nextOptions).toBeUndefined();
        });
    });

    describe(useLogger, () => {
        it("should throw when called outside withPail context", () => {
            expect.assertions(1);

            expect(() => useLogger()).toThrow("[pail]");
        });
    });
});
