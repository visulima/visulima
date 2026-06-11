import { render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BatchState, UploaderEventHandler, UploaderEventType, UploadItem } from "../../src/core/uploader";
import ListenerHost from "./ListenerHost.svelte";

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

const { createAllAbortListener } = await import("../../src/svelte/create-all-abort-listener");
const { createBatchCancelledListener } = await import("../../src/svelte/create-batch-cancelled-listener");
const { createBatchErrorListener } = await import("../../src/svelte/create-batch-error-listener");
const { createBatchFinalizeListener } = await import("../../src/svelte/create-batch-finalize-listener");
const { createBatchFinishListener } = await import("../../src/svelte/create-batch-finish-listener");
const { createBatchProgressListener } = await import("../../src/svelte/create-batch-progress-listener");
const { createBatchStartListener } = await import("../../src/svelte/create-batch-start-listener");
const { createRetryListener } = await import("../../src/svelte/create-retry-listener");

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

const mountListener = (listener: () => void): { unmount: () => void } => render(ListenerHost, { props: { listener } });

// NOTE: the svelte factories call `onDestroy` from inside an `onMount` callback,
// which Svelte intentionally does not register as a teardown hook (onDestroy
// must be called during component initialisation). These tests therefore
// verify subscription + event delivery; they do not assert unsubscribe-on-
// destroy. Asserting unsubscribe behaviour requires hoisting `onDestroy`
// out of `onMount` in the src files, which is intentionally out of scope.

describe("svelte listener factories", () => {
    beforeEach(() => {
        stubRef.current = undefined;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe(createAllAbortListener, () => {
        it("subscribes to ITEM_ABORT on mount and delivers UploadItem payloads", () => {
            expect.assertions(3);

            const onAbort = vi.fn();
            const item = makeItem({ status: "aborted" });

            mountListener(() => {
                createAllAbortListener({ endpoint: "/upload", onAbort });
            });

            expect(stubRef.current?.on).toHaveBeenCalledWith("ITEM_ABORT", expect.any(Function));

            stubRef.current?.emit("ITEM_ABORT", item);
            // Batch payloads should be filtered out.
            stubRef.current?.emit("ITEM_ABORT", makeBatch());

            expect(onAbort).toHaveBeenCalledTimes(1);
            expect(onAbort).toHaveBeenCalledWith(item);
        });
    });

    describe(createBatchCancelledListener, () => {
        it("subscribes to BATCH_CANCELLED and delivers batch payloads", () => {
            expect.assertions(3);

            const onBatchCancelled = vi.fn();
            const batch = makeBatch({ status: "cancelled" });

            mountListener(() => {
                createBatchCancelledListener({ endpoint: "/upload", onBatchCancelled });
            });

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_CANCELLED", expect.any(Function));

            stubRef.current?.emit("BATCH_CANCELLED", batch);
            stubRef.current?.emit("BATCH_CANCELLED", makeItem());

            expect(onBatchCancelled).toHaveBeenCalledTimes(1);
            expect(onBatchCancelled).toHaveBeenCalledWith(batch);
        });
    });

    describe(createBatchErrorListener, () => {
        it("subscribes to BATCH_ERROR and delivers batch payloads", () => {
            expect.assertions(2);

            const onBatchError = vi.fn();
            const batch = makeBatch({ errorCount: 1, status: "error" });

            mountListener(() => {
                createBatchErrorListener({ endpoint: "/upload", onBatchError });
            });

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_ERROR", expect.any(Function));

            stubRef.current?.emit("BATCH_ERROR", batch);

            expect(onBatchError).toHaveBeenCalledWith(batch);
        });
    });

    describe(createBatchFinalizeListener, () => {
        it("subscribes to BATCH_FINALIZE and delivers batch payloads", () => {
            expect.assertions(2);

            const onBatchFinalize = vi.fn();
            const batch = makeBatch({ completedCount: 1, status: "completed" });

            mountListener(() => {
                createBatchFinalizeListener({ endpoint: "/upload", onBatchFinalize });
            });

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_FINALIZE", expect.any(Function));

            stubRef.current?.emit("BATCH_FINALIZE", batch);

            expect(onBatchFinalize).toHaveBeenCalledWith(batch);
        });
    });

    describe(createBatchFinishListener, () => {
        it("subscribes to BATCH_FINISH and delivers batch payloads", () => {
            expect.assertions(2);

            const onBatchFinish = vi.fn();
            const batch = makeBatch({ progress: 100, status: "completed" });

            mountListener(() => {
                createBatchFinishListener({ endpoint: "/upload", onBatchFinish });
            });

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_FINISH", expect.any(Function));

            stubRef.current?.emit("BATCH_FINISH", batch);

            expect(onBatchFinish).toHaveBeenCalledWith(batch);
        });
    });

    describe(createBatchProgressListener, () => {
        it("delivers BATCH_PROGRESS payloads and filters items", () => {
            expect.assertions(3);

            const onBatchProgress = vi.fn();
            const batch = makeBatch({ progress: 50, status: "uploading" });

            mountListener(() => {
                createBatchProgressListener({ endpoint: "/upload", onBatchProgress });
            });

            stubRef.current?.emit("BATCH_PROGRESS", batch);
            stubRef.current?.emit("BATCH_PROGRESS", makeItem());

            expect(onBatchProgress).toHaveBeenCalledTimes(1);
            expect(onBatchProgress).toHaveBeenCalledWith(batch);
            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_PROGRESS", expect.any(Function));
        });
    });

    describe(createBatchStartListener, () => {
        it("delivers BATCH_START payloads", () => {
            expect.assertions(2);

            const onBatchStart = vi.fn();
            const batch = makeBatch({ status: "uploading" });

            mountListener(() => {
                createBatchStartListener({ endpoint: "/upload", onBatchStart });
            });

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_START", expect.any(Function));

            stubRef.current?.emit("BATCH_START", batch);

            expect(onBatchStart).toHaveBeenCalledWith(batch);
        });
    });

    describe(createRetryListener, () => {
        it("invokes onRetry only when retryCount > 0", () => {
            expect.assertions(2);

            const onRetry = vi.fn();
            const first = makeItem({ retryCount: 0, status: "uploading" });
            const retried = makeItem({ id: "item-2", retryCount: 3, status: "uploading" });

            mountListener(() => {
                createRetryListener({ endpoint: "/upload", onRetry });
            });

            stubRef.current?.emit("ITEM_START", first);
            stubRef.current?.emit("ITEM_START", retried);
            stubRef.current?.emit("ITEM_START", makeBatch());

            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(retried);
        });
    });
});
