import { onBeforeUnmount, onMounted } from "vue";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface UseAllAbortListenerOptions {
    /** Upload endpoint URL whose uploads to observe */
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    /** Callback when any item is aborted */
    onAbort: (item: UploadItem) => void;
}

/**
 * Vue composable to listen to all abort events (item aborts).
 * @param options Listener configuration options
 */
export const useAllAbortListener = (options: UseAllAbortListenerOptions): void => {
    const { endpoint, onAbort } = options;

    onMounted(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("file" in itemOrBatch) {
                onAbort(itemOrBatch);
            }
        };

        onBeforeUnmount(subscribe(endpoint, "ITEM_ABORT", handler));
    });
};
