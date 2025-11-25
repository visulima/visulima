import { onCleanup, onMount } from "solid-js";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState } from "../core/uploader";

export interface CreateBatchErrorListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onBatchError: (batch: BatchState) => void;
}

export const createBatchErrorListener = (options: CreateBatchErrorListenerOptions): void => {
    const { endpoint, metadata, onBatchError } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (batch: BatchState): void => onBatchError(batch);

        adapter.uploader.on("BATCH_ERROR", handler);

        onCleanup(() => {
            adapter.uploader.off("BATCH_ERROR", handler);
        });
    });
};
