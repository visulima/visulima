import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMultipartAdapter } from "../multipart-adapter";

// Mock XMLHttpRequest
class MockXMLHttpRequest {
    public onload: ((event: Event) => void) | null = null;
    public onerror: ((event: Event) => void) | null = null;
    public onprogress: ((event: ProgressEvent) => void) | null = null;
    public readyState = 0;
    public status = 0;
    public responseText = "";
    public upload = {
        addEventListener: vi.fn((event: string, handler: (event: ProgressEvent) => void) => {
            if (event === "progress") {
                this.onprogress = handler;
            }
        }),
    };
    public open = vi.fn();
    public send = vi.fn((data?: FormData) => {
        // Simulate upload progress
        setTimeout(() => {
            if (this.onprogress) {
                const progressEvent = {
                    lengthComputable: true,
                    loaded: 50,
                    total: 100,
                } as ProgressEvent;

                this.onprogress(progressEvent);
            }
        }, 10);

        // Simulate completion
        setTimeout(() => {
            this.readyState = 4;
            this.status = 200;
            this.responseText = JSON.stringify({
                id: "test-id",
                name: "test-name",
                originalName: "test.jpg",
                size: 100,
                contentType: "image/jpeg",
                status: "completed",
            });

            if (this.onload) {
                this.onload(new Event("load"));
            }
        }, 20);
    });
    public setRequestHeader = vi.fn();
}

describe("createMultipartAdapter", () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = global.XMLHttpRequest;
        // @ts-expect-error - Mock XMLHttpRequest
        global.XMLHttpRequest = MockXMLHttpRequest;
    });

    afterEach(() => {
        global.XMLHttpRequest = originalXHR;
        vi.clearAllMocks();
    });

    it("should create adapter with correct options", () => {
        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
            metadata: { test: "value" },
        });

        expect(adapter).toBeDefined();
        expect(adapter.upload).toBeDefined();
        expect(adapter.abort).toBeDefined();
        expect(adapter.clear).toBeDefined();
    });

    it("should upload file successfully", async () => {
        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
        const result = await adapter.upload(file);

        expect(result).toBeDefined();
        expect(result.id).toBe("test-id");
        expect(result.filename).toBe("test.jpg");
        expect(result.status).toBe("completed");
    });

    it("should handle upload progress", async () => {
        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        let progressReceived = false;
        const uploader = adapter.uploader;

        uploader.on("ITEM_PROGRESS", () => {
            progressReceived = true;
        });

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
        const uploadPromise = adapter.upload(file);

        // Wait a bit for progress event
        await new Promise((resolve) => setTimeout(resolve, 15));

        await uploadPromise;

        expect(progressReceived).toBe(true);
    });

    it("should handle upload errors", async () => {
        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        // Mock XHR to simulate error
        const mockXHR = new MockXMLHttpRequest();

        mockXHR.send = vi.fn(() => {
            setTimeout(() => {
                if (mockXHR.onerror) {
                    mockXHR.onerror(new Event("error"));
                }
            }, 10);
        });

        // @ts-expect-error - Mock XMLHttpRequest
        global.XMLHttpRequest = vi.fn(() => mockXHR) as unknown as typeof XMLHttpRequest;

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        await expect(adapter.upload(file)).rejects.toThrow();
    });

    it("should abort upload", () => {
        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        expect(() => adapter.abort()).not.toThrow();
    });

    it("should clear uploads", () => {
        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        expect(() => adapter.clear()).not.toThrow();
    });
});

