import { useEffect, useRef } from "react";

import type { BatchState, UploadItem } from "../core/uploader";
import { subscribe } from "../core/uploader";

export interface UseRetryListenerOptions {
    /** Upload endpoint URL whose uploads to observe */
    endpoint: string;
    /** @deprecated Unused: listeners observe every upload to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
    /** Callback when an item is retried */
    onRetry: (item: UploadItem) => void;
}

/**
 * React hook to listen to retry events.
 * Note: This listens to ITEM_START events for items that have been retried (retryCount > 0).
 * @param options Listener configuration options
 */
export const useRetryListener = (options: UseRetryListenerOptions): void => {
    const { endpoint, onRetry } = options;

    const callbackRef = useRef(onRetry);

    useEffect(() => {
        callbackRef.current = onRetry;
    }, [onRetry]);

    useEffect(() => {
        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            // Only trigger retry callback if item has been retried
            if ("file" in itemOrBatch && itemOrBatch.retryCount && itemOrBatch.retryCount > 0) {
                callbackRef.current(itemOrBatch);
            }
        };

        return subscribe(endpoint, "ITEM_START", handler);
    }, [endpoint]);
};
