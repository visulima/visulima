import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BatchState, UploaderEventHandler, UploaderEventType, UploadItem } from "../../src/core/uploader";

// Lightweight in-memory uploader stub. The listener hooks only call `.on` /
// `.off` and rely on event delivery — they never touch `add`, `upload`, etc.
// We expose `emit` here as a test-only helper so each test can fire the event
// the hook is subscribed to.
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
        handlers.get(event)?.forEach((handler) => {
            handler(payload);
        });
    };

    return { emit, handlers, off, on };
};

type StubUploader = ReturnType<typeof createStubUploader>;

const stubRef: { current: StubUploader | undefined } = { current: undefined };

vi.mock(import("../../src/core/multipart-adapter"), () => {
    return {
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
    };
});

// Import hooks AFTER mock is registered.
const { useAllAbortListener } = await import("../../src/react/use-all-abort-listener");
const { useBatchCancelledListener } = await import("../../src/react/use-batch-cancelled-listener");
const { useBatchErrorListener } = await import("../../src/react/use-batch-error-listener");
const { useBatchFinalizeListener } = await import("../../src/react/use-batch-finalize-listener");
const { useBatchFinishListener } = await import("../../src/react/use-batch-finish-listener");
const { useBatchProgressListener } = await import("../../src/react/use-batch-progress-listener");
const { useBatchStartListener } = await import("../../src/react/use-batch-start-listener");
const { useRetryListener } = await import("../../src/react/use-retry-listener");

const makeItem = (overrides: Partial<UploadItem> = {}): UploadItem => {
    return {
        completed: 0,
        file: new File(["x"], "x.txt"),
        id: "item-1",
        loaded: 0,
        retryCount: 0,
        size: 1,
        status: "pending",
        ...overrides,
    };
};

const makeBatch = (overrides: Partial<BatchState> = {}): BatchState => {
    return {
        completedCount: 0,
        errorCount: 0,
        id: "batch-1",
        itemIds: ["item-1"],
        progress: 0,
        status: "pending",
        totalCount: 1,
        ...overrides,
    };
};

beforeEach(() => {
    stubRef.current = undefined;
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("react listener hooks", () => {
    describe(useAllAbortListener, () => {
        it("subscribes to ITEM_ABORT on mount and unsubscribes on unmount", () => {
            expect.assertions(4);

            const onAbort = vi.fn();
            const { unmount } = renderHook(() => { useAllAbortListener({ endpoint: "/upload", onAbort }); });

            const stub = stubRef.current;

            expect(stub).toBeDefined();
            expect(stub?.on).toHaveBeenCalledWith("ITEM_ABORT", expect.any(Function));

            unmount();

            expect(stub?.off).toHaveBeenCalledWith("ITEM_ABORT", expect.any(Function));
            expect(stub?.handlers.get("ITEM_ABORT")?.size ?? 0).toBe(0);
        });

        it("invokes onAbort when the uploader emits ITEM_ABORT for an item", () => {
            expect.assertions(1);

            const onAbort = vi.fn();
            const item = makeItem({ status: "aborted" });

            renderHook(() => { useAllAbortListener({ endpoint: "/upload", onAbort }); });
            stubRef.current?.emit("ITEM_ABORT", item);

            expect(onAbort).toHaveBeenCalledWith(item);
        });

        it("ignores ITEM_ABORT payloads that look like batches", () => {
            expect.assertions(1);

            const onAbort = vi.fn();

            renderHook(() => { useAllAbortListener({ endpoint: "/upload", onAbort }); });
            // BatchState payload shouldn't reach the user callback.
            stubRef.current?.emit("ITEM_ABORT", makeBatch());

            expect(onAbort).not.toHaveBeenCalled();
        });
    });

    describe(useBatchCancelledListener, () => {
        it("subscribes / unsubscribes from BATCH_CANCELLED", () => {
            expect.assertions(2);

            const onBatchCancelled = vi.fn();
            const { unmount } = renderHook(() => { useBatchCancelledListener({ endpoint: "/upload", onBatchCancelled }); });

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_CANCELLED", expect.any(Function));

            unmount();

            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_CANCELLED", expect.any(Function));
        });

        it("delivers BatchState payloads to onBatchCancelled", () => {
            expect.assertions(2);

            const onBatchCancelled = vi.fn();
            const batch = makeBatch({ status: "cancelled" });

            renderHook(() => { useBatchCancelledListener({ endpoint: "/upload", onBatchCancelled }); });
            stubRef.current?.emit("BATCH_CANCELLED", batch);
            // UploadItem payload must be filtered out.
            stubRef.current?.emit("BATCH_CANCELLED", makeItem());

            expect(onBatchCancelled).toHaveBeenCalledTimes(1);
            expect(onBatchCancelled).toHaveBeenCalledWith(batch);
        });
    });

    describe(useBatchErrorListener, () => {
        it("subscribes / unsubscribes from BATCH_ERROR", () => {
            expect.assertions(2);

            const onBatchError = vi.fn();
            const { unmount } = renderHook(() => { useBatchErrorListener({ endpoint: "/upload", onBatchError }); });

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_ERROR", expect.any(Function));

            unmount();

            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_ERROR", expect.any(Function));
        });

        it("delivers BatchState to onBatchError", () => {
            expect.assertions(1);

            const onBatchError = vi.fn();
            const batch = makeBatch({ errorCount: 1, status: "error" });

            renderHook(() => { useBatchErrorListener({ endpoint: "/upload", onBatchError }); });
            stubRef.current?.emit("BATCH_ERROR", batch);

            expect(onBatchError).toHaveBeenCalledWith(batch);
        });
    });

    describe(useBatchFinalizeListener, () => {
        it("subscribes / unsubscribes from BATCH_FINALIZE", () => {
            expect.assertions(2);

            const onBatchFinalize = vi.fn();
            const { unmount } = renderHook(() => { useBatchFinalizeListener({ endpoint: "/upload", onBatchFinalize }); });

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_FINALIZE", expect.any(Function));

            unmount();

            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_FINALIZE", expect.any(Function));
        });

        it("delivers BatchState to onBatchFinalize", () => {
            expect.assertions(1);

            const onBatchFinalize = vi.fn();
            const batch = makeBatch({ completedCount: 1, status: "completed" });

            renderHook(() => { useBatchFinalizeListener({ endpoint: "/upload", onBatchFinalize }); });
            stubRef.current?.emit("BATCH_FINALIZE", batch);

            expect(onBatchFinalize).toHaveBeenCalledWith(batch);
        });
    });

    describe(useBatchFinishListener, () => {
        it("subscribes / unsubscribes from BATCH_FINISH", () => {
            expect.assertions(2);

            const onBatchFinish = vi.fn();
            const { unmount } = renderHook(() => { useBatchFinishListener({ endpoint: "/upload", onBatchFinish }); });

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_FINISH", expect.any(Function));

            unmount();

            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_FINISH", expect.any(Function));
        });

        it("delivers BatchState to onBatchFinish", () => {
            expect.assertions(1);

            const onBatchFinish = vi.fn();
            const batch = makeBatch({ progress: 100, status: "completed" });

            renderHook(() => { useBatchFinishListener({ endpoint: "/upload", onBatchFinish }); });
            stubRef.current?.emit("BATCH_FINISH", batch);

            expect(onBatchFinish).toHaveBeenCalledWith(batch);
        });
    });

    describe(useBatchProgressListener, () => {
        it("subscribes / unsubscribes from BATCH_PROGRESS", () => {
            expect.assertions(2);

            const onBatchProgress = vi.fn();
            const { unmount } = renderHook(() => { useBatchProgressListener({ endpoint: "/upload", onBatchProgress }); });

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_PROGRESS", expect.any(Function));

            unmount();

            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_PROGRESS", expect.any(Function));
        });

        it("delivers BatchState to onBatchProgress and ignores UploadItem", () => {
            expect.assertions(2);

            const onBatchProgress = vi.fn();
            const batch = makeBatch({ progress: 42, status: "uploading" });

            renderHook(() => { useBatchProgressListener({ endpoint: "/upload", onBatchProgress }); });
            stubRef.current?.emit("BATCH_PROGRESS", batch);
            stubRef.current?.emit("BATCH_PROGRESS", makeItem());

            expect(onBatchProgress).toHaveBeenCalledTimes(1);
            expect(onBatchProgress).toHaveBeenCalledWith(batch);
        });
    });

    describe(useBatchStartListener, () => {
        it("subscribes / unsubscribes from BATCH_START", () => {
            expect.assertions(2);

            const onBatchStart = vi.fn();
            const { unmount } = renderHook(() => { useBatchStartListener({ endpoint: "/upload", onBatchStart }); });

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_START", expect.any(Function));

            unmount();

            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_START", expect.any(Function));
        });

        it("delivers BatchState to onBatchStart", () => {
            expect.assertions(1);

            const onBatchStart = vi.fn();
            const batch = makeBatch({ status: "uploading" });

            renderHook(() => { useBatchStartListener({ endpoint: "/upload", onBatchStart }); });
            stubRef.current?.emit("BATCH_START", batch);

            expect(onBatchStart).toHaveBeenCalledWith(batch);
        });
    });

    describe(useRetryListener, () => {
        it("subscribes / unsubscribes from ITEM_START", () => {
            expect.assertions(2);

            const onRetry = vi.fn();
            const { unmount } = renderHook(() => { useRetryListener({ endpoint: "/upload", onRetry }); });

            expect(stubRef.current?.on).toHaveBeenCalledWith("ITEM_START", expect.any(Function));

            unmount();

            expect(stubRef.current?.off).toHaveBeenCalledWith("ITEM_START", expect.any(Function));
        });

        it("invokes onRetry only when retryCount > 0", () => {
            expect.assertions(2);

            const onRetry = vi.fn();
            const firstAttempt = makeItem({ retryCount: 0, status: "uploading" });
            const retriedItem = makeItem({ id: "item-2", retryCount: 2, status: "uploading" });

            renderHook(() => { useRetryListener({ endpoint: "/upload", onRetry }); });
            // Initial start — should NOT trigger.
            stubRef.current?.emit("ITEM_START", firstAttempt);
            // Retry — SHOULD trigger.
            stubRef.current?.emit("ITEM_START", retriedItem);
            // BatchState payload — should never trigger.
            stubRef.current?.emit("ITEM_START", makeBatch());

            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(retriedItem);
        });
    });

    describe("callback ref updates", () => {
        it("uses the latest onAbort callback without re-subscribing", () => {
            expect.assertions(3);

            const first = vi.fn();
            const second = vi.fn();

            const { rerender } = renderHook(({ cb }: { cb: (item: UploadItem) => void }) => { useAllAbortListener({ endpoint: "/upload", onAbort: cb }); }, {
                initialProps: { cb: first },
            });

            rerender({ cb: second });
            stubRef.current?.emit("ITEM_ABORT", makeItem());

            expect(first).not.toHaveBeenCalled();
            expect(second).toHaveBeenCalledTimes(1);
            // Subscribe should have been called exactly once — the callback
            // change must not re-subscribe.
            expect(stubRef.current?.on).toHaveBeenCalledTimes(1);
        });
    });
});
