import { createMultipartAdapter } from "../core/multipart-adapter";

export interface CreateAbortAllOptions {
    endpoint: string;
    metadata?: Record<string, string>;
}

export interface CreateAbortAllReturn {
    abortAll: () => void;
}

export const createAbortAll = (options: CreateAbortAllOptions): CreateAbortAllReturn => {
    const { endpoint, metadata } = options;
    const adapter = createMultipartAdapter({ endpoint, metadata });

    return {
        abortAll: (): void => {
            adapter.abort();
        },
    };
};

