import { useCallback, useMemo } from "react";

import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseBatchRetryOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
}

export interface UseBatchRetryReturn {
    /** Retry all failed items in a batch */
    retryBatch: (batchId: string) => void;
}

/**
 * React hook to retry all failed items in a batch.
 * @param options Configuration options
 * @returns Retry batch function
 */
export const useBatchRetry = (options: UseBatchRetryOptions): UseBatchRetryReturn => {
    const { endpoint, metadata } = options;

    const adapter = useMemo(
        () =>
            createMultipartAdapter({
                endpoint,
                metadata,
            }),
        [endpoint, metadata],
    );

    const retryBatch = useCallback(
        (batchId: string): void => {
            adapter.uploader.retryBatch(batchId);
        },
        [adapter],
    );

    return {
        retryBatch,
    };
};
