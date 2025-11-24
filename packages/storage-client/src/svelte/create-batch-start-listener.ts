import { onDestroy, onMount } from "svelte";
import type { BatchState } from "../core/uploader";
import { createMultipartAdapter } from "../core/multipart-adapter";

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

        onDestroy(() => {
            adapter.uploader.off("BATCH_START", handler);
        });
    });
};
