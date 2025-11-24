import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createUploader } from "../../src/core/uploader";
import type { BatchState } from "../../src/core/uploader";

// Mock XMLHttpRequest
class MockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    public response = "";

    private eventListeners = new Map<string, Set<(event: Event) => void>>();

    private uploadEventListeners = new Map<string, Set<(event: ProgressEvent) => void>>();

    public upload = {
        addEventListener: vi.fn((event: string, handler: (event: ProgressEvent) => void) => {
            if (!this.uploadEventListeners.has(event)) {
                this.uploadEventListeners.set(event, new Set());
            }

            this.uploadEventListeners.get(event)?.add(handler);
        }),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn((data?: FormData) => {
        // Simulate upload progress
        setTimeout(() => {
            const handlers = this.uploadEventListeners.get("progress");

            if (handlers) {
                const progressEvent = {
                    lengthComputable: true,
                    loaded: 50,
                    total: 100,
                } as ProgressEvent;

                handlers.forEach((handler) => handler(progressEvent));
            }
        }, 10);

        // Simulate completion
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
        }, 20);
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

    public abort = vi.fn(() => {
        const handlers = this.eventListeners.get("abort");

        if (handlers) {
            handlers.forEach((handler) => handler(new Event("abort")));
        }
    });
}

describe("Uploader Batch Operations", () => {
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

    it("should create batch with addBatch", () => {
        expect.assertions(3);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });

        const itemIds = uploader.addBatch([file1, file2]);

        expect(itemIds).toHaveLength(2);
        expect(itemIds[0]).toBeDefined();
        expect(itemIds[1]).toBeDefined();
    });

    it("should emit BATCH_START event when batch is created", () => {
        expect.assertions(2);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onBatchStart = vi.fn();

        uploader.on("BATCH_START", onBatchStart);

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });

        uploader.addBatch([file1, file2]);

        expect(onBatchStart).toHaveBeenCalledTimes(1);
        expect(onBatchStart).toHaveBeenCalledWith(
            expect.objectContaining({
                id: expect.any(String),
                itemIds: expect.arrayContaining([expect.any(String), expect.any(String)]),
                totalCount: 2,
                progress: 0,
                status: "uploading",
            }),
        );
    });

    it("should get batch items", async () => {
        expect.assertions(2);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });

        const itemIds = uploader.addBatch([file1, file2]);
        const batchId = uploader.getBatches()[0]?.id;

        expect(batchId).toBeDefined();

        if (batchId) {
            const batchItems = uploader.getBatchItems(batchId);

            expect(batchItems).toHaveLength(2);
        }
    });

    it("should emit BATCH_PROGRESS events", async () => {
        expect.assertions(2);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onBatchProgress = vi.fn();

        uploader.on("BATCH_PROGRESS", onBatchProgress);

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });

        uploader.addBatch([file1]);

        // Wait for progress event
        await new Promise((resolve) => setTimeout(resolve, 15));

        expect(onBatchProgress).toHaveBeenCalled();
        expect(onBatchProgress).toHaveBeenCalledWith(
            expect.objectContaining({
                progress: expect.any(Number),
            }),
        );
    });

    it("should emit BATCH_FINISH when all items complete", async () => {
        expect.assertions(2);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onBatchFinish = vi.fn();

        uploader.on("BATCH_FINISH", onBatchFinish);

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });

        uploader.addBatch([file1]);

        // Wait for completion
        await new Promise((resolve) => setTimeout(resolve, 25));

        expect(onBatchFinish).toHaveBeenCalled();
        expect(onBatchFinish).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "completed",
                completedCount: 1,
            }),
        );
    });

    it("should calculate batch progress correctly", async () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });

        uploader.addBatch([file1]);

        // Wait for progress
        await new Promise((resolve) => setTimeout(resolve, 15));

        const batches = uploader.getBatches();

        expect(batches[0]?.progress).toBeGreaterThanOrEqual(0);
    });

    it("should return empty array for empty batch", () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        const itemIds = uploader.addBatch([]);

        expect(itemIds).toEqual([]);
    });
});

