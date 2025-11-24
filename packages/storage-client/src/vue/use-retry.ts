import { computed } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseRetryOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
}

export interface UseRetryReturn {
    /** Retry a failed upload item by ID */
    retryItem: (id: string) => void;
}

/**
 * Vue composable to retry a failed upload item.
 * @param options Configuration options
 * @returns Retry function
 */
export const useRetry = (options: UseRetryOptions): UseRetryReturn => {
    const { endpoint, metadata } = options;

    const adapter = computed(
        () =>
            createMultipartAdapter({
                endpoint,
                metadata,
            }),
    );

    const retryItem = (id: string): void => {
        adapter.value.uploader.retryItem(id);
    };

    return {
        retryItem,
    };
};
