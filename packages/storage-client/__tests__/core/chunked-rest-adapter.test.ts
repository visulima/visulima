import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createChunkedRestAdapter } from "../../src/core/chunked-rest-adapter";

// Mock fetch globally
const mockFetch = vi.fn();

describe(createChunkedRestAdapter, () => {
    beforeEach(() => {
        globalThis.fetch = mockFetch;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should create adapter with default options", () => {
        const adapter = createChunkedRestAdapter({
            endpoint: "https://api.example.com/upload",
        });

        expect(adapter).toBeDefined();
        expect(adapter.abort).toBeDefined();
        expect(adapter.clear).toBeDefined();
        expect(adapter.getOffset).toBeDefined();
        expect(adapter.isPaused).toBeDefined();
        expect(adapter.pause).toBeDefined();
        expect(adapter.resume).toBeDefined();
        expect(adapter.setOnError).toBeDefined();
        expect(adapter.setOnFinish).toBeDefined();
        expect(adapter.setOnProgress).toBeDefined();
        expect(adapter.setOnStart).toBeDefined();
        expect(adapter.upload).toBeDefined();
    });

    it("should upload file successfully", async () => {
        expect.assertions(3);

        const file = new File(["test content"], "test.txt", { type: "text/plain" });
        const fileId = "file-123";

        // Mock create upload (POST)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-ID": fileId,
            }),
            ok: true,
        });

        // Mock get upload status (HEAD)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": "0",
            }),
            ok: true,
        });

        // Mock chunk upload (PATCH)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": String(file.size),
            }),
            ok: true,
        });

        // Mock final status check (HEAD)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": String(file.size),
            }),
            ok: true,
        });

        // Mock get upload result (GET)
        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    contentType: "text/plain",
                    id: fileId,
                    name: "test.txt",
                    originalName: "test.txt",
                    size: file.size,
                    status: "completed",
                };
            },
            ok: true,
        });

        const adapter = createChunkedRestAdapter({
            endpoint: "https://api.example.com/upload",
        });

        const result = await adapter.upload(file);

        expect(result.id).toBe(fileId);
        expect(result.size).toBe(file.size);
        expect(result.status).toBe("completed");
    });

    it("should handle pause and resume", async () => {
        expect.assertions(2);

        const adapter = createChunkedRestAdapter({
            endpoint: "https://api.example.com/upload",
        });

        expect(adapter.isPaused()).toBe(false);

        adapter.pause();

        expect(adapter.isPaused()).toBe(true);
    });

    it("should handle abort", async () => {
        const file = new File(["test content"], "test.txt", { type: "text/plain" });

        // Mock create upload - return immediately but upload will be aborted
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-ID": "file-123",
            }),
            ok: true,
        });

        // Mock get upload status - will be called but upload aborted
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": "0",
            }),
            ok: true,
        });

        // Mock chunk upload - this will be aborted
        mockFetch.mockImplementationOnce(
            () =>
                new Promise((resolve, reject) => {
                    setTimeout(() => {
                        reject(new Error("Upload aborted"));
                    }, 50);
                }),
        );

        const adapter = createChunkedRestAdapter({
            endpoint: "https://api.example.com/upload",
        });

        const uploadPromise = adapter.upload(file);

        // Wait a bit for upload to start, then abort
        await new Promise((resolve) => setTimeout(resolve, 20));
        adapter.abort();

        await expect(uploadPromise).rejects.toThrow();
    }, 10_000);

    it("should call callbacks correctly", async () => {
        expect.assertions(4);

        const file = new File(["test content"], "test.txt", { type: "text/plain" });
        const onStart = vi.fn();
        const onProgress = vi.fn();
        const onFinish = vi.fn();
        const onError = vi.fn();

        // Mock successful upload
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-ID": "file-123",
            }),
            ok: true,
        });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": "0",
            }),
            ok: true,
        });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": String(file.size),
            }),
            ok: true,
        });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": String(file.size),
            }),
            ok: true,
        });

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    id: "file-123",
                    size: file.size,
                    status: "completed",
                };
            },
            ok: true,
        });

        const adapter = createChunkedRestAdapter({
            endpoint: "https://api.example.com/upload",
        });

        adapter.setOnStart(onStart);
        adapter.setOnProgress(onProgress);
        adapter.setOnFinish(onFinish);
        adapter.setOnError(onError);

        await adapter.upload(file);

        expect(onStart).toHaveBeenCalledWith();
        expect(onProgress).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
        expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({
            id: expect.any(String),
            bytesWritten: expect.any(Number),
        }));
        expect(onError).not.toHaveBeenCalled();
    });

    it("should handle custom chunk size", async () => {
        expect.assertions(1);

        const file = new File(["x".repeat(10 * 1024 * 1024)], "large.txt", { type: "text/plain" });
        const customChunkSize = 2 * 1024 * 1024; // 2MB

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-ID": "file-123",
            }),
            ok: true,
        });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": "0",
            }),
            ok: true,
        });

        // Multiple chunk uploads - need to mock each chunk separately
        const numberChunks = Math.ceil(file.size / customChunkSize);

        for (let i = 0; i < numberChunks; i++) {
            mockFetch.mockResolvedValueOnce({
                headers: new Headers({
                    "X-Upload-Offset": String(Math.min((i + 1) * customChunkSize, file.size)),
                }),
                ok: true,
            });
        }

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": String(file.size),
            }),
            ok: true,
        });

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    id: "file-123",
                    size: file.size,
                    status: "completed",
                };
            },
            ok: true,
        });

        const adapter = createChunkedRestAdapter({
            chunkSize: customChunkSize,
            endpoint: "https://api.example.com/upload",
        });

        const result = await adapter.upload(file);

        expect(result.size).toBe(file.size);
    });

    it("should clear state", () => {
        const adapter = createChunkedRestAdapter({
            endpoint: "https://api.example.com/upload",
        });

        adapter.pause();
        adapter.clear();

        expect(adapter.isPaused()).toBe(false);
    });

    it("should handle getOffset when no file uploaded", async () => {
        const adapter = createChunkedRestAdapter({
            endpoint: "https://api.example.com/upload",
        });

        const offset = await adapter.getOffset();

        expect(offset).toBe(0);
    });
});
