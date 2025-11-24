import { onDestroy, onMount } from "svelte";

import type { BatchState } from "../core/uploader";
import { createMultipartAdapter } from "../core/multipart-adapter";

export interface CreateBatchProgressListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onBatchProgress: (batch: BatchState) => void;
}

export const createBatchProgressListener = (options: CreateBatchProgressListenerOptions): void => {
    const { endpoint, metadata, onBatchProgress } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (batch: BatchState): void => onBatchProgress(batch);

        adapter.uploader.on("BATCH_PROGRESS", handler);

        onDestroy(() => {
            adapter.uploader.off("BATCH_PROGRESS", handler);
        });
    });
};
