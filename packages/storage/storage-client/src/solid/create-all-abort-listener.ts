import { onCleanup, onMount } from "solid-js";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface CreateAllAbortListenerOptions {
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    onAbort: (item: UploadItem) => void;
}

export const createAllAbortListener = (options: CreateAllAbortListenerOptions): void => {
    const { endpoint, onAbort } = options;

    onMount(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("file" in itemOrBatch) {
                onAbort(itemOrBatch);
            }
        };

        onCleanup(subscribe(endpoint, "ITEM_ABORT", handler));
    });
};
