import { onBeforeUnmount, onMounted } from "vue";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface UseBatchProgressListenerOptions {
    /** Upload endpoint URL whose uploads to observe */
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    /** Callback when batch progress updates */
    onBatchProgress: (batch: BatchState) => void;
}

/**
 * Vue composable to listen to batch progress events.
 * @param options Listener configuration options
 */
export const useBatchProgressListener = (options: UseBatchProgressListenerOptions): void => {
    const { endpoint, onBatchProgress } = options;

    onMounted(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchProgress(itemOrBatch);
            }
        };

        onBeforeUnmount(subscribe(endpoint, "BATCH_PROGRESS", handler));
    });
};
