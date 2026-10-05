import { renderHook } from "@testing-library/react";
import { render as renderSvelte } from "@testing-library/svelte";
import { render as renderVue } from "@testing-library/vue";
import { createRoot } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

import type { BatchState, UploadItem } from "../src/core/uploader";
import { subscribe } from "../src/core/uploader";
import { useAbortAll, useAbortBatch, useAbortItem, useBatchRetry, useBatchUpload, useRetry } from "../src/react";
import { createAbortAll, createAbortBatch, createAbortItem, createBatchRetry, createBatchUpload, createRetry } from "../src/solid";
import {
    createAbortAll as svelte_createAbortAll,
    createAbortBatch as svelte_createAbortBatch,
    createAbortItem as svelte_createAbortItem,
    createBatchRetry as svelte_createBatchRetry,
    createBatchUpload as svelte_createBatchUpload,
    createRetry as svelte_createRetry,
} from "../src/svelte";
import {
    useAbortAll as vue_useAbortAll,
    useAbortBatch as vue_useAbortBatch,
    useAbortItem as vue_useAbortItem,
    useBatchRetry as vue_useBatchRetry,
    useBatchUpload as vue_useBatchUpload,
    useRetry as vue_useRetry,
} from "../src/vue";
import ListenerHost from "./svelte/ListenerHost.svelte";
import { FailingXMLHttpRequest, HangingXMLHttpRequest } from "./upload-mocks";

interface Commands {
    abortAll: () => void;
    abortBatch: (batchId: string) => void;
    abortItem: (id: string) => void;
    retryBatch: (batchId: string) => void;
    retryItem: (id: string) => void;
}

interface Hooks {
    abortAll: (options: { endpoint: string }) => Pick<Commands, "abortAll">;
    abortBatch: (options: { endpoint: string }) => Pick<Commands, "abortBatch">;
    abortItem: (options: { endpoint: string }) => Pick<Commands, "abortItem">;
    batchRetry: (options: { endpoint: string }) => Pick<Commands, "retryBatch">;
    batchUpload: (options: { endpoint: string }) => { reset: () => void; uploadBatch: (files: File[]) => string[] };
    retry: (options: { endpoint: string }) => Pick<Commands, "retryItem">;
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
            abortAll: useAbortAll,
            abortBatch: useAbortBatch,
            abortItem: useAbortItem,
            batchRetry: useBatchRetry,
            batchUpload: useBatchUpload,
            retry: useRetry,
        },
    ],
    [
        "vue",
        mountVue,
        {
            abortAll: vue_useAbortAll,
            abortBatch: vue_useAbortBatch,
            abortItem: vue_useAbortItem,
            batchRetry: vue_useBatchRetry,
            batchUpload: vue_useBatchUpload,
            retry: vue_useRetry,
        },
    ],
    [
        "svelte",
        mountSvelte,
        {
            abortAll: svelte_createAbortAll,
            abortBatch: svelte_createAbortBatch,
            abortItem: svelte_createAbortItem,
            batchRetry: svelte_createBatchRetry,
            batchUpload: svelte_createBatchUpload,
            retry: svelte_createRetry,
        },
    ],
    [
        "solid",
        mountSolid,
        {
            abortAll: createAbortAll,
            abortBatch: createAbortBatch,
            abortItem: createAbortItem,
            batchRetry: createBatchRetry,
            batchUpload: createBatchUpload,
            retry: createRetry,
        },
    ],
];

const endpoint = "https://api.example.com/command-upload";
const createFile = (): File => new File(["test content"], "test.jpg");

describe.each(frameworks)("%s command hooks", (_name, mount, hooks) => {
    const originalXHR = globalThis.XMLHttpRequest;
    const unsubscribers: VoidFunction[] = [];

    /** Records every payload of `event` the endpoint's uploaders emit. */
    const record = <T extends BatchState | UploadItem>(event: Parameters<typeof subscribe>[1]): T[] => {
        const payloads: T[] = [];

        unsubscribers.push(subscribe(endpoint, event, (payload) => payloads.push({ ...payload } as T)));

        return payloads;
    };

    const mountAll = (): { result: Commands & ReturnType<Hooks["batchUpload"]>; unmount: () => void } =>
        mount(() => {
            // Only the upload half of the batch hook: its own `abortBatch` must not shadow the command hook's.
            const { reset, uploadBatch } = hooks.batchUpload({ endpoint });

            return {
                ...hooks.abortAll({ endpoint }),
                ...hooks.abortBatch({ endpoint }),
                ...hooks.abortItem({ endpoint }),
                ...hooks.batchRetry({ endpoint }),
                ...hooks.retry({ endpoint }),
                reset,
                uploadBatch,
            };
        });

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        unsubscribers.splice(0).forEach((unsubscribe) => {
            unsubscribe();
        });
        globalThis.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
    });

    it("should abort an item of a batch uploaded through the batch upload hook", () => {
        expect.assertions(2);

        globalThis.XMLHttpRequest = HangingXMLHttpRequest as unknown as typeof XMLHttpRequest;

        const aborted = record<UploadItem>("ITEM_ABORT");
        const { result, unmount } = mountAll();
        const [first, second] = result.uploadBatch([createFile(), createFile()]);

        result.abortItem(first as string);

        expect(aborted.map((item) => item.id)).toStrictEqual([first]);
        expect(aborted.some((item) => item.id === second)).toBe(false);

        result.reset();
        unmount();
    });

    it("should abort a batch uploaded through the batch upload hook", () => {
        expect.assertions(2);

        globalThis.XMLHttpRequest = HangingXMLHttpRequest as unknown as typeof XMLHttpRequest;

        const started = record<BatchState>("BATCH_START");
        const cancelled = record<BatchState>("BATCH_CANCELLED");
        const aborted = record<UploadItem>("ITEM_ABORT");
        const { result, unmount } = mountAll();
        const ids = result.uploadBatch([createFile(), createFile()]);

        result.abortBatch(started[0]?.id as string);

        expect(aborted.map((item) => item.id)).toStrictEqual(ids);
        expect(cancelled).toStrictEqual([expect.objectContaining({ id: started[0]?.id, status: "cancelled" })]);

        result.reset();
        unmount();
    });

    it("should abort every upload to the endpoint", () => {
        expect.assertions(2);

        globalThis.XMLHttpRequest = HangingXMLHttpRequest as unknown as typeof XMLHttpRequest;

        const aborted = record<UploadItem>("ITEM_ABORT");
        const { result, unmount } = mountAll();
        const ids = [...result.uploadBatch([createFile()]), ...result.uploadBatch([createFile()])];

        result.abortAll();

        expect(aborted).toHaveLength(ids.length);
        expect(new Set(aborted.map((item) => item.id))).toStrictEqual(new Set(ids));

        result.reset();
        unmount();
    });

    it("should retry a failed item of a batch uploaded through the batch upload hook", async () => {
        expect.hasAssertions();

        globalThis.XMLHttpRequest = FailingXMLHttpRequest as unknown as typeof XMLHttpRequest;

        const failed = record<UploadItem>("ITEM_ERROR");
        const starts = record<UploadItem>("ITEM_START");
        const { result, unmount } = mountAll();
        const [id] = result.uploadBatch([createFile()]);

        await vi.waitFor(() => {
            expect(failed).toHaveLength(1);
        });

        result.retryItem(id as string);

        expect(starts).toContainEqual(expect.objectContaining({ id, retryCount: 1 }));

        result.reset();
        unmount();
    });

    it("should retry the failed items of a batch uploaded through the batch upload hook", async () => {
        expect.hasAssertions();

        globalThis.XMLHttpRequest = FailingXMLHttpRequest as unknown as typeof XMLHttpRequest;

        const batchErrors = record<BatchState>("BATCH_ERROR");
        const starts = record<UploadItem>("ITEM_START");
        const { result, unmount } = mountAll();
        const ids = result.uploadBatch([createFile(), createFile()]);

        await vi.waitFor(() => {
            expect(batchErrors).toHaveLength(1);
        });

        result.retryBatch(batchErrors[0]?.id as string);

        expect(starts.filter((item) => item.retryCount === 1).map((item) => item.id)).toStrictEqual(ids);

        result.reset();
        unmount();
    });

    it("should do nothing for an id no upload to the endpoint owns", () => {
        expect.assertions(1);

        const { result, unmount } = mountAll();

        expect(() => {
            result.abortItem("item-unknown");
            result.abortBatch("batch-unknown");
            result.retryItem("item-unknown");
            result.retryBatch("batch-unknown");
            result.abortAll();
        }).not.toThrow();

        unmount();
    });
});
