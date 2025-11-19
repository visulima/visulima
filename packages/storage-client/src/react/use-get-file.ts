import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { buildUrl, extractFileMetaFromHeaders, storageQueryKeys } from "../core";
import type { FileMeta } from "./types";

export interface UseGetFileOptions {
    /** Whether to enable the query */
    enabled?: boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch */
    id: string;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: (data: Blob, meta: FileMeta | null) => void;
    /** Transformation parameters for media files */
    transform?: Record<string, string | number | boolean>;
}

export interface UseGetFileReturn {
    /** File data as Blob */
    data: Blob | undefined;
    /** Last request error, if any */
    error: Error | null;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** File metadata from response headers */
    meta: FileMeta | null;
    /** Refetch the file */
    refetch: () => void;
}

/**
 * React hook for fetching/downloading files using TanStack Query
 * Supports optional transformation parameters for media files
 * @param options Hook configuration options
 * @returns File fetching functions and state
 */
export const useGetFile = (options: UseGetFileOptions): UseGetFileReturn => {
    const { enabled = true, endpoint, id, onError, onSuccess, transform } = options;

    const query = useQuery({
        enabled: enabled && !!id,
        queryFn: async () => {
            const url = buildUrl(endpoint, id, transform);
            const response = await fetch(url, {
                method: "GET",
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => {
                    return {
                        error: {
                            code: "RequestFailed",
                            message: response.statusText,
                        },
                    };
                });

                throw new Error(errorData.error?.message || `Failed to get file: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            const meta = extractFileMetaFromHeaders(id, response.headers);

            return { blob, meta };
        },
        queryKey: storageQueryKeys.files.detail(id, transform),
    });

    // Extract metadata from response if available
    const meta: FileMeta | null = query.data?.meta || null;

    // Call callbacks in useEffect to avoid calling during render
    useEffect(() => {
        if (query.data && onSuccess) {
            onSuccess(query.data.blob, meta);
        }
    }, [query.data, onSuccess, meta]);

    useEffect(() => {
        if (query.error && onError) {
            onError(query.error as Error);
        }
    }, [query.error, onError]);

    return {
        data: query.data?.blob,
        error: (query.error as Error) || null,
        isLoading: query.isLoading,
        meta,
        refetch: () => {
            query.refetch();
        },
    };
};
