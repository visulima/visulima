import { onBeforeUnmount, onMounted } from "vue";

import type { BatchState } from "../core/uploader";
import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseBatchProgressListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch progress updates */
    onBatchProgress: (batch: BatchState) => void;
}

/**
 * Vue composable to listen to batch progress events.
 * @param options Listener configuration options
 */
export const useBatchProgressListener = (options: UseBatchProgressListenerOptions): void => {
    const { endpoint, metadata, onBatchProgress } = options;

    onMounted(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (batch: BatchState): void => {
            onBatchProgress(batch);
        };

        adapter.uploader.on("BATCH_PROGRESS", handler);

        onBeforeUnmount(() => {
            adapter.uploader.off("BATCH_PROGRESS", handler);
        });
    });
};

