import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import type { FileHeadMetadata } from "../core";
import { buildUrl, extractHeadMetadataFromHeaders, fetchHead, storageQueryKeys } from "../core";

export interface UseHeadFileOptions {
    /** Whether to enable the query */
    enabled?: boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch metadata for */
    id: string;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: (meta: FileHeadMetadata) => void;
}

export interface UseHeadFileReturn {
    /** File metadata from HEAD request */
    data: FileHeadMetadata | undefined;
    /** Last request error, if any */
    error: Error | undefined;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** Refetch the file metadata */
    refetch: () => void;
}

/**
 * React hook for fetching file metadata via HEAD request using TanStack Query.
 * Useful for checking upload progress and file status without downloading.
 * @param options Hook configuration options
 * @returns File HEAD request functions and state
 */
export const useHeadFile = (options: UseHeadFileOptions): UseHeadFileReturn => {
    const { enabled = true, endpoint, id, onError, onSuccess } = options;

    const query = useQuery({
        enabled: enabled && !!id,
        queryFn: async ({ signal }): Promise<FileHeadMetadata> => {
            const url = buildUrl(endpoint, id);

            return extractHeadMetadataFromHeaders(await fetchHead(url, { signal }));
        },
        queryKey: storageQueryKeys.files.head(endpoint, id),
    });

    // Store callbacks in refs to avoid re-running effects when callbacks change
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onSuccessRef.current = onSuccess;
    }, [onSuccess]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    // Call callbacks in useEffect to avoid calling during render
    useEffect(() => {
        if (query.data) {
            onSuccessRef.current?.(query.data);
        }
    }, [query.data]);

    useEffect(() => {
        if (query.error) {
            onErrorRef.current?.(query.error);
        }
    }, [query.error]);

    return {
        data: query.data,
        error: query.error ?? undefined,
        isLoading: query.isLoading,
        refetch: () => {
            query.refetch().catch(() => {});
        },
    };
};
