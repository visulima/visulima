import { onCleanup, onMount } from "solid-js";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";

export interface CreateAllAbortListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onAbort: (item: UploadItem) => void;
}

export const createAllAbortListener = (options: CreateAllAbortListenerOptions): void => {
    const { endpoint, metadata, onAbort } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("file" in itemOrBatch) {
                onAbort(itemOrBatch);
            }
        };

        adapter.uploader.on("ITEM_ABORT", handler);

        onCleanup(() => {
            adapter.uploader.off("ITEM_ABORT", handler);
        });
    });
};
