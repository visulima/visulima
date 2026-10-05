import { dispatch } from "../core/uploader";

export interface CreateAbortBatchOptions {
    endpoint: string;
    /** @deprecated Unused: commands reach the existing uploads to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
}

export interface CreateAbortBatchReturn {
    abortBatch: (batchId: string) => void;
}

/**
 * Returns `abortBatch` for the uploads every upload hook of the same `endpoint` started; an unknown id is a no-op.
 */
export const createAbortBatch = (options: CreateAbortBatchOptions): CreateAbortBatchReturn => {
    const { endpoint } = options;

    return {
        abortBatch: (batchId: string): void => {
            dispatch(endpoint, { id: batchId, type: "abortBatch" });
        },
    };
};
