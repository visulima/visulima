import { createMultipartAdapter } from "../core/multipart-adapter";

export interface CreateAbortBatchOptions {
    endpoint: string;
    metadata?: Record<string, string>;
}

export interface CreateAbortBatchReturn {
    abortBatch: (batchId: string) => void;
}

export const createAbortBatch = (options: CreateAbortBatchOptions): CreateAbortBatchReturn => {
    const { endpoint, metadata } = options;
    const adapter = createMultipartAdapter({ endpoint, metadata });

    return {
        abortBatch: (batchId: string): void => {
            adapter.abortBatch(batchId);
        },
    };
};

