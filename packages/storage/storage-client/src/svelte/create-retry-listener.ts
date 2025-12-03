import { onDestroy, onMount } from "svelte";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";

export interface CreateRetryListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onRetry: (item: UploadItem) => void;
}

export const createRetryListener = (options: CreateRetryListenerOptions): void => {
    const { endpoint, metadata, onRetry } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });

        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("file" in itemOrBatch && itemOrBatch.retryCount && itemOrBatch.retryCount > 0) {
                onRetry(itemOrBatch);
            }
        };

        adapter.uploader.on("ITEM_START", handler);

        onDestroy(() => {
            adapter.uploader.off("ITEM_START", handler);
        });
    });
};
