import { createMultipartAdapter } from "../core/multipart-adapter";

export interface CreateRetryOptions {
    endpoint: string;
    metadata?: Record<string, string>;
}

export interface CreateRetryReturn {
    retryItem: (id: string) => void;
}

export const createRetry = (options: CreateRetryOptions): CreateRetryReturn => {
    const { endpoint, metadata } = options;
    const adapter = createMultipartAdapter({ endpoint, metadata });

    return {
        retryItem: (id: string): void => {
            adapter.uploader.retryItem(id);
        },
    };
};

