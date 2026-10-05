import { renderHook } from "@testing-library/react";
import { render as renderSvelte } from "@testing-library/svelte";
import { render as renderVue } from "@testing-library/vue";
import { createRoot } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

import { createMultipartAdapter } from "../src/core/multipart-adapter";
import type { BatchState, UploadItem } from "../src/core/uploader";
import {
    useAllAbortListener,
    useBatchCancelledListener,
    useBatchErrorListener,
    useBatchFinalizeListener,
    useBatchFinishListener,
    useBatchProgressListener,
    useBatchStartListener,
    useBatchUpload,
    useRetryListener,
} from "../src/react";
import {
    createAllAbortListener,
    createBatchCancelledListener,
    createBatchErrorListener,
    createBatchFinalizeListener,
    createBatchFinishListener,
    createBatchProgressListener,
    createBatchStartListener,
    createBatchUpload,
    createRetryListener,
} from "../src/solid";
import {
    createAllAbortListener as svelte_createAllAbortListener,
    createBatchCancelledListener as svelte_createBatchCancelledListener,
    createBatchErrorListener as svelte_createBatchErrorListener,
    createBatchFinalizeListener as svelte_createBatchFinalizeListener,
    createBatchFinishListener as svelte_createBatchFinishListener,
    createBatchProgressListener as svelte_createBatchProgressListener,
    createBatchStartListener as svelte_createBatchStartListener,
    createBatchUpload as svelte_createBatchUpload,
    createRetryListener as svelte_createRetryListener,
} from "../src/svelte";
import {
    useAllAbortListener as vue_useAllAbortListener,
    useBatchCancelledListener as vue_useBatchCancelledListener,
    useBatchErrorListener as vue_useBatchErrorListener,
    useBatchFinalizeListener as vue_useBatchFinalizeListener,
    useBatchFinishListener as vue_useBatchFinishListener,
    useBatchProgressListener as vue_useBatchProgressListener,
    useBatchStartListener as vue_useBatchStartListener,
    useBatchUpload as vue_useBatchUpload,
    useRetryListener as vue_useRetryListener,
} from "../src/vue";
import { MockXMLHttpRequest } from "./mock-xhr";
import ListenerHost from "./svelte/ListenerHost.svelte";
import { FailingXMLHttpRequest, HangingXMLHttpRequest } from "./upload-mocks";

type Listener<K extends string, T> = (options: Record<K, (payload: T) => void> & { endpoint: string }) => void;

interface Hooks {
    allAbort: Listener<"onAbort", UploadItem>;
    batchCancelled: Listener<"onBatchCancelled", BatchState>;
    batchError: Listener<"onBatchError", BatchState>;
    batchFinalize: Listener<"onBatchFinalize", BatchState>;
    batchFinish: Listener<"onBatchFinish", BatchState>;
    batchProgress: Listener<"onBatchProgress", BatchState>;
    batchStart: Listener<"onBatchStart", BatchState>;
    batchUpload: (options: { endpoint: string }) => { abortBatch: (batchId: string) => void; uploadBatch: (files: File[]) => string[] };
    retry: Listener<"onRetry", UploadItem>;
}

/** Runs `setup` inside a mounted component (or root) so the hooks' lifecycle runs. */
type Mount = <T>(setup: () => T) => { result: T; unmount: () => void };

const mountReact: Mount = (setup) => {
    const { result, unmount } = renderHook(setup);

    return { result: result.current, unmount };
};

const mountVue: Mount = <T>(setup: () => T) => {
    let result: T | undefined;
    const { unmount } = renderVue(
        defineComponent(() => {
            result = setup();

            return () => undefined;
        }),
    );

    return { result: result as T, unmount };
};

const mountSvelte: Mount = <T>(setup: () => T) => {
    let result: T | undefined;
    const { unmount } = renderSvelte(ListenerHost, {
        props: {
            listener: () => {
                result = setup();
            },
        },
    });

    return { result: result as T, unmount };
};

const mountSolid: Mount = <T>(setup: () => T) => {
    let result: T | undefined;
    let unmount: () => void = () => {};

    createRoot((dispose) => {
        unmount = dispose;
        result = setup();
    });

    return { result: result as T, unmount };
};

const frameworks: [string, Mount, Hooks][] = [
    [
        "react",
        mountReact,
        {
            allAbort: useAllAbortListener,
            batchCancelled: useBatchCancelledListener,
            batchError: useBatchErrorListener,
            batchFinalize: useBatchFinalizeListener,
            batchFinish: useBatchFinishListener,
            batchProgress: useBatchProgressListener,
            batchStart: useBatchStartListener,
            batchUpload: useBatchUpload,
            retry: useRetryListener,
        },
    ],
    [
        "vue",
        mountVue,
        {
            allAbort: vue_useAllAbortListener,
            batchCancelled: vue_useBatchCancelledListener,
            batchError: vue_useBatchErrorListener,
            batchFinalize: vue_useBatchFinalizeListener,
            batchFinish: vue_useBatchFinishListener,
            batchProgress: vue_useBatchProgressListener,
            batchStart: vue_useBatchStartListener,
            batchUpload: vue_useBatchUpload,
            retry: vue_useRetryListener,
        },
    ],
    [
        "svelte",
        mountSvelte,
        {
            allAbort: svelte_createAllAbortListener,
            batchCancelled: svelte_createBatchCancelledListener,
            batchError: svelte_createBatchErrorListener,
            batchFinalize: svelte_createBatchFinalizeListener,
            batchFinish: svelte_createBatchFinishListener,
            batchProgress: svelte_createBatchProgressListener,
            batchStart: svelte_createBatchStartListener,
            batchUpload: svelte_createBatchUpload,
            retry: svelte_createRetryListener,
        },
    ],
    [
        "solid",
        mountSolid,
        {
            allAbort: createAllAbortListener,
            batchCancelled: createBatchCancelledListener,
            batchError: createBatchErrorListener,
            batchFinalize: createBatchFinalizeListener,
            batchFinish: createBatchFinishListener,
            batchProgress: createBatchProgressListener,
            batchStart: createBatchStartListener,
            batchUpload: createBatchUpload,
            retry: createRetryListener,
        },
    ],
];

const endpoint = "https://api.example.com/listener-upload";
const createFile = (): File => new File(["test content"], "test.jpg");

describe.each(frameworks)("%s listener hooks", (_name, mount, hooks) => {
    const originalXHR = globalThis.XMLHttpRequest;

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        globalThis.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
    });

    it("should notify the batch listeners of a batch uploaded through the batch upload hook", async () => {
        expect.hasAssertions();

        globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;

        const onBatchStart = vi.fn();
        const onBatchProgress = vi.fn();
        const onBatchFinish = vi.fn();
        const onBatchFinalize = vi.fn();
        const { result, unmount } = mount(() => {
            hooks.batchStart({ endpoint, onBatchStart });
            hooks.batchProgress({ endpoint, onBatchProgress });
            hooks.batchFinish({ endpoint, onBatchFinish });
            hooks.batchFinalize({ endpoint, onBatchFinalize });

            return hooks.batchUpload({ endpoint });
        });

        result.uploadBatch([createFile()]);

        await vi.waitFor(() => {
            expect(onBatchFinalize).toHaveBeenCalledTimes(1);
        });

        expect(onBatchStart).toHaveBeenCalledTimes(1);
        expect(onBatchProgress).toHaveBeenCalledWith(expect.objectContaining({ itemIds: expect.any(Array) }));
        expect(onBatchFinish).toHaveBeenCalledWith(expect.objectContaining({ completedCount: 1, status: "completed" }));

        unmount();
    });

    it("should notify the batch error listener of a failed batch", async () => {
        expect.hasAssertions();

        globalThis.XMLHttpRequest = FailingXMLHttpRequest as unknown as typeof XMLHttpRequest;

        const onBatchError = vi.fn();
        const { result, unmount } = mount(() => {
            hooks.batchError({ endpoint, onBatchError });

            return hooks.batchUpload({ endpoint });
        });

        result.uploadBatch([createFile()]);

        await vi.waitFor(() => {
            expect(onBatchError).toHaveBeenCalledWith(expect.objectContaining({ errorCount: 1, status: "error" }));
        });

        unmount();
    });

    it("should notify the cancelled and abort listeners of an aborted batch", async () => {
        expect.assertions(2);

        globalThis.XMLHttpRequest = HangingXMLHttpRequest as unknown as typeof XMLHttpRequest;

        let batchId: string | undefined;
        const onAbort = vi.fn();
        const onBatchCancelled = vi.fn();
        const { result, unmount } = mount(() => {
            hooks.batchStart({
                endpoint,
                onBatchStart: (batch) => {
                    batchId = batch.id;
                },
            });
            hooks.allAbort({ endpoint, onAbort });
            hooks.batchCancelled({ endpoint, onBatchCancelled });

            return hooks.batchUpload({ endpoint });
        });

        result.uploadBatch([createFile()]);
        result.abortBatch(batchId as string);

        expect(onAbort).toHaveBeenCalledWith(expect.objectContaining({ status: "aborted" }));
        expect(onBatchCancelled).toHaveBeenCalledWith(expect.objectContaining({ id: batchId, status: "cancelled" }));

        unmount();
    });

    it("should notify the retry listener only when a failed item is retried", async () => {
        expect.hasAssertions();

        globalThis.XMLHttpRequest = FailingXMLHttpRequest as unknown as typeof XMLHttpRequest;

        const onRetry = vi.fn();
        const { unmount } = mount(() => {
            hooks.retry({ endpoint, onRetry });
        });

        // No upload hook exposes a retry, so retry through an adapter of its own: the listener
        // observes every uploader of the endpoint.
        const adapter = createMultipartAdapter({ endpoint });
        const [id] = adapter.uploadBatch([createFile()]);

        await vi.waitFor(() => {
            expect(adapter.uploader.getItem(id as string)?.status).toBe("error");
        });

        expect(onRetry).not.toHaveBeenCalled();

        adapter.uploader.retryItem(id as string);

        await vi.waitFor(() => {
            expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ id, retryCount: 1 }));
        });

        unmount();
        adapter.clear();
    });

    it("should stop notifying a listener once its component is unmounted", async () => {
        expect.assertions(2);

        globalThis.XMLHttpRequest = HangingXMLHttpRequest as unknown as typeof XMLHttpRequest;

        const onBatchStart = vi.fn();
        const { unmount } = mount(() => {
            hooks.batchStart({ endpoint, onBatchStart });
        });

        const adapter = createMultipartAdapter({ endpoint });

        adapter.uploadBatch([createFile()]);

        expect(onBatchStart).toHaveBeenCalledTimes(1);

        unmount();
        adapter.uploadBatch([createFile()]);

        expect(onBatchStart).toHaveBeenCalledTimes(1);

        adapter.clear();
    });
});
