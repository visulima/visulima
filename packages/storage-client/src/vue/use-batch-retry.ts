import { computed } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseBatchRetryOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
}

export interface UseBatchRetryReturn {
    /** Retry all failed items in a batch */
    retryBatch: (batchId: string) => void;
}

/**
 * Vue composable to retry all failed items in a batch.
 * @param options Configuration options
 * @returns Retry batch function
 */
export const useBatchRetry = (options: UseBatchRetryOptions): UseBatchRetryReturn => {
    const { endpoint, metadata } = options;

    const adapter = computed(
        () =>
            createMultipartAdapter({
                endpoint,
                metadata,
            }),
    );

    const retryBatch = (batchId: string): void => {
        adapter.value.uploader.retryBatch(batchId);
    };

    return {
        retryBatch,
    };
};

