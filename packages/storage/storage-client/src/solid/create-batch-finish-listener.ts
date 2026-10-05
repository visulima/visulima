import { onCleanup, onMount } from "solid-js";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface CreateBatchFinishListenerOptions {
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    onBatchFinish: (batch: BatchState) => void;
}

export const createBatchFinishListener = (options: CreateBatchFinishListenerOptions): void => {
    const { endpoint, onBatchFinish } = options;

    onMount(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchFinish(itemOrBatch);
            }
        };

        onCleanup(subscribe(endpoint, "BATCH_FINISH", handler));
    });
};
