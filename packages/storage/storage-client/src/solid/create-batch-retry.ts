import { dispatch } from "../core/uploader";

export interface CreateBatchRetryOptions {
    endpoint: string;
    /** @deprecated Unused: commands reach the existing uploads to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
}

export interface CreateBatchRetryReturn {
    retryBatch: (batchId: string) => void;
}

/**
 * Returns `retryBatch` for the uploads every upload hook of the same `endpoint` started; an unknown id is a no-op.
 */
export const createBatchRetry = (options: CreateBatchRetryOptions): CreateBatchRetryReturn => {
    const { endpoint } = options;

    return {
        retryBatch: (batchId: string): void => {
            dispatch(endpoint, { id: batchId, type: "retryBatch" });
        },
    };
};
