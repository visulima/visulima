import { useCallback } from "react";

import { dispatch } from "../core/uploader";

export interface UseBatchRetryOptions {
    /** Upload endpoint URL whose uploads to act on */
    endpoint: string;
    /** @deprecated Unused: commands reach the existing uploads to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
}

export interface UseBatchRetryReturn {
    /** Retry all failed items in a batch */
    retryBatch: (batchId: string) => void;
}

/**
 * React hook to retry all failed items in a batch.
 * Acts on the uploads every upload hook of the same `endpoint` started; an unknown id is a no-op.
 * @param options Configuration options
 * @returns Retry batch function
 */
export const useBatchRetry = (options: UseBatchRetryOptions): UseBatchRetryReturn => {
    const { endpoint } = options;

    const retryBatch = useCallback(
        (batchId: string): void => {
            dispatch(endpoint, { id: batchId, type: "retryBatch" });
        },
        [endpoint],
    );

    return {
        retryBatch,
    };
};
