import { useEffect, useRef } from "react";

import type { BatchState } from "../core/uploader";
import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseBatchFinalizeListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch finalizes (after all items complete) */
    onBatchFinalize: (batch: BatchState) => void;
}

/**
 * React hook to listen to batch finalize events.
 * This event fires after all items in a batch have completed (successfully or with errors).
 * @param options Listener configuration options
 */
export const useBatchFinalizeListener = (options: UseBatchFinalizeListenerOptions): void => {
    const { endpoint, metadata, onBatchFinalize } = options;

    const callbackRef = useRef(onBatchFinalize);

    useEffect(() => {
        callbackRef.current = onBatchFinalize;
    }, [onBatchFinalize]);

    useEffect(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (batch: BatchState): void => {
            callbackRef.current(batch);
        };

        adapter.uploader.on("BATCH_FINALIZE", handler);

        return () => {
            adapter.uploader.off("BATCH_FINALIZE", handler);
        };
    }, [endpoint, metadata]);
};

