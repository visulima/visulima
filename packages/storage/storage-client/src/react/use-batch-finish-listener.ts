import { useEffect, useRef } from "react";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface UseBatchFinishListenerOptions {
    /** Upload endpoint URL whose uploads to observe */
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    /** Callback when batch finishes successfully */
    onBatchFinish: (batch: BatchState) => void;
}

/**
 * React hook to listen to batch finish events.
 * @param options Listener configuration options
 */
export const useBatchFinishListener = (options: UseBatchFinishListenerOptions): void => {
    const { endpoint, onBatchFinish } = options;

    const callbackRef = useRef(onBatchFinish);

    useEffect(() => {
        callbackRef.current = onBatchFinish;
    }, [onBatchFinish]);

    useEffect(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                callbackRef.current(itemOrBatch);
            }
        };

        return subscribe(endpoint, "BATCH_FINISH", handler);
    }, [endpoint]);
};
