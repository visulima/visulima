import { onCleanup, onMount } from "solid-js";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState } from "../core/uploader";

export interface CreateBatchStartListenerOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onBatchStart: (batch: BatchState) => void;
}

export const createBatchStartListener = (options: CreateBatchStartListenerOptions): void => {
    const { endpoint, metadata, onBatchStart } = options;

    onMount(() => {
        const adapter = createMultipartAdapter({ endpoint, metadata });
        const handler = (batch: BatchState): void => onBatchStart(batch);

        adapter.uploader.on("BATCH_START", handler);

        onCleanup(() => {
            adapter.uploader.off("BATCH_START", handler);
        });
    });
};
