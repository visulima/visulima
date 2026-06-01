import { render } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { defineComponent, h } from "vue";

// Capture each adapter we hand out so individual tests can assert that the
// composable forwards to the right uploader method.
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

const { useAbortAll } = await import("../../src/vue/use-abort-all");
const { useAbortBatch } = await import("../../src/vue/use-abort-batch");
const { useAbortItem } = await import("../../src/vue/use-abort-item");
const { useBatchRetry } = await import("../../src/vue/use-batch-retry");
const { useRetry } = await import("../../src/vue/use-retry");

const mountComposable = <T>(composable: () => T): { result: T } => {
    let captured: T | undefined;

    const Cmp = defineComponent({
        setup() {
            captured = composable();

            return () => h("div");
        },
    });

    render(Cmp);

    return { result: captured as T };
};

beforeEach(() => {
    lastAdapter.current = undefined;
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("vue abort and retry composables", () => {
    describe(useAbortAll, () => {
        it("calls adapter.abort when abortAll is invoked", () => {
            expect.assertions(2);

            const { result } = mountComposable(() => useAbortAll({ endpoint: "/upload" }));

            expectTypeOf(result.abortAll).toBeFunction();

            result.abortAll();

            expect(lastAdapter.current?.abort).toHaveBeenCalledTimes(1);
        });
    });

    describe(useAbortBatch, () => {
        it("forwards batchId to adapter.abortBatch", () => {
            expect.assertions(1);

            const { result } = mountComposable(() => useAbortBatch({ endpoint: "/upload" }));

            result.abortBatch("batch-7");

            expect(lastAdapter.current?.abortBatch).toHaveBeenCalledWith("batch-7");
        });
    });

    describe(useAbortItem, () => {
        it("forwards itemId to adapter.abortItem", () => {
            expect.assertions(1);

            const { result } = mountComposable(() => useAbortItem({ endpoint: "/upload" }));

            result.abortItem("item-3");

            expect(lastAdapter.current?.abortItem).toHaveBeenCalledWith("item-3");
        });
    });

    describe(useRetry, () => {
        it("forwards itemId to uploader.retryItem", () => {
            expect.assertions(1);

            const { result } = mountComposable(() => useRetry({ endpoint: "/upload" }));

            result.retryItem("item-9");

            expect(lastAdapter.current?.uploader.retryItem).toHaveBeenCalledWith("item-9");
        });
    });

    describe(useBatchRetry, () => {
        it("forwards batchId to uploader.retryBatch", () => {
            expect.assertions(1);

            const { result } = mountComposable(() => useBatchRetry({ endpoint: "/upload" }));

            result.retryBatch("batch-5");

            expect(lastAdapter.current?.uploader.retryBatch).toHaveBeenCalledWith("batch-5");
        });
    });
});
