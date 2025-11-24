import { onCleanup, onMount } from "solid-js";

import type { UploadItem } from "../core/uploader";
import { createMultipartAdapter } from "../core/multipart-adapter";

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

        onCleanup(() => {
            adapter.uploader.off("ITEM_ABORT", handler);
        });
    });
};

