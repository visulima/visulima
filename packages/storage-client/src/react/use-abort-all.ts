import { useCallback, useMemo } from "react";

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
 * React hook to abort all active uploads.
 * @param options Configuration options
 * @returns Abort all function
 */
export const useAbortAll = (options: UseAbortAllOptions): UseAbortAllReturn => {
    const { endpoint, metadata } = options;

    const adapter = useMemo(
        () =>
            createMultipartAdapter({
                endpoint,
                metadata,
            }),
        [endpoint, metadata],
    );

    const abortAll = useCallback((): void => {
        adapter.abort();
    }, [adapter]);

    return {
        abortAll,
    };
};


