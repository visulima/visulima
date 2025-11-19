import { useQuery } from "@tanstack/react-query";

import { buildUrl, extractFileMetaFromHeaders, fetchFile, storageQueryKeys } from "../core";
import type { FileMeta } from "./types";

export interface TransformOptions {
    /** Additional transformation parameters */
    [key: string]: string | number | boolean | undefined;
    /** Resize fit mode */
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    /** Output format (jpeg, png, webp, etc.) */
    format?: string;
    /** Desired height in pixels */
    height?: number;
    /** Quality setting (0-100) */
    quality?: number;
    /** Desired width in pixels */
    width?: number;
}

export interface UseTransformFileOptions {
    /** Whether to enable the query */
    enabled?: boolean;
    /** Base endpoint URL for transform operations */
    endpoint: string;
    /** File ID to transform */
    id: string;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: (data: Blob, meta: FileMeta | null) => void;
    /** Transformation parameters */
    transform: TransformOptions;
}

export interface UseTransformFileReturn {
    /** Transformed file data as Blob */
    data: Blob | undefined;
    /** Last request error, if any */
    error: Error | null;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** File metadata from response headers */
    meta: FileMeta | null;
    /** Refetch the transformed file */
    refetch: () => void;
}

/**
 * React hook for fetching transformed files using TanStack Query
 * Supports image, video, and audio transformation parameters
 * @param options Hook configuration options
 * @returns Transform file fetching functions and state
 */
export const useTransformFile = (options: UseTransformFileOptions): UseTransformFileReturn => {
    const { enabled = true, endpoint, id, onError, onSuccess, transform } = options;

    const query = useQuery({
        enabled: enabled && !!id && !!transform,
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

                throw new Error(errorData.error?.message || `Failed to get transformed file: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            const meta = extractFileMetaFromHeaders(id, response.headers);

            return { blob, meta };
        },
        queryKey: storageQueryKeys.transform.file(id, transform),
    });

    // Extract metadata from response if available
    const meta: FileMeta | null = query.data?.meta || null;

    // Call callbacks
    if (query.data && onSuccess) {
        onSuccess(query.data.blob, meta);
    }

    if (query.error && onError) {
        onError(query.error as Error);
    }

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
