import { useCallback, useMemo } from "react";

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
 * React hook to abort a specific upload item.
 * @param options Configuration options
 * @returns Abort function
 */
export const useAbortItem = (options: UseAbortItemOptions): UseAbortItemReturn => {
    const { endpoint, metadata } = options;

    const adapter = useMemo(
        () =>
            createMultipartAdapter({
                endpoint,
                metadata,
            }),
        [endpoint, metadata],
    );

    const abortItem = useCallback(
        (id: string): void => {
            adapter.abortItem(id);
        },
        [adapter],
    );

    return {
        abortItem,
    };
};

