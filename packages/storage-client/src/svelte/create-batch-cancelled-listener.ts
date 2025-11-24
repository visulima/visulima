import { onDestroy, onMount } from "svelte";

import type { BatchState } from "../core/uploader";
import { createMultipartAdapter } from "../core/multipart-adapter";

export interface CreateBatchCancelledListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onBatchCancelled: (batch: BatchState) => void;
}

export const createBatchCancelledListener = (options: CreateBatchCancelledListenerOptions): void => {
    const { endpoint, metadata, onBatchCancelled } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (batch: BatchState): void => onBatchCancelled(batch);

        adapter.uploader.on("BATCH_CANCELLED", handler);

        onDestroy(() => {
            adapter.uploader.off("BATCH_CANCELLED", handler);
        });
    });
};
