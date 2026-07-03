import { useEffect, useRef } from "react";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";

export interface UseAllAbortListenerOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when any item is aborted */
    onAbort: (item: UploadItem) => void;
}

/**
 * React hook to listen to all abort events (item aborts).
 * @param options Listener configuration options
 */
export const useAllAbortListener = (options: UseAllAbortListenerOptions): void => {
    const { endpoint, metadata, onAbort } = options;

    const callbackRef = useRef(onAbort);

    useEffect(() => {
        callbackRef.current = onAbort;
    }, [onAbort]);

    useEffect(() => {
        const adapter = createMultipartAdapter({
            endpoint,
            metadata,
        });

        const handler = (itemOrBatch: UploadItem | BatchState): void => {
            if ("file" in itemOrBatch) {
                callbackRef.current(itemOrBatch);
            }
        };

        adapter.uploader.on("ITEM_ABORT", handler);

        return () => {
            adapter.uploader.off("ITEM_ABORT", handler);
        };
    }, [endpoint, metadata]);
};
