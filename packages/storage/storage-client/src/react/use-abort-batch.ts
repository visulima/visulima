import { useCallback } from "react";

import { dispatch } from "../core/uploader";

export interface UseAbortBatchOptions {
    /** Upload endpoint URL whose uploads to act on */
    endpoint: string;
    /** @deprecated Unused: commands reach the existing uploads to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
}

export interface UseAbortBatchReturn {
    /** Abort a batch of uploads by batch ID */
    abortBatch: (batchId: string) => void;
}

/**
 * React hook to abort a batch of uploads.
 * Acts on the uploads every upload hook of the same `endpoint` started; an unknown id is a no-op.
 * @param options Configuration options
 * @returns Abort batch function
 */
export const useAbortBatch = (options: UseAbortBatchOptions): UseAbortBatchReturn => {
    const { endpoint } = options;

    const abortBatch = useCallback(
        (batchId: string): void => {
            dispatch(endpoint, { id: batchId, type: "abortBatch" });
        },
        [endpoint],
    );

    return {
        abortBatch,
    };
};
