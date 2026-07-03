import { describe, expect, it, vi } from "vitest";

import createRequestContextPage from "../src/error-inspector/page/create-request-context";
import type { RequestLike } from "../src/error-inspector/page/types";

describe("context page", () => {
    describe(createRequestContextPage, () => {
        it("should create a context page with basic request info", async () => {
            expect.assertions(5);

            const mockRequest = {
                headers: {
                    "content-type": "application/json",
                    "user-agent": "test-agent",
                },
                method: "GET",
                url: "http://example.com/test",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page).toBeDefined();
            expect(page?.id).toBe("context");
            expect(page?.name).toBe("Context");
            expect(page?.code.html).toContain("Request");
            expect(page?.code.html).toContain("Headers");
        });

        it("should handle request with custom context", async () => {
            expect.assertions(3);

            const mockRequest = {
                headers: {
                    "content-type": "application/json",
                },
                method: "POST",
                url: "http://example.com/api",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {
                context: {
                    database: {
                        queries: ["SELECT * FROM users"],
                        status: "connected",
                    },
                    user: {
                        id: "123",
                        name: "Test User",
                    },
                },
            });

            expect(page?.code.html).toContain("Test User");
            expect(page?.code.html).toContain("connected");
            expect(page?.code.html).toContain("SELECT * FROM users");
        });

        it("should handle request body", async () => {
            expect.assertions(2);

            const mockRequest = {
                headers: {
                    "content-type": "application/json",
                },
                json: () => Promise.resolve({ test: "data" }),
                method: "POST",
                url: "http://example.com/api",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("test");
            expect(page?.code.html).toContain("data");
        });

        it("should handle text request body", async () => {
            expect.assertions(1);

            const mockRequest = {
                headers: {
                    "content-type": "text/plain",
                },
                method: "POST",
                text: () => Promise.resolve("plain text body"),
                url: "http://example.com/api",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("plain text body");
        });

        it("should filter headers based on allowlist", async () => {
            expect.assertions(4);

            const mockRequest = {
                headers: {
                    authorization: "secret-token",
                    "content-type": "application/json",
                    "user-agent": "test-agent",
                    "x-api-key": "secret-key",
                },
                method: "GET",
                url: "http://example.com/test",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {
                headerAllowlist: ["user-agent", "content-type"],
            });

            expect(page?.code.html).toContain("test-agent");
            expect(page?.code.html).toContain("application/json");
            expect(page?.code.html).not.toContain("secret-token");
            expect(page?.code.html).not.toContain("secret-key");
        });

        it("should filter headers based on denylist", async () => {
            expect.assertions(3);

            const mockRequest = {
                headers: {
                    authorization: "secret-token",
                    "content-type": "application/json",
                    "user-agent": "test-agent",
                },
                method: "GET",
                url: "http://example.com/test",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {
                headerDenylist: ["authorization"],
            });

            expect(page?.code.html).toContain("test-agent");
            expect(page?.code.html).toContain("application/json");
            expect(page?.code.html).toContain("[masked]"); // authorization should be masked
        });

        it("should handle cookies, masking values by default", async () => {
            expect.assertions(4);

            const mockRequest = {
                headers: {
                    cookie: "session=abc123; user=john",
                },
                method: "GET",
                url: "http://example.com/test",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            // Cookie names remain visible, but their values are masked (cookies are sensitive by default).
            expect(page?.code.html).toContain("session");
            expect(page?.code.html).toContain("user");
            expect(page?.code.html).not.toContain("abc123");
            expect(page?.code.html).not.toContain("john");
        });

        it("should expose raw cookie values when masking is disabled", async () => {
            expect.assertions(2);

            const mockRequest = {
                headers: {
                    cookie: "session=abc123; user=john",
                },
                method: "GET",
                url: "http://example.com/test",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, { maskValue: "" });

            expect(page?.code.html).toContain("abc123");
            expect(page?.code.html).toContain("john");
        });

        it("should generate cURL command", async () => {
            expect.assertions(4);

            const mockRequest = {
                headers: {
                    authorization: "Bearer token",
                    "content-type": "application/json",
                },
                method: "POST",
                url: "http://example.com/api",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("curl");
            expect(page?.code.html).toContain("-X POST");
            expect(page?.code.html).toContain("http://example.com/api");
            expect(page?.code.html).toContain("[masked]");
        });

        it("should handle different content types for body", async () => {
            expect.assertions(3);

            // Test JSON body
            const jsonRequest = {
                headers: {
                    "content-type": "application/json",
                },
                json: () => Promise.resolve({ message: "hello" }),
                method: "POST",
                url: "http://example.com/api",
            } as RequestLike;

            const jsonPage = await createRequestContextPage(jsonRequest, {});

            expect(jsonPage?.code.html).toContain("\"message\"");
            expect(jsonPage?.code.html).toContain("\"hello\"");

            // Test text body
            const textRequest = {
                headers: {
                    "content-type": "text/plain",
                },
                method: "POST",
                text: () => Promise.resolve("plain text"),
                url: "http://example.com/api",
            } as RequestLike;

            const textPage = await createRequestContextPage(textRequest, {});

            expect(textPage?.code.html).toContain("plain text");
        });

        it("should handle GET requests without body", async () => {
            expect.assertions(3);

            const mockRequest = {
                headers: {
                    "user-agent": "test-agent",
                },
                method: "GET",
                url: "http://example.com/test",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("GET");
            expect(page?.code.html).toContain("http://example.com/test");
            expect(page?.code.html).toContain("test-agent");
        });

        it("should handle malformed request headers", async () => {
            expect.assertions(2);

            const mockRequest = {
                headers: {
                    "malformed-header": undefined,
                    "valid-header": "value",
                },
                method: "GET",
                url: "http://example.com/test",
            } as any as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("valid-header");
            expect(page?.code.html).not.toContain("malformed-header");
        });

        it("should handle request with no headers", async () => {
            expect.assertions(2);

            const mockRequest = {
                headers: undefined,
                method: "GET",
                url: "http://example.com/test",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("Request");
            expect(page?.code.html).toContain("http://example.com/test");
        });

        it("should handle large request bodies with truncation", async () => {
            expect.assertions(1);

            const largeBody = "x".repeat(100_000); // 100KB of data

            const mockRequest = {
                headers: {
                    "content-type": "text/plain",
                },
                method: "POST",
                // eslint-disable-next-line vitest/require-mock-type-parameters
                on: vi.fn((event: string, callback: (chunk?: unknown) => void) => {
                    if (event === "data") {
                        // Send the large body in chunks
                        const chunks = largeBody.match(/.{1,10000}/g) ?? [];

                        for (const chunk of chunks) {
                            setTimeout(() => {
                                callback(chunk);
                            }, 0);
                        }
                    } else if (event === "end") {
                        setTimeout(() => {
                            callback();
                        }, 0);
                    }
                }),
                url: "http://example.com/api",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {
                previewBytes: 1000, // Small limit for testing
            });

            expect(page?.code.html).toContain("… [truncated]");
        });

        it("should handle request body reading errors gracefully", async () => {
            expect.assertions(2);

            const mockRequest = {
                headers: {
                    "content-type": "application/json",
                },
                json: () => Promise.reject(new Error("Parse error")),
                method: "POST",
                url: "http://example.com/api",
            } as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page).toBeDefined();
            expect(page?.code.html).toContain("Request");
        });

        it("should handle complex nested context data", async () => {
            expect.assertions(4);

            const mockRequest = {
                headers: {},
                method: "GET",
                url: "http://example.com/test",
            } as RequestLike;

            const complexContext = {
                app: {
                    routing: {
                        params: { id: "123" },
                        query: { limit: "10", page: "1" },
                        route: "/api/users/:id",
                    },
                    version: "1.0.0",
                },
                performance: {
                    cpu: {
                        cores: 4,
                        usage: 0.15,
                    },
                    memory: {
                        total: "512MB",
                        usage: 0.29,
                        used: "150MB",
                    },
                    uptime: 3_600_000,
                },
                user: {
                    client: {
                        geo: {
                            city: "New York",
                            country: "US",
                        },
                        // eslint-disable-next-line sonarjs/no-hardcoded-ip
                        ip: "192.168.1.1",
                        userAgent: "Mozilla/5.0...",
                    },
                },
            };

            const page = await createRequestContextPage(mockRequest, {
                context: complexContext,
            });

            expect(page?.code.html).toContain("New York");
            expect(page?.code.html).toContain("3600000");
            expect(page?.code.html).toContain("150MB");
            expect(page?.code.html).toContain("0.29");
        });

        it("should read headers and cookies from a Headers-like object exposing entries/get", async () => {
            expect.assertions(3);

            const headerMap: Record<string, string> = {
                "content-type": "application/json",
                cookie: "session=from-headers-obj",
                "x-custom": "header-value",
            };
            const mockRequest = {
                headers: {
                    entries: () => Object.entries(headerMap),
                    forEach: () => {},
                    get: (name: string) => headerMap[name.toLowerCase()] ?? null,
                },
                json: () => Promise.resolve({ via: "headers-object" }),
                method: "POST",
                url: "http://example.com/api",
            } as unknown as RequestLike;

            // maskValue: "" disables masking so the parsed cookie value is observable for this parsing test.
            const page = await createRequestContextPage(mockRequest, { maskValue: "" });

            expect(page?.code.html).toContain("header-value");
            expect(page?.code.html).toContain("from-headers-obj");
            expect(page?.code.html).toContain("headers-object");
        });

        it("should read a cookie header provided as an array", async () => {
            expect.assertions(2);

            const mockRequest = {
                headers: {
                    cookie: ["session=array-cookie; user=jane"],
                },
                method: "GET",
                url: "http://example.com/test",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, { maskValue: "" });

            expect(page?.code.html).toContain("array-cookie");
            expect(page?.code.html).toContain("jane");
        });

        it("should skip malformed cookie pairs that have no equals sign", async () => {
            expect.assertions(2);

            const mockRequest = {
                headers: {
                    cookie: "session=valid; flagonly; user=john",
                },
                method: "GET",
                url: "http://example.com/test",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, { maskValue: "" });

            expect(page?.code.html).toContain("session");
            expect(page?.code.html).toContain("john");
        });

        it("should add cookies to the cURL command when the cookie header is filtered out by the allowlist", async () => {
            expect.assertions(2);

            const mockRequest = {
                headers: {
                    "content-type": "application/json",
                    cookie: "session=curl-cookie",
                },
                method: "GET",
                url: "http://example.com/test",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {
                headerAllowlist: ["content-type"],
                maskValue: "",
            });

            expect(page?.code.html).toContain("Cookie: session=curl-cookie");
            expect(page?.code.html).toContain("curl-cookie");
        });

        it("should fall back to text() after json() rejects", async () => {
            expect.assertions(1);

            const mockRequest = {
                headers: {
                    "content-type": "application/json",
                },
                json: () => Promise.reject(new Error("bad json")),
                method: "POST",
                text: () => Promise.resolve("text fallback body"),
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("text fallback body");
        });

        it("should return no body when text() throws for a non-json request", async () => {
            expect.assertions(1);

            const mockRequest = {
                headers: {
                    "content-type": "text/plain",
                },
                method: "POST",
                text: () => Promise.reject(new Error("text boom")),
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("(no body)");
        });

        it("should render an array request body", async () => {
            expect.assertions(1);

            const mockRequest = {
                headers: { "content-type": "application/json" },
                json: () => Promise.resolve([1, 2, 3]),
                method: "POST",
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("[0]");
        });

        it("should render an empty-array request body", async () => {
            expect.assertions(1);

            const mockRequest = {
                headers: { "content-type": "application/json" },
                json: () => Promise.resolve([]),
                method: "POST",
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("(empty array)");
        });

        it("should render an empty-object request body", async () => {
            expect.assertions(1);

            const mockRequest = {
                headers: { "content-type": "application/json" },
                json: () => Promise.resolve({}),
                method: "POST",
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("(empty object)");
        });

        it("should render a numeric request body", async () => {
            expect.assertions(1);

            const mockRequest = {
                headers: { "content-type": "application/json" },
                json: () => Promise.resolve(42),
                method: "POST",
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("42");
        });

        it("should render an empty-string request body", async () => {
            expect.assertions(1);

            const mockRequest = {
                headers: { "content-type": "text/plain" },
                method: "POST",
                text: () => Promise.resolve(""),
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("(empty string)");
        });

        it("should not throw when serializing a circular request body", async () => {
            expect.assertions(2);

            const circular: Record<string, unknown> = { name: "loop" };

            circular.self = circular;

            const mockRequest = {
                headers: { "content-type": "application/json" },
                json: () => Promise.resolve(circular),
                method: "POST",
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page).toBeDefined();
            expect(page?.code.html).toContain("loop");
        });

        it("should render nullish, empty, function and symbol values from the session", async () => {
            expect.assertions(3);

            const mockRequest = {
                headers: {},
                method: "GET",
                session: {
                    emptyArr: [],
                    emptyObj: {},
                    handler: function namedHandler() {},
                    nul: null,
                    sym: Symbol("session-symbol"),
                    undef: undefined,
                },
                url: "http://example.com/test",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("null");
            expect(page?.code.html).toContain("(empty object)");
            expect(page?.code.html).toContain("namedHandler");
        });

        it("should cap rendering depth and item counts for deeply nested context", async () => {
            expect.assertions(2);

            const mockRequest = {
                headers: {},
                method: "GET",
                url: "http://example.com/test",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {
                context: {
                    data: {
                        deepArray: [[[["too deep"]]]],
                        deepObject: { l1: { l2: { l3: { l4: "too deep" } } } },
                        manyItems: Array.from({ length: 12 }, (_, index) => index),
                        manyKeys: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`k${String(index)}`, index])),
                    },
                },
            });

            expect(page?.code.html).toContain("more keys");
            expect(page?.code.html).toContain("more items");
        });

        it("should produce empty context sections when only the excluded request key is present", async () => {
            expect.assertions(1);

            const mockRequest = {
                headers: {},
                method: "GET",
                url: "http://example.com/test",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {
                context: { request: { ignoredContextKey: true } },
            });

            expect(page?.code.html).not.toContain("ignoredContextKey");
        });

        it("should read the body from clone() when the request exposes one", async () => {
            expect.assertions(1);

            const mockRequest = {
                clone: () => {
                    return {
                        headers: { "content-type": "application/json" },
                        json: () => Promise.resolve({ from: "cloned-request" }),
                    };
                },
                headers: { "content-type": "application/json" },
                method: "POST",
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("cloned-request");
        });

        it("should read a small Node IncomingMessage body and resolve on end", async () => {
            expect.assertions(1);

            const handlers: Record<string, (chunk?: unknown) => void> = {};
            const mockRequest = {
                headers: { "content-type": "text/plain" },
                method: "POST",
                off: () => {},
                on: (event: string, callback: (chunk?: unknown) => void) => {
                    handlers[event] = callback;

                    if (event === "data") {
                        setTimeout(callback, 0, "incoming body");
                    }

                    if (event === "end") {
                        setTimeout(callback, 0);
                    }
                },
                setEncoding: () => {},
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("incoming body");
        });

        it("should resolve with no body when a Node IncomingMessage emits an error", async () => {
            expect.assertions(1);

            const mockRequest = {
                headers: { "content-type": "text/plain" },
                method: "POST",
                off: () => {},
                on: (event: string, callback: (chunk?: unknown) => void) => {
                    if (event === "error") {
                        setTimeout(callback, 0);
                    }
                },
                setEncoding: () => {},
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("(no body)");
        });
    });

    describe("sensitive data masking", () => {
        it("should not leak raw cookie values into the copyable cURL when a Cookie-cased header is present", async () => {
            expect.assertions(2);

            const mockRequest = {
                headers: {
                    // Capitalized header name — the case-insensitive guard must treat it as the cookie header.
                    Cookie: "session=topsecret",
                },
                method: "GET",
                url: "http://example.com/test",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).not.toContain("topsecret");
            expect(page?.code.html).toContain("[masked]");
        });

        it("should mask sensitive-looking keys inside the request body", async () => {
            expect.assertions(3);

            const mockRequest = {
                headers: {
                    "content-type": "application/json",
                },
                json: () => Promise.resolve({ password: "hunter2", token: "abc.def", username: "alice" }),
                method: "POST",
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            // Non-sensitive fields stay visible, sensitive ones are masked everywhere (body panel + cURL --data).
            expect(page?.code.html).toContain("alice");
            expect(page?.code.html).not.toContain("hunter2");
            expect(page?.code.html).not.toContain("abc.def");
        });

        it("should mask credential-shaped keys nested deep inside the request body", async () => {
            expect.assertions(5);

            const mockRequest = {
                headers: {
                    "content-type": "application/json",
                },
                json: () =>
                    Promise.resolve({
                        user: {
                            credentials: [{ apiKey: "ak_live_123", authorization: "Bearer xyz" }],
                            name: "alice",
                            profile: { secret: "s3cr3t" },
                        },
                    }),
                method: "POST",
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, {});

            // Non-sensitive value is preserved.
            expect(page?.code.html).toContain("alice");
            // Every nested credential-shaped value is masked everywhere it surfaces (body panel + cURL --data + clipboard input).
            expect(page?.code.html).not.toContain("ak_live_123");
            expect(page?.code.html).not.toContain("Bearer xyz");
            expect(page?.code.html).not.toContain("s3cr3t");
            expect(page?.code.html).toContain("[masked]");
        });

        it("should leave the body untouched when masking is disabled", async () => {
            expect.assertions(2);

            const mockRequest = {
                headers: {
                    "content-type": "application/json",
                },
                json: () => Promise.resolve({ password: "hunter2" }),
                method: "POST",
                url: "http://example.com/api",
            } as unknown as RequestLike;

            const page = await createRequestContextPage(mockRequest, { maskValue: "" });

            expect(page?.code.html).toContain("hunter2");
            expect(page?.code.html).not.toContain("[masked]");
        });
    });
});
