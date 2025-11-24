import { useEffect, useRef } from "react";

import type { BatchState } from "../core/uploader";
import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseBatchProgressListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch progress updates */
    onBatchProgress: (batch: BatchState) => void;
}

/**
 * React hook to listen to batch progress events.
 * @param options Listener configuration options
 */
export const useBatchProgressListener = (options: UseBatchProgressListenerOptions): void => {
    const { endpoint, metadata, onBatchProgress } = options;

    const callbackRef = useRef(onBatchProgress);

    useEffect(() => {
        callbackRef.current = onBatchProgress;
    }, [onBatchProgress]);

    useEffect(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (batch: BatchState): void => {
            callbackRef.current(batch);
        };

        adapter.uploader.on("BATCH_PROGRESS", handler);

        return () => {
            adapter.uploader.off("BATCH_PROGRESS", handler);
        };
    }, [endpoint, metadata]);
};

