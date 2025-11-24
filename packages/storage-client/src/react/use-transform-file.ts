import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { buildUrl, extractFileMetaFromHeaders, storageQueryKeys } from "../core";
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
    onSuccess?: (data: Blob, meta: FileMeta | undefined) => void;
    /** Transformation parameters */
    transform: TransformOptions;
}

export interface UseTransformFileReturn {
    /** Transformed file data as Blob */
    data: Blob | undefined;
    /** Last request error, if any */
    error: Error | undefined;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** File metadata from response headers */
    meta: FileMeta | undefined;
    /** Refetch the transformed file */
    refetch: () => void;
}

/**
 * React hook for fetching transformed files using TanStack Query.
 * Supports image, video, and audio transformation parameters.
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
        queryKey: storageQueryKeys.transform.file(endpoint, id, transform),
    });

    // Extract metadata from response if available
    const meta: FileMeta | undefined = query.data?.meta || undefined;

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
        if (query.data && onSuccessRef.current) {
            onSuccessRef.current(query.data.blob, meta);
        }
    }, [query.data, meta]);

    useEffect(() => {
        if (query.error && onErrorRef.current) {
            onErrorRef.current(query.error as Error);
        }
    }, [query.error]);

    return {
        data: query.data?.blob,
        error: (query.error as Error) || undefined,
        isLoading: query.isLoading,
        meta,
        refetch: () => {
            query.refetch();
        },
    };
};
