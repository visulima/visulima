import { computed } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseAbortBatchOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
}

export interface UseAbortBatchReturn {
    /** Abort a batch of uploads by batch ID */
    abortBatch: (batchId: string) => void;
}

/**
 * Vue composable to abort a batch of uploads.
 * @param options Configuration options
 * @returns Abort batch function
 */
export const useAbortBatch = (options: UseAbortBatchOptions): UseAbortBatchReturn => {
    const { endpoint, metadata } = options;

    const adapter = computed(() =>
        createMultipartAdapter({
            endpoint,
            metadata,
        }),
    );

    const abortBatch = (batchId: string): void => {
        adapter.value.abortBatch(batchId);
    };

    return {
        abortBatch,
    };
};


