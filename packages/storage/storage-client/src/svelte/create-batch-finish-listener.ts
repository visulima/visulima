import { onMount } from "svelte";

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

        // onDestroy cannot be registered from inside onMount; its returned cleanup runs on destroy.
        return subscribe(endpoint, "BATCH_FINISH", handler);
    });
};
