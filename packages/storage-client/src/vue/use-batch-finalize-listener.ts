import { onBeforeUnmount, onMounted } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState } from "../core/uploader";

export interface UseBatchFinalizeListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch finalizes (after all items complete) */
    onBatchFinalize: (batch: BatchState) => void;
}

/**
 * Vue composable to listen to batch finalize events.
 * This event fires after all items in a batch have completed (successfully or with errors).
 * @param options Listener configuration options
 */
export const useBatchFinalizeListener = (options: UseBatchFinalizeListenerOptions): void => {
    const { endpoint, metadata, onBatchFinalize } = options;

    onMounted(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (batch: BatchState): void => {
            onBatchFinalize(batch);
        };

        adapter.uploader.on("BATCH_FINALIZE", handler);

        onBeforeUnmount(() => {
            adapter.uploader.off("BATCH_FINALIZE", handler);
        });
    });
};


