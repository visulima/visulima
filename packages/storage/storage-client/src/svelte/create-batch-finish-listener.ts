import { onDestroy, onMount } from "svelte";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";

export interface CreateBatchFinishListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onBatchFinish: (batch: BatchState) => void;
}

export const createBatchFinishListener = (options: CreateBatchFinishListenerOptions): void => {
    const { endpoint, metadata, onBatchFinish } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchFinish(itemOrBatch);
            }
        };

        adapter.uploader.on("BATCH_FINISH", handler);

        onDestroy(() => {
            adapter.uploader.off("BATCH_FINISH", handler);
        });
    });
};
