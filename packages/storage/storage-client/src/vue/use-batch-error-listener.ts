import { onBeforeUnmount, onMounted } from "vue";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface UseBatchErrorListenerOptions {
    /** Upload endpoint URL whose uploads to observe */
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    /** Callback when batch encounters an error */
    onBatchError: (batch: BatchState) => void;
}

/**
 * Vue composable to listen to batch error events.
 * @param options Listener configuration options
 */
export const useBatchErrorListener = (options: UseBatchErrorListenerOptions): void => {
    const { endpoint, onBatchError } = options;

    onMounted(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchError(itemOrBatch);
            }
        };

        onBeforeUnmount(subscribe(endpoint, "BATCH_ERROR", handler));
    });
};
