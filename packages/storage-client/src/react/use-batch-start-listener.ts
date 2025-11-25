import { useEffect, useRef } from "react";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState } from "../core/uploader";

export interface UseBatchStartListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch starts */
    onBatchStart: (batch: BatchState) => void;
}

/**
 * React hook to listen to batch start events.
 * @param options Listener configuration options
 */
export const useBatchStartListener = (options: UseBatchStartListenerOptions): void => {
    const { endpoint, metadata, onBatchStart } = options;

    const callbackRef = useRef(onBatchStart);

    useEffect(() => {
        callbackRef.current = onBatchStart;
    }, [onBatchStart]);

    useEffect(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (batch: BatchState): void => {
            callbackRef.current(batch);
        };

        adapter.uploader.on("BATCH_START", handler);

        return () => {
            adapter.uploader.off("BATCH_START", handler);
        };
    }, [endpoint, metadata]);
};
