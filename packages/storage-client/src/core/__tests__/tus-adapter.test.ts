import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTusAdapter } from "../tus-adapter";

// Mock fetch
const mockFetch = vi.fn();

describe(createTusAdapter, () => {
    beforeEach(() => {
        globalThis.fetch = mockFetch;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should create adapter with correct options", () => {
        expect.assertions(8);

        const adapter = createTusAdapter({
            endpoint: "http://localhost/api/upload/tus",
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
        expect.assertions(6);

        const adapter = createTusAdapter({
            chunkSize: 100, // Use chunk size equal to file size for single chunk
            endpoint: "http://localhost/api/upload/tus",
        });

        // Mock POST response (create upload)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                Location: "http://localhost/api/upload/tus/123",
                "Tus-Resumable": "1.0.0",
            }),
            ok: true,
            status: 201,
        });

        // Mock PATCH response (upload chunk) - called multiple times if file is larger
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 204,
        });

        // Mock final HEAD response (get file info)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                Location: "/files/123",
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Metadata": "filename dGVzdC5qcGc=,filetype aW1hZ2UvanBlZw==",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        const file = new File(["x".repeat(100)], "test.jpg", { type: "image/jpeg" });
        const result = await adapter.upload(file);

        expect(result).toBeDefined();
        expect(result.filename).toBe("test.jpg");
        expect(result.size).toBe(100);
        expect(result.status).toBe("completed");

        // Verify fetch was called
        expect(mockFetch).toHaveBeenCalled();
        expect(mockFetch).toHaveBeenNthCalledWith(
            1,
            "http://localhost/api/upload/tus",
            expect.objectContaining({
                method: "POST",
            }),
        );
    });

    it("should handle pause and resume", async () => {
        expect.assertions(2);

        const adapter = createTusAdapter({
            chunkSize: 100,
            endpoint: "http://localhost/api/upload/tus",
        });

        let postCompleted = false;

        // Mock POST response
        mockFetch.mockImplementationOnce(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            postCompleted = true;

            return {
                headers: new Headers({
                    Location: "http://localhost/api/upload/tus/123",
                    "Tus-Resumable": "1.0.0",
                }),
                ok: true,
                status: 201,
            };
        });

        // Mock HEAD response for resume (to get current offset)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Offset": "0",
            }),
            ok: true,
            status: 200,
        });

        // Mock PATCH response (will be called after resume)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 204,
        });

        // Mock final HEAD response
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                Location: "http://localhost/files/123",
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Metadata": "filename dGVzdC5qcGc=,filetype aW1hZ2UvanBlZw==",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        const file = new File(["x".repeat(100)], "test.jpg", { type: "image/jpeg" });
        const uploadPromise = adapter.upload(file);

        // Wait for POST to complete (uploadUrl to be set)
        while (!postCompleted) {
            await new Promise((resolve) => setTimeout(resolve, 5));
        }

        // Additional wait to ensure uploadUrl is set in state
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Pause during upload
        adapter.pause();

        expect(adapter.isPaused()).toBe(true);

        // Resume - this should continue the upload
        await adapter.resume();

        // Wait for upload to complete
        await uploadPromise;

        expect(adapter.isPaused()).toBe(false);
    });

    it("should handle upload errors", async () => {
        expect.assertions(1);

        const adapter = createTusAdapter({
            endpoint: "http://localhost/api/upload/tus",
        });

        // Mock POST to fail
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

        await expect(adapter.upload(file)).rejects.toThrow();
    });

    it("should handle 409 conflict (offset mismatch)", async () => {
        expect.assertions(2);

        const adapter = createTusAdapter({
            chunkSize: 100,
            endpoint: "http://localhost/api/upload/tus",
        });

        // Mock POST response
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                Location: "http://localhost/api/upload/tus/123",
                "Tus-Resumable": "1.0.0",
            }),
            ok: true,
            status: 201,
        });

        // Mock PATCH with 409 conflict
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
            }),
            ok: false,
            status: 409,
        });

        // Mock HEAD to get current offset after conflict
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Offset": "50",
            }),
            ok: true,
            status: 200,
        });

        // Mock successful PATCH retry
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 204,
        });

        // Mock final HEAD
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                Location: "http://localhost/files/123",
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Metadata": "filename dGVzdC5qcGc=,filetype aW1hZ2UvanBlZw==",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        const file = new File(["x".repeat(100)], "test.jpg", { type: "image/jpeg" });
        const result = await adapter.upload(file);

        expect(result).toBeDefined();
        expect(result.status).toBe("completed");
    });

    it("should abort upload", () => {
        expect.assertions(1);

        const adapter = createTusAdapter({
            endpoint: "http://localhost/api/upload/tus",
        });

        expect(() => adapter.abort()).not.toThrow();
    });

    it("should clear uploads", () => {
        expect.assertions(1);

        const adapter = createTusAdapter({
            endpoint: "http://localhost/api/upload/tus",
        });

        expect(() => adapter.clear()).not.toThrow();
    });

    it("should get current offset", () => {
        expect.assertions(1);

        const adapter = createTusAdapter({
            endpoint: "http://localhost/api/upload/tus",
        });

        expect(adapter.getOffset()).toBe(0);
    });

    it("should set callbacks", () => {
        expect.assertions(4);

        const adapter = createTusAdapter({
            endpoint: "http://localhost/api/upload/tus",
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
