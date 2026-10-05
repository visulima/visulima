import { onBeforeUnmount, onMounted } from "vue";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface UseBatchCancelledListenerOptions {
    /** Upload endpoint URL whose uploads to observe */
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    /** Callback when batch is cancelled */
    onBatchCancelled: (batch: BatchState) => void;
}

/**
 * Vue composable to listen to batch cancelled events.
 * @param options Listener configuration options
 */
export const useBatchCancelledListener = (options: UseBatchCancelledListenerOptions): void => {
    const { endpoint, onBatchCancelled } = options;

    onMounted(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchCancelled(itemOrBatch);
            }
        };

        onBeforeUnmount(subscribe(endpoint, "BATCH_CANCELLED", handler));
    });
};
