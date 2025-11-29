import { onBeforeUnmount, onMounted } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";

export interface UseBatchErrorListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch encounters an error */
    onBatchError: (batch: BatchState) => void;
}

/**
 * Vue composable to listen to batch error events.
 * @param options Listener configuration options
 */
export const useBatchErrorListener = (options: UseBatchErrorListenerOptions): void => {
    const { endpoint, metadata, onBatchError } = options;

    onMounted(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchError(itemOrBatch);
            }
        };

        adapter.uploader.on("BATCH_ERROR", handler);

        onBeforeUnmount(() => {
            adapter.uploader.off("BATCH_ERROR", handler);
        });
    });
};
