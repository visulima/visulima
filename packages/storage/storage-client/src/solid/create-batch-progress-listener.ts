import { onCleanup, onMount } from "solid-js";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface CreateBatchProgressListenerOptions {
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    onBatchProgress: (batch: BatchState) => void;
}

export const createBatchProgressListener = (options: CreateBatchProgressListenerOptions): void => {
    const { endpoint, onBatchProgress } = options;

    onMount(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchProgress(itemOrBatch);
            }
        };

        onCleanup(subscribe(endpoint, "BATCH_PROGRESS", handler));
    });
};
