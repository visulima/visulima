import { onDestroy, onMount } from "svelte";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState } from "../core/uploader";

export interface CreateBatchFinishListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onBatchFinish: (batch: BatchState) => void;
}

export const createBatchFinishListener = (options: CreateBatchFinishListenerOptions): void => {
    const { endpoint, metadata, onBatchFinish } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (batch: BatchState): void => onBatchFinish(batch);

        adapter.uploader.on("BATCH_FINISH", handler);

        onDestroy(() => {
            adapter.uploader.off("BATCH_FINISH", handler);
        });
    });
};
