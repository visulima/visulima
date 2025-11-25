import { onBeforeUnmount, onMounted } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState } from "../core/uploader";

export interface UseBatchCancelledListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch is cancelled */
    onBatchCancelled: (batch: BatchState) => void;
}

/**
 * Vue composable to listen to batch cancelled events.
 * @param options Listener configuration options
 */
export const useBatchCancelledListener = (options: UseBatchCancelledListenerOptions): void => {
    const { endpoint, metadata, onBatchCancelled } = options;

    onMounted(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (batch: BatchState): void => {
            onBatchCancelled(batch);
        };

        adapter.uploader.on("BATCH_CANCELLED", handler);

        onBeforeUnmount(() => {
            adapter.uploader.off("BATCH_CANCELLED", handler);
        });
    });
};

