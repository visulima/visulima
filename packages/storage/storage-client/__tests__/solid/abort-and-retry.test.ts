import { afterEach, describe, expect, it, vi } from "vitest";

// The hooks send their commands through the per-endpoint channel; record what they send.
vi.mock(import("../../src/core/uploader"), async (importOriginal) => {
    const actual = await importOriginal();

    return { ...actual, dispatch: vi.fn() };
});

const { dispatch } = await import("../../src/core/uploader");
const { createAbortAll } = await import("../../src/solid/create-abort-all");
const { createAbortBatch } = await import("../../src/solid/create-abort-batch");
const { createAbortItem } = await import("../../src/solid/create-abort-item");
const { createBatchRetry } = await import("../../src/solid/create-batch-retry");
const { createRetry } = await import("../../src/solid/create-retry");

describe("solid abort and retry factories", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe(createAbortAll, () => {
        it("dispatches abortAll to the endpoint", () => {
            expect.assertions(1);

            const { abortAll } = createAbortAll({ endpoint: "/upload" });

            abortAll();

            expect(dispatch).toHaveBeenCalledWith("/upload", { type: "abortAll" });
        });
    });

    describe(createAbortBatch, () => {
        it("forwards batchId to the endpoint's abortBatch command", () => {
            expect.assertions(1);

            const { abortBatch } = createAbortBatch({ endpoint: "/upload" });

            abortBatch("batch-1");

            expect(dispatch).toHaveBeenCalledWith("/upload", { id: "batch-1", type: "abortBatch" });
        });
    });

    describe(createAbortItem, () => {
        it("forwards itemId to the endpoint's abortItem command", () => {
            expect.assertions(1);

            const { abortItem } = createAbortItem({ endpoint: "/upload" });

            abortItem("item-1");

            expect(dispatch).toHaveBeenCalledWith("/upload", { id: "item-1", type: "abortItem" });
        });
    });

    describe(createRetry, () => {
        it("forwards itemId to the endpoint's retryItem command", () => {
            expect.assertions(1);

            const { retryItem } = createRetry({ endpoint: "/upload" });

            retryItem("item-1");

            expect(dispatch).toHaveBeenCalledWith("/upload", { id: "item-1", type: "retryItem" });
        });
    });

    describe(createBatchRetry, () => {
        it("forwards batchId to the endpoint's retryBatch command", () => {
            expect.assertions(1);

            const { retryBatch } = createBatchRetry({ endpoint: "/upload" });

            retryBatch("batch-1");

            expect(dispatch).toHaveBeenCalledWith("/upload", { id: "batch-1", type: "retryBatch" });
        });
    });
});
