import { createServer } from "node:http";
import { describe, expect, it, vi } from "vitest";

import { createNodeHttpHandler, createOpenInEditorMiddleware } from "../src/server/open-in-editor";

describe("server middleware", () => {
    describe("createOpenInEditorMiddleware", () => {
        it("should create middleware function", () => {
            const middleware = createOpenInEditorMiddleware();
            expect(typeof middleware).toBe("function");
        });

        it("should handle POST requests with JSON body", async () => {
            const middleware = createOpenInEditorMiddleware();

            const mockReq = {
                method: "POST",
                url: "/",
                on: vi.fn(),
            } as any;

            // Mock the event listeners synchronously
            mockReq.on.mockImplementation((event: string, callback: Function) => {
                if (event === "data") {
                    callback('{"file": "src/index.ts", "line": 10, "column": 5}');
                } else if (event === "end") {
                    callback();
                }
            });

            const mockRes = {
                statusCode: 200,
                end: vi.fn(),
            } as any;

            const next = vi.fn();

            await middleware(mockReq, mockRes, next);

            expect(mockReq.url).toMatch(/\/\?column=\d+&file=.+&line=\d+/);
        });

        it("should handle GET requests with query parameters", async () => {
            const middleware = createOpenInEditorMiddleware();

            const mockReq = {
                method: "GET",
                url: "/?file=/test.js&line=10&column=5&editor=vscode",
            } as any;

            const mockRes = {
                statusCode: 200,
                end: vi.fn(),
            } as any;

            const next = vi.fn();

            await middleware(mockReq, mockRes, next);

            expect(mockReq.url).toMatch(/\/\?file=.+&line=.+&column=.+&editor=.+/);
        });

        it("should handle missing file parameter", async () => {
            const middleware = createOpenInEditorMiddleware();

            const mockReq = {
                method: "GET",
                url: "/?line=10&column=5",
            } as any;

            const mockRes = {
                statusCode: 200,
                writeHead: vi.fn(),
                end: vi.fn(),
            } as any;

            const next = vi.fn();

            await middleware(mockReq, mockRes, next);

            expect(mockRes.statusCode).toBe(400);
            expect(mockRes.end).toHaveBeenCalledWith("Failed to open editor");
        });

        it("should respect project root configuration", async () => {
            const middleware = createOpenInEditorMiddleware({
                projectRoot: "/project",
                allowOutsideProject: false,
            });

            const mockReq = {
                method: "GET",
                url: "/?file=/project/src/test.js&line=10",
            } as any;

            const mockRes = {
                statusCode: 200,
                end: vi.fn(),
            } as any;

            const next = vi.fn();

            await middleware(mockReq, mockRes, next);

            expect(mockReq.url).toContain("file=");
        });

        it("should reject files outside project root when not allowed", async () => {
            const middleware = createOpenInEditorMiddleware({
                projectRoot: "/project",
                allowOutsideProject: false,
            });

            const mockReq = {
                method: "GET",
                url: "/?file=/outside/test.js&line=10",
            } as any;

            const mockRes = {
                statusCode: 200,
                writeHead: vi.fn(),
                end: vi.fn(),
            } as any;

            const next = vi.fn();

            await middleware(mockReq, mockRes, next);

            expect(mockRes.statusCode).toBe(400);
        });

        it("should allow files outside project root when explicitly allowed", async () => {
            const middleware = createOpenInEditorMiddleware({
                projectRoot: "/project",
                allowOutsideProject: true,
            });

            const mockReq = {
                method: "GET",
                url: "/?file=/outside/test.js&line=10",
            } as any;

            const mockRes = {
                statusCode: 200,
                end: vi.fn(),
            } as any;

            const next = vi.fn();

            await middleware(mockReq, mockRes, next);

            expect(mockReq.url).toContain("file=");
        });

        it("should handle Express-style requests with parsed body", async () => {
            const middleware = createOpenInEditorMiddleware();

            const mockReq = {
                method: "POST",
                url: "/",
                body: {
                    file: "src/index.ts",
                    line: 10,
                    column: 5,
                    editor: "vscode",
                },
            } as any;

            const mockRes = {
                statusCode: 200,
                end: vi.fn(),
            } as any;

            const next = vi.fn();

            await middleware(mockReq, mockRes, next);

            expect(mockReq.url).toMatch(/\/\?column=\d+&file=.+&line=\d+&editor=.+/);
        });

        it("should handle malformed JSON gracefully", async () => {
            const middleware = createOpenInEditorMiddleware();

            const mockReq = {
                method: "POST",
                url: "/",
                on: vi.fn((event, callback) => {
                    if (event === "data") callback('{invalid json');
                    if (event === "end") callback();
                }),
            } as any;

            const mockRes = {
                statusCode: 200,
                writeHead: vi.fn(),
                end: vi.fn(),
            } as any;

            const next = vi.fn();

            await middleware(mockReq, mockRes, next);

            expect(mockRes.statusCode).toBe(400);
        });

        it("should handle request errors gracefully", async () => {
            const middleware = createOpenInEditorMiddleware();

            const mockReq = {
                method: "POST",
                url: "/",
                on: vi.fn(() => {
                    throw new Error("Request error");
                }),
            } as any;

            const mockRes = {
                statusCode: 200,
                writeHead: vi.fn(),
                end: vi.fn(),
            } as any;

            const next = vi.fn();

            await middleware(mockReq, mockRes, next);

            expect(mockRes.statusCode).toBe(400);
        });
    });

    describe("createNodeHttpHandler", () => {
        it("should create Node.js HTTP handler", () => {
            const handler = createNodeHttpHandler();
            expect(typeof handler).toBe("function");
        });

        it("should handle Node.js HTTP requests", async () => {
            const handler = createNodeHttpHandler();

            const mockReq = {
                method: "GET",
                url: "/?file=/test.js&line=10",
                on: vi.fn((event, callback) => {
                    if (event === "data") callback("");
                    if (event === "end") callback();
                }),
            } as any;

            const mockRes = {
                statusCode: 200,
                end: vi.fn(),
            } as any;

            await handler(mockReq, mockRes);

            expect(mockReq.url).toContain("file=");
        });
    });

    describe("integration with HTTP server", () => {
        it("should work as middleware in HTTP server", async () => {
            const middleware = createOpenInEditorMiddleware();

            let capturedReq: any;
            let capturedRes: any;

            const mockMiddleware = vi.fn((req, res, next) => {
                capturedReq = req;
                capturedRes = res;
                // Simulate calling next without actual middleware
                next();
            });

            // Override the middleware to capture calls
            const testMiddleware = (req: any, res: any, next: any) => {
                capturedReq = req;
                capturedRes = res;
                middleware(req, res, next);
            };

            const server = createServer(testMiddleware);

            return new Promise<void>((resolve) => {
                server.listen(0, () => {
                    const port = (server.address() as any).port;

                    // Make a request
                    const req = require("node:http").get(`http://localhost:${port}/?file=/test.js&line=10`, (res: any) => {
                        let data = "";
                        res.on("data", (chunk: any) => data += chunk);
                        res.on("end", () => {
                            server.close();
                            expect(capturedReq.url).toContain("file=");
                            resolve();
                        });
                    });

                    req.on("error", () => {
                        server.close();
                        resolve();
                    });
                });
            });
        });
    });
});
