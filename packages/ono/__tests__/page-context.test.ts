import { describe, expect, it, vi } from "vitest";

import { createRequestContextPage } from "../src/error-inspector/page/context";

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
            } as any;

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
            } as any;

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
            } as any;

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
            } as any;

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
            } as any;

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
            } as any;

            const page = await createRequestContextPage(mockRequest, {
                headerDenylist: ["authorization"],
            });

            expect(page?.code.html).toContain("test-agent");
            expect(page?.code.html).toContain("application/json");
            expect(page?.code.html).toContain("[masked]"); // authorization should be masked
        });

        it("should handle cookies", async () => {
            expect.assertions(4);

            const mockRequest = {
                headers: {
                    cookie: "session=abc123; user=john",
                },
                method: "GET",
                url: "http://example.com/test",
            } as any;

            const page = await createRequestContextPage(mockRequest, {});

            expect(page?.code.html).toContain("session");
            expect(page?.code.html).toContain("abc123");
            expect(page?.code.html).toContain("user");
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
            } as any;

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
            } as any;

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
            } as any;

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
            } as any;

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
            } as any;

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
            } as any;

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
                on: vi.fn((event, callback) => {
                    if (event === "data") {
                        // Send the large body in chunks
                        const chunks = largeBody.match(/.{1,10000}/g) || [];

                        chunks.forEach((chunk) => setTimeout(() => callback(chunk), 0));
                    } else if (event === "end") {
                        setTimeout(() => callback(), 0);
                    }
                }),
                url: "http://example.com/api",
            } as any;

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
            } as any;

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
            } as any;

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
    });
});
