import { useEffect, useRef } from "react";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface UseBatchCancelledListenerOptions {
    /** Upload endpoint URL whose uploads to observe */
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    /** Callback when batch is cancelled */
    onBatchCancelled: (batch: BatchState) => void;
}

/**
 * React hook to listen to batch cancelled events.
 * @param options Listener configuration options
 */
export const useBatchCancelledListener = (options: UseBatchCancelledListenerOptions): void => {
    const { endpoint, onBatchCancelled } = options;

    const callbackRef = useRef(onBatchCancelled);

    useEffect(() => {
        callbackRef.current = onBatchCancelled;
    }, [onBatchCancelled]);

    useEffect(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                callbackRef.current(itemOrBatch);
            }
        };

        return subscribe(endpoint, "BATCH_CANCELLED", handler);
    }, [endpoint]);
};
