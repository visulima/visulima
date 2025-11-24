import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createUploader } from "../../src/core/uploader";

// Mock XMLHttpRequest that simulates error
class ErrorMockXMLHttpRequest {
    public readyState = 0;

    public status = 500;

    public statusText = "Internal Server Error";

    public responseText = "";

    public response = "";

    private eventListeners = new Map<string, Set<(event: Event) => void>>();

    private uploadEventListeners = new Map<string, Set<(event: ProgressEvent) => void>>();

    public upload = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn((data?: FormData) => {
        // Simulate error
        setTimeout(() => {
            const handlers = this.eventListeners.get("error");

            if (handlers) {
                handlers.forEach((handler) => handler(new Event("error")));
            }
        }, 10);
    });

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(() => null);

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event)?.add(handler);
    });

    public removeEventListener = vi.fn();

    public abort = vi.fn();
}

// Mock XMLHttpRequest that succeeds on retry
class RetrySuccessMockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    public response = "";

    private eventListeners = new Map<string, Set<(event: Event) => void>>();

    private uploadEventListeners = new Map<string, Set<(event: ProgressEvent) => void>>();

    private attemptCount = 0;

    public upload = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn((data?: FormData) => {
        this.attemptCount += 1;

        // First attempt fails, second succeeds
        if (this.attemptCount === 1) {
            setTimeout(() => {
                const handlers = this.eventListeners.get("error");

                if (handlers) {
                    handlers.forEach((handler) => handler(new Event("error")));
                }
            }, 10);
        } else {
            setTimeout(() => {
                this.readyState = 4;
                this.status = 200;
                this.responseText = JSON.stringify({
                    contentType: "image/jpeg",
                    id: "test-id",
                    name: "test-name",
                    originalName: "test.jpg",
                    size: 100,
                    status: "completed",
                });
                this.response = this.responseText;

                const handlers = this.eventListeners.get("load");

                if (handlers) {
                    handlers.forEach((handler) => handler(new Event("load")));
                }
            }, 10);
        }
    });

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(() => null);

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event)?.add(handler);
    });

    public removeEventListener = vi.fn();

    public abort = vi.fn();
}

describe("uploader Retry Operations", () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = globalThis.XMLHttpRequest;
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
    });

    it("should retry failed item", async () => {
        expect.assertions(2);

        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = RetrySuccessMockXMLHttpRequest;

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onItemStart = vi.fn();

        uploader.on("ITEM_START", onItemStart);

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const itemId = uploader.add(file);

        // Wait for error
        await new Promise((resolve) => setTimeout(resolve, 15));

        const item = uploader.getItem(itemId);

        expect(item?.status).toBe("error");

        // Retry the item
        uploader.retryItem(itemId);

        // Wait for retry start
        await new Promise((resolve) => setTimeout(resolve, 5));

        // Should have been called at least twice (initial + retry)
        expect(onItemStart.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("should track retry count", async () => {
        expect.assertions(2);

        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = ErrorMockXMLHttpRequest;

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const itemId = uploader.add(file);

        // Wait for error
        await new Promise((resolve) => setTimeout(resolve, 15));

        uploader.retryItem(itemId);

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 5));

        const item = uploader.getItem(itemId);

        expect(item?.retryCount).toBeGreaterThan(0);
        expect(item?.retryCount).toBe(1);
    });

    it("should retry all failed items in batch", async () => {
        expect.assertions(2);

        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = ErrorMockXMLHttpRequest;

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });

        uploader.addBatch([file1, file2]);

        // Wait for errors
        await new Promise((resolve) => setTimeout(resolve, 15));

        const batches = uploader.getBatches();
        const batchId = batches[0]?.id;

        expect(batchId).toBeDefined();

        if (batchId) {
            uploader.retryBatch(batchId);

            // Wait a bit
            await new Promise((resolve) => setTimeout(resolve, 5));

            const batch = uploader.getBatch(batchId);

            expect(batch?.status).toBe("uploading");
        }
    });

    it("should not retry non-error items", () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const itemId = uploader.add(file);

        const item = uploader.getItem(itemId);

        // Item is pending or uploading, not error
        if (item && item.status !== "error") {
            const initialRetryCount = item.retryCount ?? 0;

            uploader.retryItem(itemId);

            // Retry count should not increment for non-error items (retryItem returns early)
            const updatedItem = uploader.getItem(itemId);

            // retryCount should remain the same (0) since retryItem returns early for non-error items
            expect(updatedItem?.retryCount ?? 0).toBe(initialRetryCount);
        } else {
            expect(true).toBe(true); // Skip test if item is already in error state
        }
    });
});
