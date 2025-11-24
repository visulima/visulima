import { onBeforeUnmount, onMounted } from "vue";

import type { UploadItem } from "../core/uploader";
import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseAllAbortListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when any item is aborted */
    onAbort: (item: UploadItem) => void;
}

/**
 * Vue composable to listen to all abort events (item aborts).
 * @param options Listener configuration options
 */
export const useAllAbortListener = (options: UseAllAbortListenerOptions): void => {
    const { endpoint, metadata, onAbort } = options;

    onMounted(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (item: UploadItem): void => {
            onAbort(item);
        };

        adapter.uploader.on("ITEM_ABORT", handler);

        onBeforeUnmount(() => {
            adapter.uploader.off("ITEM_ABORT", handler);
        });
    });
};

