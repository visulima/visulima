import { onMount } from "svelte";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface CreateBatchCancelledListenerOptions {
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    onBatchCancelled: (batch: BatchState) => void;
}

export const createBatchCancelledListener = (options: CreateBatchCancelledListenerOptions): void => {
    const { endpoint, onBatchCancelled } = options;

    onMount(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchCancelled(itemOrBatch);
            }
        };

        // onDestroy cannot be registered from inside onMount; its returned cleanup runs on destroy.
        return subscribe(endpoint, "BATCH_CANCELLED", handler);
    });
};
