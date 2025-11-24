import { computed } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";

export interface UseAbortItemOptions {
    /** Upload endpoint URL (used to create uploader instance) */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
}

export interface UseAbortItemReturn {
    /** Abort a specific upload item by ID */
    abortItem: (id: string) => void;
}

/**
 * Vue composable to abort a specific upload item.
 * @param options Configuration options
 * @returns Abort function
 */
export const useAbortItem = (options: UseAbortItemOptions): UseAbortItemReturn => {
    const { endpoint, metadata } = options;

    const adapter = computed(
        () =>
            createMultipartAdapter({
                endpoint,
                metadata,
            }),
    );

    const abortItem = (id: string): void => {
        adapter.value.abortItem(id);
    };

    return {
        abortItem,
    };
};
