import { useEffect, useRef } from "react";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface UseBatchStartListenerOptions {
    /** Upload endpoint URL whose uploads to observe */
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    /** Callback when batch starts */
    onBatchStart: (batch: BatchState) => void;
}

/**
 * React hook to listen to batch start events.
 * @param options Listener configuration options
 */
export const useBatchStartListener = (options: UseBatchStartListenerOptions): void => {
    const { endpoint, onBatchStart } = options;

    const callbackRef = useRef(onBatchStart);

    useEffect(() => {
        callbackRef.current = onBatchStart;
    }, [onBatchStart]);

    useEffect(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                callbackRef.current(itemOrBatch);
            }
        };

        return subscribe(endpoint, "BATCH_START", handler);
    }, [endpoint]);
};
