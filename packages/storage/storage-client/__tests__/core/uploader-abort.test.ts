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
            handlers.forEach((handler) => {
                handler(new Event("abort"));
            });
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

        uploader.abortBatch(batchId!);

        expect(onBatchCancelled).toHaveBeenCalledWith(
            expect.objectContaining({
                id: batchId,
                status: "cancelled",
            }),
        );
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

        expect(() => {
            uploader.abort();
        }).not.toThrow();
    });

    it("should handle aborting non-existent item", () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        expect(() => {
            uploader.abortItem("non-existent-id");
        }).not.toThrow();
    });

    it("should handle aborting non-existent batch", () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        expect(() => {
            uploader.abortBatch("non-existent-batch-id");
        }).not.toThrow();
    });

    it("should abort queued items that exceed the concurrency cap", () => {
        expect.assertions(3);

        const uploader = createUploader({
            concurrency: 2,
            endpoint: "/api/upload",
        });
        const onItemAbort = vi.fn();

        uploader.on("ITEM_ABORT", onItemAbort);

        const files = Array.from({ length: 5 }, (_, index) => new File([`test${String(index)}`], `test${String(index)}.jpg`, { type: "image/jpeg" }));

        for (const file of files) {
            uploader.add(file);
        }

        uploader.abort();

        // Every item — including the three that never left the queue — is aborted,
        // and none is left pending/uploading to be restarted by the pump.
        expect(uploader.getItems()).toHaveLength(5);
        expect(uploader.getItems().every((item) => item.status === "aborted")).toBe(true);
        expect(onItemAbort).toHaveBeenCalledTimes(5);
    });

    it("should not cancel a batch when a single item is aborted while siblings are still uploading", () => {
        expect.assertions(3);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onBatchCancelled = vi.fn();
        const onItemAbort = vi.fn();

        uploader.on("BATCH_CANCELLED", onBatchCancelled);
        uploader.on("ITEM_ABORT", onItemAbort);

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });
        const file3 = new File(["test3"], "test3.jpg", { type: "image/jpeg" });

        const [id1] = uploader.addBatch([file1, file2, file3]);

        uploader.abortItem(id1!);

        expect(onItemAbort).toHaveBeenCalledTimes(1);
        // Two siblings are still uploading, so the batch must not flip to cancelled.
        expect(onBatchCancelled).not.toHaveBeenCalled();
        expect(uploader.getBatches()[0]?.status).not.toBe("cancelled");
    });

    it("should emit BATCH_CANCELLED exactly once when aborting the whole batch", () => {
        expect.assertions(2);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onBatchCancelled = vi.fn();

        uploader.on("BATCH_CANCELLED", onBatchCancelled);

        const files = [
            new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
            new File(["test2"], "test2.jpg", { type: "image/jpeg" }),
            new File(["test3"], "test3.jpg", { type: "image/jpeg" }),
        ];

        const itemIds = uploader.addBatch(files);

        uploader.abortBatch(uploader.getBatches()[0]!.id);

        expect(onBatchCancelled).toHaveBeenCalledTimes(1);
        expect(itemIds).toHaveLength(3);
    });
});
