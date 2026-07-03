import { createMultipartAdapter } from "../core/multipart-adapter";

export interface CreateAbortItemOptions {
    endpoint: string;
    metadata?: Record<string, string>;
}

export interface CreateAbortItemReturn {
    abortItem: (id: string) => void;
}

export const createAbortItem = (options: CreateAbortItemOptions): CreateAbortItemReturn => {
    const { endpoint, metadata } = options;
    const adapter = createMultipartAdapter({ endpoint, metadata });

    return {
        abortItem: (id: string): void => {
            adapter.abortItem(id);
        },
    };
};
