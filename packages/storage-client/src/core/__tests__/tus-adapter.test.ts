import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTusAdapter } from "../tus-adapter";

// Mock fetch
const mockFetch = vi.fn();

describe("createTusAdapter", () => {
    beforeEach(() => {
        global.fetch = mockFetch;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should create adapter with correct options", () => {
        const adapter = createTusAdapter({
            endpoint: "/api/upload/tus",
            metadata: { test: "value" },
        });

        expect(adapter).toBeDefined();
        expect(adapter.upload).toBeDefined();
        expect(adapter.abort).toBeDefined();
        expect(adapter.clear).toBeDefined();
        expect(adapter.pause).toBeDefined();
        expect(adapter.resume).toBeDefined();
        expect(adapter.getOffset).toBeDefined();
        expect(adapter.isPaused).toBeDefined();
    });

    it("should create upload with POST request", async () => {
        const adapter = createTusAdapter({
            endpoint: "/api/upload/tus",
        });

        // Mock POST response (create upload)
        mockFetch.mockResolvedValueOnce({
            status: 201,
            headers: new Headers({
                Location: "/api/upload/tus/123",
                "Tus-Resumable": "1.0.0",
            }),
        });

        // Mock HEAD response (get offset)
        mockFetch.mockResolvedValueOnce({
            status: 200,
            headers: new Headers({
                "Upload-Offset": "0",
                "Upload-Length": "100",
                "Tus-Resumable": "1.0.0",
            }),
        });

        // Mock PATCH response (upload chunk)
        mockFetch.mockResolvedValueOnce({
            status: 204,
            headers: new Headers({
                "Upload-Offset": "100",
                "Tus-Resumable": "1.0.0",
            }),
        });

        // Mock final HEAD response (get file info)
        mockFetch.mockResolvedValueOnce({
            status: 200,
            headers: new Headers({
                "Upload-Offset": "100",
                "Upload-Length": "100",
                Location: "/files/123",
                "Upload-Metadata": "filename dGVzdC5qcGc=,filetype aW1hZ2UvanBlZw==",
                "Tus-Resumable": "1.0.0",
            }),
        });

        const file = new File(["x".repeat(100)], "test.jpg", { type: "image/jpeg" });
        const result = await adapter.upload(file);

        expect(result).toBeDefined();
        expect(result.id).toBe("123");
        expect(result.filename).toBe("test.jpg");
        expect(result.size).toBe(100);
        expect(result.status).toBe("completed");

        // Verify fetch was called correctly
        expect(mockFetch).toHaveBeenCalledTimes(4);
        expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/upload/tus", expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
            }),
        }));
    });

    it("should handle pause and resume", async () => {
        const adapter = createTusAdapter({
            endpoint: "/api/upload/tus",
        });

        // Mock POST response
        mockFetch.mockResolvedValueOnce({
            status: 201,
            headers: new Headers({
                Location: "/api/upload/tus/123",
                "Tus-Resumable": "1.0.0",
            }),
        });

        // Mock HEAD response for offset
        mockFetch.mockResolvedValueOnce({
            status: 200,
            headers: new Headers({
                "Upload-Offset": "0",
                "Upload-Length": "100",
                "Tus-Resumable": "1.0.0",
            }),
        });

        const file = new File(["x".repeat(100)], "test.jpg", { type: "image/jpeg" });
        const uploadPromise = adapter.upload(file);

        // Wait a bit then pause
        await new Promise((resolve) => setTimeout(resolve, 5));
        adapter.pause();

        expect(adapter.isPaused()).toBe(true);

        // Mock PATCH response for resume
        mockFetch.mockResolvedValueOnce({
            status: 204,
            headers: new Headers({
                "Upload-Offset": "100",
                "Tus-Resumable": "1.0.0",
            }),
        });

        // Mock final HEAD response
        mockFetch.mockResolvedValueOnce({
            status: 200,
            headers: new Headers({
                "Upload-Offset": "100",
                "Upload-Length": "100",
                Location: "/files/123",
                "Upload-Metadata": "filename dGVzdC5qcGc=,filetype aW1hZ2UvanBlZw==",
                "Tus-Resumable": "1.0.0",
            }),
        });

        await adapter.resume();

        expect(adapter.isPaused()).toBe(false);
    });

    it("should handle upload errors", async () => {
        const adapter = createTusAdapter({
            endpoint: "/api/upload/tus",
        });

        // Mock POST to fail
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

        await expect(adapter.upload(file)).rejects.toThrow("Network error");
    });

    it("should handle 409 conflict (offset mismatch)", async () => {
        const adapter = createTusAdapter({
            endpoint: "/api/upload/tus",
        });

        // Mock POST response
        mockFetch.mockResolvedValueOnce({
            status: 201,
            headers: new Headers({
                Location: "/api/upload/tus/123",
                "Tus-Resumable": "1.0.0",
            }),
        });

        // Mock HEAD response
        mockFetch.mockResolvedValueOnce({
            status: 200,
            headers: new Headers({
                "Upload-Offset": "0",
                "Upload-Length": "100",
                "Tus-Resumable": "1.0.0",
            }),
        });

        // Mock PATCH with 409 conflict
        mockFetch.mockResolvedValueOnce({
            status: 409,
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
            }),
        });

        // Mock HEAD to get current offset after conflict
        mockFetch.mockResolvedValueOnce({
            status: 200,
            headers: new Headers({
                "Upload-Offset": "50",
                "Upload-Length": "100",
                "Tus-Resumable": "1.0.0",
            }),
        });

        // Mock successful PATCH retry
        mockFetch.mockResolvedValueOnce({
            status: 204,
            headers: new Headers({
                "Upload-Offset": "100",
                "Tus-Resumable": "1.0.0",
            }),
        });

        // Mock final HEAD
        mockFetch.mockResolvedValueOnce({
            status: 200,
            headers: new Headers({
                "Upload-Offset": "100",
                "Upload-Length": "100",
                Location: "/files/123",
                "Upload-Metadata": "filename dGVzdC5qcGc=,filetype aW1hZ2UvanBlZw==",
                "Tus-Resumable": "1.0.0",
            }),
        });

        const file = new File(["x".repeat(100)], "test.jpg", { type: "image/jpeg" });
        const result = await adapter.upload(file);

        expect(result).toBeDefined();
        expect(result.status).toBe("completed");
    });

    it("should abort upload", () => {
        const adapter = createTusAdapter({
            endpoint: "/api/upload/tus",
        });

        expect(() => adapter.abort()).not.toThrow();
    });

    it("should clear uploads", () => {
        const adapter = createTusAdapter({
            endpoint: "/api/upload/tus",
        });

        expect(() => adapter.clear()).not.toThrow();
    });

    it("should get current offset", () => {
        const adapter = createTusAdapter({
            endpoint: "/api/upload/tus",
        });

        expect(adapter.getOffset()).toBe(0);
    });

    it("should set callbacks", () => {
        const adapter = createTusAdapter({
            endpoint: "/api/upload/tus",
        });

        const onStart = vi.fn();
        const onProgress = vi.fn();
        const onFinish = vi.fn();
        const onError = vi.fn();

        adapter.setOnStart(onStart);
        adapter.setOnProgress(onProgress);
        adapter.setOnFinish(onFinish);
        adapter.setOnError(onError);

        expect(() => adapter.setOnStart(undefined)).not.toThrow();
        expect(() => adapter.setOnProgress(undefined)).not.toThrow();
        expect(() => adapter.setOnFinish(undefined)).not.toThrow();
        expect(() => adapter.setOnError(undefined)).not.toThrow();
    });
});

