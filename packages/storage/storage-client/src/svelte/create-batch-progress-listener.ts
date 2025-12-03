import { onDestroy, onMount } from "svelte";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";

export interface CreateBatchProgressListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onBatchProgress: (batch: BatchState) => void;
}

export const createBatchProgressListener = (options: CreateBatchProgressListenerOptions): void => {
    const { endpoint, metadata, onBatchProgress } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchProgress(itemOrBatch);
            }
        };

        adapter.uploader.on("BATCH_PROGRESS", handler);

        onDestroy(() => {
            adapter.uploader.off("BATCH_PROGRESS", handler);
        });
    });
};
