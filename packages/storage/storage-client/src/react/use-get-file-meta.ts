import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";
import type { FileMeta } from "./types";

export interface UseGetFileMetaOptions {
    /** Whether to enable the query */
    enabled?: boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch metadata for */
    id: string;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: (meta: FileMeta) => void;
}

export interface UseGetFileMetaReturn {
    /** File metadata */
    data: FileMeta | undefined;
    /** Last request error, if any */
    error: Error | undefined;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** Refetch the file metadata */
    refetch: () => void;
}

/**
 * React hook for fetching file metadata using TanStack Query.
 * @param options Hook configuration options
 * @returns File metadata fetching functions and state
 */
export const useGetFileMeta = (options: UseGetFileMetaOptions): UseGetFileMetaReturn => {
    const { enabled = true, endpoint, id, onError, onSuccess } = options;

    const query = useQuery({
        enabled: enabled && !!id,
        queryFn: async (): Promise<FileMeta> => {
            const url = buildUrl(endpoint, `${id}/metadata`);
            const data = await fetchJson<FileMeta>(url);

            return {
                ...data,
                id: data.id || id,
            };
        },
        queryKey: storageQueryKeys.files.meta(endpoint, id),
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
