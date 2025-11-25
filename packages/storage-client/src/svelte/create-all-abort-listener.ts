import { onDestroy, onMount } from "svelte";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { UploadItem } from "../core/uploader";

export interface CreateAllAbortListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onAbort: (item: UploadItem) => void;
}

export const createAllAbortListener = (options: CreateAllAbortListenerOptions): void => {
    const { endpoint, metadata, onAbort } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (item: UploadItem): void => onAbort(item);

        adapter.uploader.on("ITEM_ABORT", handler);

        onDestroy(() => {
            adapter.uploader.off("ITEM_ABORT", handler);
        });
    });
};

