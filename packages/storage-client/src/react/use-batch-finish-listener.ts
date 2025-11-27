import { useEffect, useRef } from "react";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";

export interface UseBatchFinishListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch finishes successfully */
    onBatchFinish: (batch: BatchState) => void;
}

/**
 * React hook to listen to batch finish events.
 * @param options Listener configuration options
 */
export const useBatchFinishListener = (options: UseBatchFinishListenerOptions): void => {
    const { endpoint, metadata, onBatchFinish } = options;

    const callbackRef = useRef(onBatchFinish);

    useEffect(() => {
        callbackRef.current = onBatchFinish;
    }, [onBatchFinish]);

    useEffect(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                callbackRef.current(itemOrBatch);
            }
        };

        adapter.uploader.on("BATCH_FINISH", handler);

        return () => {
            adapter.uploader.off("BATCH_FINISH", handler);
        };
    }, [endpoint, metadata]);
};
