import { onBeforeUnmount, onMounted, ref } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState } from "../core/uploader";

export interface UseBatchStartListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch starts */
    onBatchStart: (batch: BatchState) => void;
}

/**
 * Vue composable to listen to batch start events.
 * @param options Listener configuration options
 */
export const useBatchStartListener = (options: UseBatchStartListenerOptions): void => {
    const { endpoint, metadata, onBatchStart } = options;

    onMounted(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (batch: BatchState): void => {
            onBatchStart(batch);
        };

        adapter.uploader.on("BATCH_START", handler);

        onBeforeUnmount(() => {
            adapter.uploader.off("BATCH_START", handler);
        });
    });
};

