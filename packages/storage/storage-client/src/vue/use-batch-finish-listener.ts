import { onBeforeUnmount, onMounted } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";

export interface UseBatchFinishListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch finishes successfully */
    onBatchFinish: (batch: BatchState) => void;
}

/**
 * Vue composable to listen to batch finish events.
 * @param options Listener configuration options
 */
export const useBatchFinishListener = (options: UseBatchFinishListenerOptions): void => {
    const { endpoint, metadata, onBatchFinish } = options;

    onMounted(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchFinish(itemOrBatch);
            }
        };

        adapter.uploader.on("BATCH_FINISH", handler);

        onBeforeUnmount(() => {
            adapter.uploader.off("BATCH_FINISH", handler);
        });
    });
};
