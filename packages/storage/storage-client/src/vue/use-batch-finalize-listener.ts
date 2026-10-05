import { onBeforeUnmount, onMounted } from "vue";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface UseBatchFinalizeListenerOptions {
    /** Upload endpoint URL whose uploads to observe */
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
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
    const { endpoint, onBatchFinalize } = options;

    onMounted(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchFinalize(itemOrBatch);
            }
        };

        onBeforeUnmount(subscribe(endpoint, "BATCH_FINALIZE", handler));
    });
};
