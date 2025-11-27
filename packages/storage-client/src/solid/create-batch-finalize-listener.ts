import { onCleanup, onMount } from "solid-js";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";

export interface CreateBatchFinalizeListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onBatchFinalize: (batch: BatchState) => void;
}

export const createBatchFinalizeListener = (options: CreateBatchFinalizeListenerOptions): void => {
    const { endpoint, metadata, onBatchFinalize } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchFinalize(itemOrBatch);
            }
        };

        adapter.uploader.on("BATCH_FINALIZE", handler);

        onCleanup(() => {
            adapter.uploader.off("BATCH_FINALIZE", handler);
        });
    });
};
