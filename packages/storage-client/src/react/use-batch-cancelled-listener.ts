import { useEffect, useRef } from "react";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState } from "../core/uploader";

export interface UseBatchCancelledListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch is cancelled */
    onBatchCancelled: (batch: BatchState) => void;
}

/**
 * React hook to listen to batch cancelled events.
 * @param options Listener configuration options
 */
export const useBatchCancelledListener = (options: UseBatchCancelledListenerOptions): void => {
    const { endpoint, metadata, onBatchCancelled } = options;

    const callbackRef = useRef(onBatchCancelled);

    useEffect(() => {
        callbackRef.current = onBatchCancelled;
    }, [onBatchCancelled]);

    useEffect(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (batch: BatchState): void => {
            callbackRef.current(batch);
        };

        adapter.uploader.on("BATCH_CANCELLED", handler);

        return () => {
            adapter.uploader.off("BATCH_CANCELLED", handler);
        };
    }, [endpoint, metadata]);
};

