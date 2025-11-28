import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createUploader } from "../../src/core/uploader";

// Mock XMLHttpRequest

class MockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    public response = "";

    public upload = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn();

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(() => undefined);

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event)?.add(handler);
    });

    public removeEventListener = vi.fn();

    public abort = vi.fn(() => {
        const handlers = this.eventListeners.get("abort");

        if (handlers) {
            handlers.forEach((handler) => handler(new Event("abort")));
        }
    });

    private eventListeners = new Map<string, Set<(event: Event) => void>>();

    private _uploadEventListeners = new Map<string, Set<(event: ProgressEvent) => void>>();
}

describe("uploader Abort Operations", () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = globalThis.XMLHttpRequest;
        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = MockXMLHttpRequest;
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
    });

    it("should abort specific item", () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onItemAbort = vi.fn();

        uploader.on("ITEM_ABORT", onItemAbort);

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const itemId = uploader.add(file);

        uploader.abortItem(itemId);

        expect(onItemAbort).toHaveBeenCalledWith(
            expect.objectContaining({
                id: itemId,
                status: "aborted",
            }),
        );
    });

    it("should abort entire batch", () => {
        expect.assertions(2);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onBatchCancelled = vi.fn();

        uploader.on("BATCH_CANCELLED", onBatchCancelled);

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });

        uploader.addBatch([file1, file2]);

        const batches = uploader.getBatches();
        const batchId = batches[0]?.id;

        expect(batchId).toBeDefined();

        if (batchId) {
            uploader.abortBatch(batchId);

            expect(onBatchCancelled).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: batchId,
                    status: "cancelled",
                }),
            );
        }
    });

    it("should abort all uploads", () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });

        uploader.add(file1);
        uploader.add(file2);

        expect(() => uploader.abort()).not.toThrow();
    });

    it("should handle aborting non-existent item", () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        expect(() => uploader.abortItem("non-existent-id")).not.toThrow();
    });

    it("should handle aborting non-existent batch", () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        expect(() => uploader.abortBatch("non-existent-batch-id")).not.toThrow();
    });
});
