import { createMultipartAdapter } from "../core/multipart-adapter";

export interface CreateBatchRetryOptions {
    endpoint: string;
    metadata?: Record<string, string>;
}

export interface CreateBatchRetryReturn {
    retryBatch: (batchId: string) => void;
}

export const createBatchRetry = (options: CreateBatchRetryOptions): CreateBatchRetryReturn => {
    const { endpoint, metadata } = options;
    const adapter = createMultipartAdapter({ endpoint, metadata });

    return {
        retryBatch: (batchId: string): void => {
            adapter.uploader.retryBatch(batchId);
        },
    };
};
