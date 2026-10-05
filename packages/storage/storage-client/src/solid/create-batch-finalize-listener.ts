import { onCleanup, onMount } from "solid-js";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface CreateBatchFinalizeListenerOptions {
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    onBatchFinalize: (batch: BatchState) => void;
}

export const createBatchFinalizeListener = (options: CreateBatchFinalizeListenerOptions): void => {
    const { endpoint, onBatchFinalize } = options;

    onMount(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchFinalize(itemOrBatch);
            }
        };

        onCleanup(subscribe(endpoint, "BATCH_FINALIZE", handler));
    });
};
