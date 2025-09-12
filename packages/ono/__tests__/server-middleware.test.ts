import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";
import { createServer, get as httpGet } from "node:http";

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { createNodeHttpHandler, createOpenInEditorMiddleware } from "../src/server/open-in-editor";

describe("server middleware", () => {
    describe(createOpenInEditorMiddleware, () => {
        it("should create middleware function", () => {
            expect.assertions(0);

            const middleware = createOpenInEditorMiddleware();

            expectTypeOf(middleware).toBeFunction();
        });

        it.skipIf(process.env.CI)("should handle POST requests with JSON body", async () => {
            expect.assertions(1);

            const middleware = createOpenInEditorMiddleware();

            const mockRequest = {
                method: "POST",
                // eslint-disable-next-line vitest/require-mock-type-parameters
                on: vi.fn(),
                url: "/",
            } as any;

            // Mock the event listeners synchronously
            // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
            mockRequest.on.mockImplementation((event: string, callback: Function) => {
                if (event === "data") {
                    callback("{\"file\": \"src/index.ts\", \"line\": 10, \"column\": 5}");
                } else if (event === "end") {
                    callback();
                }
            });

            const mockResponse = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                end: vi.fn(),
                statusCode: 200,
            } as any;

            // eslint-disable-next-line vitest/require-mock-type-parameters
            const next = vi.fn();

            await middleware(mockRequest, mockResponse, next);

            expect(mockRequest.url).toMatch(/\/\?column=\d+&file=.+&line=\d+/);
        });

        it("should handle GET requests with query parameters", async () => {
            expect.assertions(1);

            const middleware = createOpenInEditorMiddleware();

            const mockRequest = {
                method: "GET",
                url: "/?file=/test.js&line=10&column=5&editor=vscode",
            } as any;

            const mockResponse = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                end: vi.fn(),
                statusCode: 200,
            } as any;

            // eslint-disable-next-line vitest/require-mock-type-parameters
            const next = vi.fn();

            await middleware(mockRequest, mockResponse, next);

            expect(mockRequest.url).toMatch(/\/\?file=.+&line=.+&column=.+&editor=.+/);
        });

        it("should handle missing file parameter", async () => {
            expect.assertions(2);

            const middleware = createOpenInEditorMiddleware();

            const mockRequest = {
                method: "GET",
                url: "/?line=10&column=5",
            } as any;

            const mockResponse = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                end: vi.fn(),
                statusCode: 200,
                // eslint-disable-next-line vitest/require-mock-type-parameters
                writeHead: vi.fn(),
            } as any;

            // eslint-disable-next-line vitest/require-mock-type-parameters
            const next = vi.fn();

            await middleware(mockRequest, mockResponse, next);

            expect(mockResponse.statusCode).toBe(400);
            expect(mockResponse.end).toHaveBeenCalledWith("Failed to open editor");
        });

        it("should respect project root configuration", async () => {
            expect.assertions(1);

            const middleware = createOpenInEditorMiddleware({
                allowOutsideProject: false,
                projectRoot: "/project",
            });

            const mockRequest = {
                method: "GET",
                url: "/?file=/project/src/test.js&line=10",
            } as any;

            const mockResponse = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                end: vi.fn(),
                statusCode: 200,
            } as any;

            // eslint-disable-next-line vitest/require-mock-type-parameters
            const next = vi.fn();

            await middleware(mockRequest, mockResponse, next);

            expect(mockRequest.url).toContain("file=");
        });

        it("should reject files outside project root when not allowed", async () => {
            expect.assertions(1);

            const middleware = createOpenInEditorMiddleware({
                allowOutsideProject: false,
                projectRoot: "/project",
            });

            const mockRequest = {
                method: "GET",
                url: "/?file=/outside/test.js&line=10",
            } as any;

            const mockResponse = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                end: vi.fn(),
                statusCode: 200,
                // eslint-disable-next-line vitest/require-mock-type-parameters
                writeHead: vi.fn(),
            } as any;

            // eslint-disable-next-line vitest/require-mock-type-parameters
            const next = vi.fn();

            await middleware(mockRequest, mockResponse, next);

            expect(mockResponse.statusCode).toBe(400);
        });

        it("should allow files outside project root when explicitly allowed", async () => {
            expect.assertions(1);

            const middleware = createOpenInEditorMiddleware({
                allowOutsideProject: true,
                projectRoot: "/project",
            });

            const mockRequest = {
                method: "GET",
                url: "/?file=/outside/test.js&line=10",
            } as any;

            const mockResponse = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                end: vi.fn(),
                statusCode: 200,
            } as any;

            // eslint-disable-next-line vitest/require-mock-type-parameters
            const next = vi.fn();

            await middleware(mockRequest, mockResponse, next);

            expect(mockRequest.url).toContain("file=");
        });

        it("should handle Express-style requests with parsed body", async () => {
            expect.assertions(1);

            const middleware = createOpenInEditorMiddleware();

            const mockRequest = {
                body: {
                    column: 5,
                    editor: "vscode",
                    file: "src/index.ts",
                    line: 10,
                },
                method: "POST",
                url: "/",
            } as any;

            const mockResponse = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                end: vi.fn(),
                statusCode: 200,
            } as any;

            // eslint-disable-next-line vitest/require-mock-type-parameters
            const next = vi.fn();

            await middleware(mockRequest, mockResponse, next);

            expect(mockRequest.url).toMatch(/\/\?column=\d+&file=.+&line=\d+&editor=.+/);
        });

        it("should handle malformed JSON gracefully", async () => {
            expect.assertions(1);

            const middleware = createOpenInEditorMiddleware();

            const mockRequest = {
                method: "POST",
                // eslint-disable-next-line vitest/require-mock-type-parameters
                on: vi.fn((event, callback) => {
                    if (event === "data")
                        callback("{invalid json");

                    if (event === "end")
                        callback();
                }),
                url: "/",
            } as any;

            const mockResponse = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                end: vi.fn(),
                statusCode: 200,
                // eslint-disable-next-line vitest/require-mock-type-parameters
                writeHead: vi.fn(),
            } as any;

            // eslint-disable-next-line vitest/require-mock-type-parameters
            const next = vi.fn();

            await middleware(mockRequest, mockResponse, next);

            expect(mockResponse.statusCode).toBe(400);
        });

        it("should handle request errors gracefully", async () => {
            expect.assertions(1);

            const middleware = createOpenInEditorMiddleware();

            const mockRequest = {
                method: "POST",
                // eslint-disable-next-line vitest/require-mock-type-parameters
                on: vi.fn(() => {
                    throw new Error("Request error");
                }),
                url: "/",
            } as any;

            const mockResponse = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                end: vi.fn(),
                statusCode: 200,
                // eslint-disable-next-line vitest/require-mock-type-parameters
                writeHead: vi.fn(),
            } as any;

            // eslint-disable-next-line vitest/require-mock-type-parameters
            const next = vi.fn();

            await middleware(mockRequest, mockResponse, next);

            expect(mockResponse.statusCode).toBe(400);
        });
    });

    describe(createNodeHttpHandler, () => {
        it("should create Node.js HTTP handler", () => {
            expect.assertions(0);

            const handler = createNodeHttpHandler();

            expectTypeOf(handler).toBeFunction();
        });

        it("should handle Node.js HTTP requests", async () => {
            expect.assertions(1);

            const handler = createNodeHttpHandler();

            const mockRequest = {
                method: "GET",
                // eslint-disable-next-line vitest/require-mock-type-parameters
                on: vi.fn((event, callback) => {
                    if (event === "data")
                        callback("");

                    if (event === "end")
                        callback();
                }),
                url: "/?file=/test.js&line=10",
            } as any;

            const mockResponse = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                end: vi.fn(),
                statusCode: 200,
            } as any;

            await handler(mockRequest, mockResponse);

            expect(mockRequest.url).toContain("file=");
        });
    });

    describe("integration with HTTP server", () => {
        it.skipIf(process.env.CI)("should work as middleware in HTTP server", async () => {
            expect.assertions(1);

            const middleware = createOpenInEditorMiddleware();

            let capturedRequest: any;

            // Override the middleware to capture calls
            const testMiddleware = (request: any, response: any, next: any) => {
                capturedRequest = request;

                middleware(request, response, next);
            };

            const server = createServer(testMiddleware as RequestListener<typeof IncomingMessage, typeof ServerResponse>);

            // eslint-disable-next-line vitest/no-test-return-statement
            return new Promise<void>((resolve) => {
                server.listen(0, () => {
                    const { port } = server.address() as any;

                    // Make a request

                    const request = httpGet(`http://localhost:${port}/?file=/test.js&line=10`, (response: any) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        let data = "";

                        response.on("data", (chunk: any) => {
                            data += chunk;
                        });

                        response.on("end", () => {
                            server.close();

                            expect(capturedRequest.url).toContain("file=");

                            resolve();
                        });
                    });

                    request.on("error", () => {
                        server.close();
                        resolve();
                    });
                });
            });
        });
    });
});
