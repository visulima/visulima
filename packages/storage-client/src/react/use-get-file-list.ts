import { useQuery } from "@tanstack/react-query";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";
import type { FileMeta } from "./types";

export interface FileListResponse {
    data: FileMeta[];
    meta?: {
        firstPage?: number;
        firstPageUrl?: string;
        lastPage?: number;
        lastPageUrl?: string;
        nextPageUrl?: string | undefined;
        page?: number;
        perPage?: number;
        previousPageUrl?: string | undefined;
        total?: number;
    };
}

export interface UseGetFileListOptions {
    /** Whether to enable the query */
    enabled?: boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Maximum number of elements to retrieve */
    limit?: number;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: (data: FileListResponse) => void;
    /** Page number for pagination */
    page?: number;
}

export interface UseGetFileListReturn {
    /** File list data */
    data: FileListResponse | undefined;
    /** Last request error, if any */
    error: Error | undefined;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** Refetch the file list */
    refetch: () => void;
}

/**
 * React hook for fetching a list of files using TanStack Query.
 * Supports pagination via query parameters.
 * @param options Hook configuration options
 * @returns File list fetching functions and state
 */
export const useGetFileList = (options: UseGetFileListOptions): UseGetFileListReturn => {
    const { enabled = true, endpoint, limit, onError, onSuccess, page } = options;

    const query = useQuery({
        enabled,
        queryFn: async (): Promise<FileListResponse> => {
            const url = buildUrl(endpoint, "", { limit, page });
            const data = await fetchJson<FileListResponse | FileMeta[]>(url);

            // Handle both paginated and non-paginated responses
            return Array.isArray(data)
                ? { data }
                : {
                    data: data.data || (data as unknown as FileMeta[]),
                    meta: (data as FileListResponse).meta,
                };
        },
        queryKey: storageQueryKeys.files.list(endpoint, { limit, page }),
    });

    // Call callbacks
    if (query.data && onSuccess) {
        onSuccess(query.data);
    }

    if (query.error && onError) {
        onError(query.error as Error);
    }

    return {
        data: query.data,
        error: (query.error as Error) || undefined,
        isLoading: query.isLoading,
        refetch: () => {
            query.refetch();
        },
    };
};
