import { onMount } from "svelte";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface CreateRetryListenerOptions {
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    onRetry: (item: UploadItem) => void;
}

export const createRetryListener = (options: CreateRetryListenerOptions): void => {
    const { endpoint, onRetry } = options;

    onMount(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("file" in itemOrBatch && itemOrBatch.retryCount && itemOrBatch.retryCount > 0) {
                onRetry(itemOrBatch);
            }
        };

        // onDestroy cannot be registered from inside onMount; its returned cleanup runs on destroy.
        return subscribe(endpoint, "ITEM_START", handler);
    });
};
