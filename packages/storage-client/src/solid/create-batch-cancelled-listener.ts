import { onCleanup, onMount } from "solid-js";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";

export interface CreateBatchCancelledListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onBatchCancelled: (batch: BatchState) => void;
}

export const createBatchCancelledListener = (options: CreateBatchCancelledListenerOptions): void => {
    const { endpoint, metadata, onBatchCancelled } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchCancelled(itemOrBatch);
            }
        };

        adapter.uploader.on("BATCH_CANCELLED", handler);

        onCleanup(() => {
            adapter.uploader.off("BATCH_CANCELLED", handler);
        });
    });
};
