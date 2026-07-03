import { onDestroy, onMount } from "svelte";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";

export interface CreateBatchStartListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onBatchStart: (batch: BatchState) => void;
}

export const createBatchStartListener = (options: CreateBatchStartListenerOptions): void => {
    const { endpoint, metadata, onBatchStart } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchStart(itemOrBatch);
            }
        };

        adapter.uploader.on("BATCH_START", handler);

        onDestroy(() => {
            adapter.uploader.off("BATCH_START", handler);
        });
    });
};
