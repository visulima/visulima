import { useEffect, useRef } from "react";

import type { BatchState } from "../core/uploader";
import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseBatchErrorListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch encounters an error */
    onBatchError: (batch: BatchState) => void;
}

/**
 * React hook to listen to batch error events.
 * @param options Listener configuration options
 */
export const useBatchErrorListener = (options: UseBatchErrorListenerOptions): void => {
    const { endpoint, metadata, onBatchError } = options;

    const callbackRef = useRef(onBatchError);

    useEffect(() => {
        callbackRef.current = onBatchError;
    }, [onBatchError]);

    useEffect(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (batch: BatchState): void => {
            callbackRef.current(batch);
        };

        adapter.uploader.on("BATCH_ERROR", handler);

        return () => {
            adapter.uploader.off("BATCH_ERROR", handler);
        };
    }, [endpoint, metadata]);
};

