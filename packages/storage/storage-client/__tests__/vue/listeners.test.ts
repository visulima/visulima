import { render } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import type { BatchState, UploaderEventHandler, UploaderEventType, UploadItem } from "../../src/core/uploader";

const createStubUploader = (): {
    emit: (event: UploaderEventType, payload: UploadItem | BatchState) => void;
    handlers: Map<UploaderEventType, Set<UploaderEventHandler>>;
    off: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
} => {
    const handlers = new Map<UploaderEventType, Set<UploaderEventHandler>>();

    const on = vi.fn((event: UploaderEventType, handler: UploaderEventHandler) => {
        if (!handlers.has(event)) {
            handlers.set(event, new Set());
        }

        handlers.get(event)?.add(handler);
    });

    const off = vi.fn((event: UploaderEventType, handler: UploaderEventHandler) => {
        handlers.get(event)?.delete(handler);
    });

    const emit = (event: UploaderEventType, payload: UploadItem | BatchState): void => {
        handlers.get(event)?.forEach((handler) => handler(payload));
    };

    return { emit, handlers, off, on };
};

type StubUploader = ReturnType<typeof createStubUploader>;
const stubRef: { current: StubUploader | undefined } = { current: undefined };

vi.mock("../../src/core/multipart-adapter", () => ({
    createMultipartAdapter: vi.fn(() => {
        const stub = createStubUploader();

        stubRef.current = stub;

        return {
            abort: vi.fn(),
            abortBatch: vi.fn(),
            abortItem: vi.fn(),
            clear: vi.fn(),
            upload: vi.fn(),
            uploadBatch: vi.fn(),
            uploader: stub,
        };
    }),
}));

const { useAllAbortListener } = await import("../../src/vue/use-all-abort-listener");
const { useBatchCancelledListener } = await import("../../src/vue/use-batch-cancelled-listener");
const { useBatchErrorListener } = await import("../../src/vue/use-batch-error-listener");
const { useBatchFinalizeListener } = await import("../../src/vue/use-batch-finalize-listener");
const { useBatchFinishListener } = await import("../../src/vue/use-batch-finish-listener");
const { useBatchProgressListener } = await import("../../src/vue/use-batch-progress-listener");
const { useBatchStartListener } = await import("../../src/vue/use-batch-start-listener");
const { useRetryListener } = await import("../../src/vue/use-retry-listener");

const makeItem = (overrides: Partial<UploadItem> = {}): UploadItem => ({
    completed: 0,
    file: new File(["x"], "x.txt"),
    id: "item-1",
    loaded: 0,
    retryCount: 0,
    size: 1,
    status: "pending",
    ...overrides,
});

const makeBatch = (overrides: Partial<BatchState> = {}): BatchState => ({
    completedCount: 0,
    errorCount: 0,
    id: "batch-1",
    itemIds: ["item-1"],
    progress: 0,
    status: "pending",
    totalCount: 1,
    ...overrides,
});

const mountComposable = (composable: () => void): { unmount: () => void } => {
    const Cmp = defineComponent({
        setup() {
            composable();

            return () => h("div");
        },
    });

    const { unmount } = render(Cmp);

    return { unmount };
};

beforeEach(() => {
    stubRef.current = undefined;
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("vue listener composables", () => {
    describe(useAllAbortListener, () => {
        it("subscribes on mount and unsubscribes on unmount", () => {
            expect.assertions(3);

            const onAbort = vi.fn();
            const { unmount } = mountComposable(() => useAllAbortListener({ endpoint: "/upload", onAbort }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("ITEM_ABORT", expect.any(Function));

            unmount();

            expect(stubRef.current?.off).toHaveBeenCalledWith("ITEM_ABORT", expect.any(Function));
            expect(stubRef.current?.handlers.get("ITEM_ABORT")?.size ?? 0).toBe(0);
        });

        it("calls onAbort on ITEM_ABORT events with UploadItem payloads", () => {
            expect.assertions(2);

            const onAbort = vi.fn();
            const item = makeItem({ status: "aborted" });

            mountComposable(() => useAllAbortListener({ endpoint: "/upload", onAbort }));

            stubRef.current?.emit("ITEM_ABORT", item);
            // Batch payload should be ignored
            stubRef.current?.emit("ITEM_ABORT", makeBatch());

            expect(onAbort).toHaveBeenCalledTimes(1);
            expect(onAbort).toHaveBeenCalledWith(item);
        });
    });

    describe(useBatchCancelledListener, () => {
        it("subscribes / unsubscribes from BATCH_CANCELLED and delivers BatchState", () => {
            expect.assertions(3);

            const onBatchCancelled = vi.fn();
            const batch = makeBatch({ status: "cancelled" });

            const { unmount } = mountComposable(() => useBatchCancelledListener({ endpoint: "/upload", onBatchCancelled }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_CANCELLED", expect.any(Function));
            stubRef.current?.emit("BATCH_CANCELLED", batch);
            expect(onBatchCancelled).toHaveBeenCalledWith(batch);

            unmount();
            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_CANCELLED", expect.any(Function));
        });
    });

    describe(useBatchErrorListener, () => {
        it("delivers BatchState to onBatchError", () => {
            expect.assertions(3);

            const onBatchError = vi.fn();
            const batch = makeBatch({ errorCount: 1, status: "error" });

            const { unmount } = mountComposable(() => useBatchErrorListener({ endpoint: "/upload", onBatchError }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_ERROR", expect.any(Function));
            stubRef.current?.emit("BATCH_ERROR", batch);
            expect(onBatchError).toHaveBeenCalledWith(batch);

            unmount();
            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_ERROR", expect.any(Function));
        });
    });

    describe(useBatchFinalizeListener, () => {
        it("delivers BatchState to onBatchFinalize", () => {
            expect.assertions(3);

            const onBatchFinalize = vi.fn();
            const batch = makeBatch({ completedCount: 1, status: "completed" });

            const { unmount } = mountComposable(() => useBatchFinalizeListener({ endpoint: "/upload", onBatchFinalize }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_FINALIZE", expect.any(Function));
            stubRef.current?.emit("BATCH_FINALIZE", batch);
            expect(onBatchFinalize).toHaveBeenCalledWith(batch);

            unmount();
            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_FINALIZE", expect.any(Function));
        });
    });

    describe(useBatchFinishListener, () => {
        it("delivers BatchState to onBatchFinish", () => {
            expect.assertions(3);

            const onBatchFinish = vi.fn();
            const batch = makeBatch({ progress: 100, status: "completed" });

            const { unmount } = mountComposable(() => useBatchFinishListener({ endpoint: "/upload", onBatchFinish }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_FINISH", expect.any(Function));
            stubRef.current?.emit("BATCH_FINISH", batch);
            expect(onBatchFinish).toHaveBeenCalledWith(batch);

            unmount();
            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_FINISH", expect.any(Function));
        });
    });

    describe(useBatchProgressListener, () => {
        it("delivers BatchState to onBatchProgress and filters UploadItem", () => {
            expect.assertions(3);

            const onBatchProgress = vi.fn();
            const batch = makeBatch({ progress: 50, status: "uploading" });

            mountComposable(() => useBatchProgressListener({ endpoint: "/upload", onBatchProgress }));

            stubRef.current?.emit("BATCH_PROGRESS", batch);
            stubRef.current?.emit("BATCH_PROGRESS", makeItem());

            expect(onBatchProgress).toHaveBeenCalledTimes(1);
            expect(onBatchProgress).toHaveBeenCalledWith(batch);
            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_PROGRESS", expect.any(Function));
        });
    });

    describe(useBatchStartListener, () => {
        it("delivers BatchState to onBatchStart", () => {
            expect.assertions(3);

            const onBatchStart = vi.fn();
            const batch = makeBatch({ status: "uploading" });

            const { unmount } = mountComposable(() => useBatchStartListener({ endpoint: "/upload", onBatchStart }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_START", expect.any(Function));
            stubRef.current?.emit("BATCH_START", batch);
            expect(onBatchStart).toHaveBeenCalledWith(batch);

            unmount();
            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_START", expect.any(Function));
        });
    });

    describe(useRetryListener, () => {
        it("invokes onRetry only when retryCount > 0", () => {
            expect.assertions(2);

            const onRetry = vi.fn();
            const firstAttempt = makeItem({ retryCount: 0, status: "uploading" });
            const retriedItem = makeItem({ id: "item-2", retryCount: 1, status: "uploading" });

            mountComposable(() => useRetryListener({ endpoint: "/upload", onRetry }));

            stubRef.current?.emit("ITEM_START", firstAttempt);
            stubRef.current?.emit("ITEM_START", retriedItem);
            stubRef.current?.emit("ITEM_START", makeBatch());

            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(retriedItem);
        });
    });
});
