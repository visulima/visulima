import { createRoot } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const { createAllAbortListener } = await import("../../src/solid/create-all-abort-listener");
const { createBatchCancelledListener } = await import("../../src/solid/create-batch-cancelled-listener");
const { createBatchErrorListener } = await import("../../src/solid/create-batch-error-listener");
const { createBatchFinalizeListener } = await import("../../src/solid/create-batch-finalize-listener");
const { createBatchFinishListener } = await import("../../src/solid/create-batch-finish-listener");
const { createBatchProgressListener } = await import("../../src/solid/create-batch-progress-listener");
const { createBatchStartListener } = await import("../../src/solid/create-batch-start-listener");
const { createRetryListener } = await import("../../src/solid/create-retry-listener");

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

// Runs a Solid `onMount` factory inside a `createRoot` so onMount + onCleanup
// fire. We need to actually mount via solid-js/web's render to trigger
// `onMount` callbacks — `createRoot` alone is not enough on its own without
// the render lifecycle. For these listeners we manually flush by importing
// solid-js/web's `render` from inside test.
const runInRoot = async (factory: () => void): Promise<{ dispose: () => void }> => {
    let dispose: () => void = () => {};

    createRoot((d) => {
        dispose = d;
        factory();
    });

    // onMount runs after the root is created — flush microtasks.
    await Promise.resolve();
    await Promise.resolve();

    return { dispose };
};

beforeEach(() => {
    stubRef.current = undefined;
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("solid listener factories", () => {
    describe(createAllAbortListener, () => {
        it("subscribes to ITEM_ABORT on mount and unsubscribes on cleanup", async () => {
            expect.assertions(4);

            const onAbort = vi.fn();
            const { dispose } = await runInRoot(() => createAllAbortListener({ endpoint: "/upload", onAbort }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("ITEM_ABORT", expect.any(Function));

            const item = makeItem({ status: "aborted" });

            stubRef.current?.emit("ITEM_ABORT", item);
            stubRef.current?.emit("ITEM_ABORT", makeBatch()); // ignored

            expect(onAbort).toHaveBeenCalledTimes(1);
            expect(onAbort).toHaveBeenCalledWith(item);

            dispose();
            expect(stubRef.current?.off).toHaveBeenCalledWith("ITEM_ABORT", expect.any(Function));
        });
    });

    describe(createBatchCancelledListener, () => {
        it("subscribes to BATCH_CANCELLED and unsubscribes on cleanup", async () => {
            expect.assertions(3);

            const onBatchCancelled = vi.fn();
            const batch = makeBatch({ status: "cancelled" });
            const { dispose } = await runInRoot(() => createBatchCancelledListener({ endpoint: "/upload", onBatchCancelled }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_CANCELLED", expect.any(Function));
            stubRef.current?.emit("BATCH_CANCELLED", batch);
            expect(onBatchCancelled).toHaveBeenCalledWith(batch);

            dispose();
            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_CANCELLED", expect.any(Function));
        });
    });

    describe(createBatchErrorListener, () => {
        it("subscribes / unsubscribes / delivers", async () => {
            expect.assertions(3);

            const onBatchError = vi.fn();
            const batch = makeBatch({ errorCount: 1, status: "error" });
            const { dispose } = await runInRoot(() => createBatchErrorListener({ endpoint: "/upload", onBatchError }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_ERROR", expect.any(Function));
            stubRef.current?.emit("BATCH_ERROR", batch);
            expect(onBatchError).toHaveBeenCalledWith(batch);

            dispose();
            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_ERROR", expect.any(Function));
        });
    });

    describe(createBatchFinalizeListener, () => {
        it("subscribes / unsubscribes / delivers", async () => {
            expect.assertions(3);

            const onBatchFinalize = vi.fn();
            const batch = makeBatch({ completedCount: 1, status: "completed" });
            const { dispose } = await runInRoot(() => createBatchFinalizeListener({ endpoint: "/upload", onBatchFinalize }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_FINALIZE", expect.any(Function));
            stubRef.current?.emit("BATCH_FINALIZE", batch);
            expect(onBatchFinalize).toHaveBeenCalledWith(batch);

            dispose();
            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_FINALIZE", expect.any(Function));
        });
    });

    describe(createBatchFinishListener, () => {
        it("subscribes / unsubscribes / delivers", async () => {
            expect.assertions(3);

            const onBatchFinish = vi.fn();
            const batch = makeBatch({ progress: 100, status: "completed" });
            const { dispose } = await runInRoot(() => createBatchFinishListener({ endpoint: "/upload", onBatchFinish }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_FINISH", expect.any(Function));
            stubRef.current?.emit("BATCH_FINISH", batch);
            expect(onBatchFinish).toHaveBeenCalledWith(batch);

            dispose();
            expect(stubRef.current?.off).toHaveBeenCalledWith("BATCH_FINISH", expect.any(Function));
        });
    });

    describe(createBatchProgressListener, () => {
        it("filters non-batch payloads", async () => {
            expect.assertions(3);

            const onBatchProgress = vi.fn();
            const batch = makeBatch({ progress: 42, status: "uploading" });

            await runInRoot(() => createBatchProgressListener({ endpoint: "/upload", onBatchProgress }));

            stubRef.current?.emit("BATCH_PROGRESS", batch);
            stubRef.current?.emit("BATCH_PROGRESS", makeItem());

            expect(onBatchProgress).toHaveBeenCalledTimes(1);
            expect(onBatchProgress).toHaveBeenCalledWith(batch);
            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_PROGRESS", expect.any(Function));
        });
    });

    describe(createBatchStartListener, () => {
        it("delivers BATCH_START to callback", async () => {
            expect.assertions(2);

            const onBatchStart = vi.fn();
            const batch = makeBatch({ status: "uploading" });

            await runInRoot(() => createBatchStartListener({ endpoint: "/upload", onBatchStart }));

            expect(stubRef.current?.on).toHaveBeenCalledWith("BATCH_START", expect.any(Function));
            stubRef.current?.emit("BATCH_START", batch);
            expect(onBatchStart).toHaveBeenCalledWith(batch);
        });
    });

    describe(createRetryListener, () => {
        it("invokes onRetry only when retryCount > 0", async () => {
            expect.assertions(2);

            const onRetry = vi.fn();
            const first = makeItem({ retryCount: 0 });
            const retried = makeItem({ id: "item-2", retryCount: 4 });

            await runInRoot(() => createRetryListener({ endpoint: "/upload", onRetry }));

            stubRef.current?.emit("ITEM_START", first);
            stubRef.current?.emit("ITEM_START", retried);
            stubRef.current?.emit("ITEM_START", makeBatch());

            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(retried);
        });
    });
});
