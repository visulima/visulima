import { onBeforeUnmount, onMounted } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { UploadItem } from "../core/uploader";

export interface UseRetryListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when an item is retried */
    onRetry: (item: UploadItem) => void;
}

/**
 * Vue composable to listen to retry events.
 * Note: This listens to ITEM_START events for items that have been retried (retryCount > 0).
 * @param options Listener configuration options
 */
export const useRetryListener = (options: UseRetryListenerOptions): void => {
    const { endpoint, metadata, onRetry } = options;

    onMounted(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (item: UploadItem): void => {
            // Only trigger retry callback if item has been retried
            if (item.retryCount && item.retryCount > 0) {
                onRetry(item);
            }
        };

        adapter.uploader.on("ITEM_START", handler);

        onBeforeUnmount(() => {
            adapter.uploader.off("ITEM_START", handler);
        });
    });
};


