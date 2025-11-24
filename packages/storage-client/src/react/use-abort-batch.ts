import { useCallback, useMemo } from "react";

import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseAbortBatchOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
}

export interface UseAbortBatchReturn {
    /** Abort a batch of uploads by batch ID */
    abortBatch: (batchId: string) => void;
}

/**
 * React hook to abort a batch of uploads.
 * @param options Configuration options
 * @returns Abort batch function
 */
export const useAbortBatch = (options: UseAbortBatchOptions): UseAbortBatchReturn => {
    const { endpoint, metadata } = options;

    const adapter = useMemo(
        () =>
            createMultipartAdapter({
                endpoint,
                metadata,
            }),
        [endpoint, metadata],
    );

    const abortBatch = useCallback(
        (batchId: string): void => {
            adapter.abortBatch(batchId);
        },
        [adapter],
    );

    return {
        abortBatch,
    };
};

