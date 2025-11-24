import { onDestroy, onMount } from "svelte";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState } from "../core/uploader";

export interface CreateBatchFinalizeListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onBatchFinalize: (batch: BatchState) => void;
}

export const createBatchFinalizeListener = (options: CreateBatchFinalizeListenerOptions): void => {
    const { endpoint, metadata, onBatchFinalize } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (batch: BatchState): void => onBatchFinalize(batch);

        adapter.uploader.on("BATCH_FINALIZE", handler);

        onDestroy(() => {
            adapter.uploader.off("BATCH_FINALIZE", handler);
        });
    });
};
