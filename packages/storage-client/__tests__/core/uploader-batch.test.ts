import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createUploader } from "../../src/core/uploader";
import { MockXMLHttpRequest } from "../mock-xhr";

describe("uploader Batch Operations", () => {
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
                progress: 0,
                status: "uploading",
                totalCount: 2,
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

        uploader.addBatch([file1, file2]);
        const batchId = uploader.getBatches()[0]?.id;

        expect(batchId).toBeDefined();

        if (batchId) {
            const batchItems = uploader.getBatchItems(batchId);

            expect(batchItems).toHaveLength(2);
        }
    });

    it("should emit BATCH_PROGRESS events", async () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onBatchProgress = vi.fn();

        uploader.on("BATCH_PROGRESS", onBatchProgress);

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });

        uploader.addBatch([file1]);

        // Wait for progress event
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 15);
        });

        expect(onBatchProgress).toHaveBeenCalledWith(
            expect.objectContaining({
                progress: expect.any(Number),
            }),
        );
    });

    it("should emit BATCH_FINISH when all items complete", async () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onBatchFinish = vi.fn();

        uploader.on("BATCH_FINISH", onBatchFinish);

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });

        uploader.addBatch([file1]);

        // Wait for completion
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 25);
        });

        expect(onBatchFinish).toHaveBeenCalledWith(
            expect.objectContaining({
                completedCount: 1,
                status: "completed",
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
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 15);
        });

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
