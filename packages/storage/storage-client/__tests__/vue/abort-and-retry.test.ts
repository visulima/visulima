import { render } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

// Capture each adapter we hand out so individual tests can assert that the
// composable forwards to the right uploader method.
// The hooks send their commands through the per-endpoint channel; record what they send.
vi.mock(import("../../src/core/uploader"), async (importOriginal) => {
    const actual = await importOriginal();

    return { ...actual, dispatch: vi.fn() };
});

const { dispatch } = await import("../../src/core/uploader");
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

describe("vue abort and retry composables", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe(useAbortAll, () => {
        it("dispatches abortAll to the endpoint when abortAll is invoked", () => {
            expect.assertions(2);

            const { result } = mountComposable(() => useAbortAll({ endpoint: "/upload" }));

            expect(result.abortAll).toBeTypeOf("function");

            result.abortAll();

            expect(dispatch).toHaveBeenCalledWith("/upload", { type: "abortAll" });
        });
    });

    describe(useAbortBatch, () => {
        it("forwards batchId to the endpoint's abortBatch command", () => {
            expect.assertions(1);

            const { result } = mountComposable(() => useAbortBatch({ endpoint: "/upload" }));

            result.abortBatch("batch-7");

            expect(dispatch).toHaveBeenCalledWith("/upload", { id: "batch-7", type: "abortBatch" });
        });
    });

    describe(useAbortItem, () => {
        it("forwards itemId to the endpoint's abortItem command", () => {
            expect.assertions(1);

            const { result } = mountComposable(() => useAbortItem({ endpoint: "/upload" }));

            result.abortItem("item-3");

            expect(dispatch).toHaveBeenCalledWith("/upload", { id: "item-3", type: "abortItem" });
        });
    });

    describe(useRetry, () => {
        it("forwards itemId to the endpoint's retryItem command", () => {
            expect.assertions(1);

            const { result } = mountComposable(() => useRetry({ endpoint: "/upload" }));

            result.retryItem("item-9");

            expect(dispatch).toHaveBeenCalledWith("/upload", { id: "item-9", type: "retryItem" });
        });
    });

    describe(useBatchRetry, () => {
        it("forwards batchId to the endpoint's retryBatch command", () => {
            expect.assertions(1);

            const { result } = mountComposable(() => useBatchRetry({ endpoint: "/upload" }));

            result.retryBatch("batch-5");

            expect(dispatch).toHaveBeenCalledWith("/upload", { id: "batch-5", type: "retryBatch" });
        });
    });
});
