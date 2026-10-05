import { onCleanup, onMount } from "solid-js";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface CreateBatchErrorListenerOptions {
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    onBatchError: (batch: BatchState) => void;
}

export const createBatchErrorListener = (options: CreateBatchErrorListenerOptions): void => {
    const { endpoint, onBatchError } = options;

    onMount(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchError(itemOrBatch);
            }
        };

        onCleanup(subscribe(endpoint, "BATCH_ERROR", handler));
    });
};
