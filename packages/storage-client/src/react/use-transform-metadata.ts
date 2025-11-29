import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";

export interface TransformMetadata {
    /** Available transformation formats */
    formats?: string[];
    /** Supported transformation parameters */
    parameters?: string[];
}

export interface UseTransformMetadataOptions {
    /** Whether to enable the query */
    enabled?: boolean;
    /** Base endpoint URL for transform operations */
    endpoint: string;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: (metadata: TransformMetadata) => void;
}

export interface UseTransformMetadataReturn {
    /** Transform metadata */
    data: TransformMetadata | undefined;
    /** Last request error, if any */
    error: Error | undefined;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** Refetch the transform metadata */
    refetch: () => void;
}

/**
 * React hook for fetching transformation metadata using TanStack Query.
 * Returns available formats and transformation parameters.
 * @param options Hook configuration options
 * @returns Transform metadata fetching functions and state
 */
export const useTransformMetadata = (options: UseTransformMetadataOptions): UseTransformMetadataReturn => {
    const { enabled = true, endpoint, onError, onSuccess } = options;

    const query = useQuery({
        enabled,
        queryFn: async (): Promise<TransformMetadata> => {
            const url = buildUrl(endpoint, "metadata");
            const data = await fetchJson<TransformMetadata>(url);

            return {
                formats: data.formats,
                parameters: data.parameters,
            };
        },
        queryKey: storageQueryKeys.transform.metadata(endpoint),
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
        if (query.data && onSuccessRef.current) {
            onSuccessRef.current(query.data);
        }
    }, [query.data]);

    useEffect(() => {
        if (query.error && onErrorRef.current) {
            onErrorRef.current(query.error as Error);
        }
    }, [query.error]);

    return {
        data: query.data,
        error: (query.error as Error) || undefined,
        isLoading: query.isLoading,
        refetch: () => {
            query.refetch();
        },
    };
};
