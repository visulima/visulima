import { useEffect, useRef } from "react";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface UseBatchFinalizeListenerOptions {
    /** Upload endpoint URL whose uploads to observe */
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
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
    const { endpoint, onBatchFinalize } = options;

    const callbackRef = useRef(onBatchFinalize);

    useEffect(() => {
        callbackRef.current = onBatchFinalize;
    }, [onBatchFinalize]);

    useEffect(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                callbackRef.current(itemOrBatch);
            }
        };

        return subscribe(endpoint, "BATCH_FINALIZE", handler);
    }, [endpoint]);
};
