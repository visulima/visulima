import { computed } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseAbortAllOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
}

export interface UseAbortAllReturn {
    /** Abort all active uploads */
    abortAll: () => void;
}

/**
 * Vue composable to abort all active uploads.
 * @param options Configuration options
 * @returns Abort all function
 */
export const useAbortAll = (options: UseAbortAllOptions): UseAbortAllReturn => {
    const { endpoint, metadata } = options;

    const adapter = computed(
        () =>
            createMultipartAdapter({
                endpoint,
                metadata,
            }),
    );

    const abortAll = (): void => {
        adapter.value.abort();
    };

    return {
        abortAll,
    };
};
