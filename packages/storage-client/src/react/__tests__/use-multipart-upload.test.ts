import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMultipartAdapter } from "../../core/multipart-adapter";
import type { UploadItem } from "../../core/uploader";

// Mock XMLHttpRequest
class MockXMLHttpRequest {
    public onload: ((event: Event) => void) | null = null;
    public onerror: ((event: Event) => void) | null = null;
    public onprogress: ((event: ProgressEvent) => void) | null = null;
    public readyState = 0;
    public status = 200;
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

describe("useMultipartUpload", () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = global.XMLHttpRequest;
        // @ts-expect-error - Mock XMLHttpRequest
        global.XMLHttpRequest = MockXMLHttpRequest;
        vi.clearAllMocks();
        vi.spyOn(console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        global.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
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

    it("should handle upload progress events", async () => {
        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        const uploader = adapter.uploader;
        let progressReceived = false;

        uploader.on("ITEM_PROGRESS", (item: UploadItem) => {
            progressReceived = true;
            expect(item.completed).toBeGreaterThan(0);
        });

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
        const uploadPromise = adapter.upload(file);

        // Wait for progress event
        await new Promise((resolve) => setTimeout(resolve, 15));

        await uploadPromise;

        expect(progressReceived).toBe(true);
    });

    it("should handle upload completion", async () => {
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

    it("should clear timeout on successful upload", async () => {
        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
        await adapter.upload(file);

        // Wait a bit to ensure timeout would have fired if not cleared
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Timeout should have been cleared
        expect(clearTimeoutSpy).toHaveBeenCalled();
    });
});
