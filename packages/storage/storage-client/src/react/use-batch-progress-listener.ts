import { useEffect, useRef } from "react";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface UseBatchProgressListenerOptions {
    /** Upload endpoint URL whose uploads to observe */
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    /** Callback when batch progress updates */
    onBatchProgress: (batch: BatchState) => void;
}

/**
 * React hook to listen to batch progress events.
 * @param options Listener configuration options
 */
export const useBatchProgressListener = (options: UseBatchProgressListenerOptions): void => {
    const { endpoint, onBatchProgress } = options;

    const callbackRef = useRef(onBatchProgress);

    useEffect(() => {
        callbackRef.current = onBatchProgress;
    }, [onBatchProgress]);

    useEffect(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                callbackRef.current(itemOrBatch);
            }
        };

        return subscribe(endpoint, "BATCH_PROGRESS", handler);
    }, [endpoint]);
};
