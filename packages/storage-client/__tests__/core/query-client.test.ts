import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    buildUrl,
    deleteRequest,
    extractFileMetaFromHeaders,
    fetchFile,
    fetchHead,
    fetchJson,
    parseApiError,
    patchChunk,
    putFile,
} from "../../src/core/query-client";

// Mock fetch globally
const mockFetch = vi.fn();

// Mock XMLHttpRequest
class MockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    private eventListeners = new Map<string, Set<(event: Event) => void>>();

    public upload = {
        addEventListener: vi.fn((_event: string, handler: (event: ProgressEvent) => void) => {
            // Simulate progress
            setTimeout(() => {
                const progressEvent = {
                    lengthComputable: true,
                    loaded: 50,
                    total: 100,
                } as ProgressEvent;

                handler(progressEvent);
            }, 10);
        }),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn(() => {
        setTimeout(() => {
            this.readyState = 4;
            this.status = 200;
            const handlers = this.eventListeners.get("load");

            if (handlers) {
                handlers.forEach((handler) => handler(new Event("load")));
            }
        }, 20);
    });

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn((name: string) => {
        if (name === "ETag") {
            return "\"test-etag\"";
        }

        if (name === "Location") {
            return "https://api.example.com/file/123";
        }

        return null;
    });

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event)?.add(handler);
    });

    public removeEventListener = vi.fn();
}

describe("query-client", () => {
    beforeEach(() => {
        globalThis.fetch = mockFetch;
        globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
        vi.clearAllMocks();
    });

    describe(parseApiError, () => {
        it("should parse API error response", async () => {
            const response = Response.json(
                {
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid input",
                    },
                },
                { status: 400, statusText: "Bad Request" },
            );

            const error = await parseApiError(response);

            expect(error.message).toBe("Invalid input");
        });

        it("should handle non-JSON error response", async () => {
            const response = new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" });

            const error = await parseApiError(response);

            expect(error.message).toBe("Request failed: 500 Internal Server Error");
        });
    });

    describe(extractFileMetaFromHeaders, () => {
        it("should extract file metadata from headers", () => {
            const headers = new Headers({
                "Content-Length": "1024",
                "Content-Type": "image/jpeg",
                ETag: "\"test-etag\"",
                "Last-Modified": "Wed, 21 Oct 2015 07:28:00 GMT",
            });

            const fileMeta = extractFileMetaFromHeaders("file-123", headers);

            expect(fileMeta.id).toBe("file-123");
            expect(fileMeta.contentType).toBe("image/jpeg");
            expect(fileMeta.size).toBe(1024);
            expect(fileMeta.createdAt).toBeDefined();
        });

        it("should handle missing headers", () => {
            const headers = new Headers();

            const fileMeta = extractFileMetaFromHeaders("file-123", headers);

            expect(fileMeta.id).toBe("file-123");
            expect(fileMeta.contentType).toBeUndefined();
            expect(fileMeta.size).toBeUndefined();
        });
    });

    describe(buildUrl, () => {
        it("should build URL with query parameters", () => {
            const url = buildUrl("https://api.example.com", "/files", { active: true, limit: 10, page: 1 });

            expect(url).toContain("page=1");
            expect(url).toContain("limit=10");
            expect(url).toContain("active=true");
        });

        it("should handle base URL without trailing slash", () => {
            const url = buildUrl("https://api.example.com", "/files");

            expect(url).toBe("https://api.example.com/files");
        });

        it("should handle base URL with trailing slash", () => {
            const url = buildUrl("https://api.example.com/", "/files");

            expect(url).toBe("https://api.example.com/files");
        });

        it("should skip undefined parameters", () => {
            const url = buildUrl("https://api.example.com", "/files", { limit: undefined, page: 1 });

            expect(url).toContain("page=1");
            expect(url).not.toContain("limit");
        });
    });

    describe(fetchFile, () => {
        it("should fetch file successfully", async () => {
            const mockBlob = new Blob(["test content"], { type: "image/jpeg" });

            mockFetch.mockResolvedValueOnce({
                blob: () => Promise.resolve(mockBlob),
                ok: true,
            });

            const result = await fetchFile("https://api.example.com/file/123");

            expect(result).toBe(mockBlob);
        });

        it("should throw error on failed request", async () => {
            mockFetch.mockResolvedValueOnce({
                json: async () => {
                    return {
                        error: {
                            code: "NOT_FOUND",
                            message: "File not found",
                        },
                    };
                },
                ok: false,
                status: 404,
                statusText: "Not Found",
            });

            await expect(fetchFile("https://api.example.com/file/123")).rejects.toThrow();
        });
    });

    describe(fetchJson, () => {
        it("should fetch JSON successfully", async () => {
            const mockData = { id: "123", name: "test" };

            mockFetch.mockResolvedValueOnce({
                json: async () => mockData,
                ok: true,
            });

            const result = await fetchJson<{ id: string; name: string }>("https://api.example.com/data");

            expect(result).toEqual(mockData);
        });

        it("should throw error on failed request", async () => {
            mockFetch.mockResolvedValueOnce({
                json: async () => {
                    return {
                        error: {
                            code: "ERROR",
                            message: "Request failed",
                        },
                    };
                },
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
            });

            await expect(fetchJson("https://api.example.com/data")).rejects.toThrow();
        });
    });

    describe(fetchHead, () => {
        it("should fetch headers successfully", async () => {
            const mockHeaders = new Headers({
                "Content-Length": "1024",
                "Content-Type": "image/jpeg",
            });

            mockFetch.mockResolvedValueOnce({
                headers: mockHeaders,
                ok: true,
            });

            const result = await fetchHead("https://api.example.com/file/123");

            expect(result).toBe(mockHeaders);
        });

        it("should throw error on failed request", async () => {
            mockFetch.mockResolvedValueOnce({
                json: async () => {
                    return {
                        error: {
                            code: "ERROR",
                            message: "Request failed",
                        },
                    };
                },
                ok: false,
                status: 404,
                statusText: "Not Found",
            });

            await expect(fetchHead("https://api.example.com/file/123")).rejects.toThrow();
        });
    });

    describe(deleteRequest, () => {
        it("should delete successfully", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
            });

            await expect(deleteRequest("https://api.example.com/file/123")).resolves.not.toThrow();
        });

        it("should throw error on failed request", async () => {
            mockFetch.mockResolvedValueOnce({
                json: async () => {
                    return {
                        error: {
                            code: "ERROR",
                            message: "Delete failed",
                        },
                    };
                },
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
            });

            await expect(deleteRequest("https://api.example.com/file/123")).rejects.toThrow();
        });
    });

    describe(putFile, () => {
        it("should upload file successfully", async () => {
            const file = new File(["test content"], "test.txt", { type: "text/plain" });
            const onProgress = vi.fn();

            const result = await putFile("https://api.example.com/file/123", file, onProgress);

            expect(result.etag).toBe("\"test-etag\"");
            expect(result.location).toBe("https://api.example.com/file/123");
            expect(onProgress).toHaveBeenCalledWith(expect.any(Number));
        });

        it("should handle upload without progress callback", async () => {
            const file = new File(["test content"], "test.txt", { type: "text/plain" });

            const result = await putFile("https://api.example.com/file/123", file);

            expect(result.etag).toBe("\"test-etag\"");
        });
    });

    describe(patchChunk, () => {
        it("should upload chunk successfully", async () => {
            const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

            mockFetch.mockResolvedValueOnce({
                headers: new Headers({
                    ETag: "\"chunk-etag\"",
                    "X-Upload-Complete": "false",
                    "X-Upload-Offset": "100",
                }),
                ok: true,
            });

            const result = await patchChunk("https://api.example.com/upload/123", chunk, 0);

            expect(result.uploadOffset).toBe(100);
            expect(result.uploadComplete).toBe(false);
            expect(result.etag).toBe("\"chunk-etag\"");
        });

        it("should include checksum in headers when provided", async () => {
            const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

            mockFetch.mockResolvedValueOnce({
                headers: new Headers({
                    "X-Upload-Offset": "100",
                }),
                ok: true,
            });

            await patchChunk("https://api.example.com/upload/123", chunk, 0, "abc123");

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "X-Chunk-Checksum": "abc123",
                    }),
                }),
            );
        });

        it("should throw error on failed request", async () => {
            mockFetch.mockResolvedValueOnce({
                json: async () => {
                    return {
                        error: {
                            code: "ERROR",
                            message: "Upload failed",
                        },
                    };
                },
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
            });

            const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

            await expect(patchChunk("https://api.example.com/upload/123", chunk, 0)).rejects.toThrow();
        });
    });
});
