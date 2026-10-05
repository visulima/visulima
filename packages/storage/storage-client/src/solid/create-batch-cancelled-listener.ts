import { onCleanup, onMount } from "solid-js";

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

        onCleanup(subscribe(endpoint, "BATCH_CANCELLED", handler));
    });
};
