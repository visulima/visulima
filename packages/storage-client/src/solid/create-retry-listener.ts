import { onCleanup, onMount } from "solid-js";

import type { UploadItem } from "../core/uploader";
import { createMultipartAdapter } from "../core/multipart-adapter";

export interface CreateRetryListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onRetry: (item: UploadItem) => void;
}

export const createRetryListener = (options: CreateRetryListenerOptions): void => {
    const { endpoint, metadata, onRetry } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });

        const handler = (item: UploadItem): void => {
            if (item.retryCount && item.retryCount > 0) {
                onRetry(item);
            }
        };

        adapter.uploader.on("ITEM_START", handler);

        onCleanup(() => {
            adapter.uploader.off("ITEM_START", handler);
        });
    });
};

