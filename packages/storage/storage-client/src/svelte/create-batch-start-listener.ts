import { onMount } from "svelte";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface CreateBatchStartListenerOptions {
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    onBatchStart: (batch: BatchState) => void;
}

export const createBatchStartListener = (options: CreateBatchStartListenerOptions): void => {
    const { endpoint, onBatchStart } = options;

    onMount(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                onBatchStart(itemOrBatch);
            }
        };

        // onDestroy cannot be registered from inside onMount; its returned cleanup runs on destroy.
        return subscribe(endpoint, "BATCH_START", handler);
    });
};
