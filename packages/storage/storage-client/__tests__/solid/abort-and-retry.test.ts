import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeAdapter = {
    abort: ReturnType<typeof vi.fn>;
    abortBatch: ReturnType<typeof vi.fn>;
    abortItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
    uploadBatch: ReturnType<typeof vi.fn>;
    uploader: { retryBatch: ReturnType<typeof vi.fn>; retryItem: ReturnType<typeof vi.fn> };
};

const lastAdapter: { current: FakeAdapter | undefined } = { current: undefined };

vi.mock(import("../../src/core/multipart-adapter"), () => {
    return {
        createMultipartAdapter: vi.fn(() => {
            const adapter: FakeAdapter = {
                abort: vi.fn(),
                abortBatch: vi.fn(),
                abortItem: vi.fn(),
                clear: vi.fn(),
                upload: vi.fn(),
                uploadBatch: vi.fn(),
                uploader: {
                    retryBatch: vi.fn(),
                    retryItem: vi.fn(),
                },
            };

            lastAdapter.current = adapter;

            return adapter;
        }),
    };
});

const { createAbortAll } = await import("../../src/solid/create-abort-all");
const { createAbortBatch } = await import("../../src/solid/create-abort-batch");
const { createAbortItem } = await import("../../src/solid/create-abort-item");
const { createBatchRetry } = await import("../../src/solid/create-batch-retry");
const { createRetry } = await import("../../src/solid/create-retry");

describe("solid abort and retry factories", () => {
    beforeEach(() => {
        lastAdapter.current = undefined;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe(createAbortAll, () => {
        it("calls adapter.abort", () => {
            expect.assertions(1);

            const { abortAll } = createAbortAll({ endpoint: "/upload" });

            abortAll();

            expect(lastAdapter.current?.abort).toHaveBeenCalledTimes(1);
        });
    });

    describe(createAbortBatch, () => {
        it("forwards batchId to adapter.abortBatch", () => {
            expect.assertions(1);

            const { abortBatch } = createAbortBatch({ endpoint: "/upload" });

            abortBatch("batch-1");

            expect(lastAdapter.current?.abortBatch).toHaveBeenCalledWith("batch-1");
        });
    });

    describe(createAbortItem, () => {
        it("forwards itemId to adapter.abortItem", () => {
            expect.assertions(1);

            const { abortItem } = createAbortItem({ endpoint: "/upload" });

            abortItem("item-1");

            expect(lastAdapter.current?.abortItem).toHaveBeenCalledWith("item-1");
        });
    });

    describe(createRetry, () => {
        it("forwards itemId to uploader.retryItem", () => {
            expect.assertions(1);

            const { retryItem } = createRetry({ endpoint: "/upload" });

            retryItem("item-1");

            expect(lastAdapter.current?.uploader.retryItem).toHaveBeenCalledWith("item-1");
        });
    });

    describe(createBatchRetry, () => {
        it("forwards batchId to uploader.retryBatch", () => {
            expect.assertions(1);

            const { retryBatch } = createBatchRetry({ endpoint: "/upload" });

            retryBatch("batch-1");

            expect(lastAdapter.current?.uploader.retryBatch).toHaveBeenCalledWith("batch-1");
        });
    });
});
