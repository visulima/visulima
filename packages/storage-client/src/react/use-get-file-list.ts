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
        nextPageUrl?: string | null;
        page?: number;
        perPage?: number;
        previousPageUrl?: string | null;
        total?: number;
    };
}

export interface UseGetFileListOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Maximum number of elements to retrieve */
    limit?: number;
    /** Page number for pagination */
    page?: number;
    /** Whether to enable the query */
    enabled?: boolean;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: (data: FileListResponse) => void;
}

export interface UseGetFileListReturn {
    /** Last request error, if any */
    error: Error | null;
    /** File list data */
    data: FileListResponse | undefined;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** Refetch the file list */
    refetch: () => void;
}

/**
 * React hook for fetching a list of files using TanStack Query
 * Supports pagination via query parameters
 * @param options Hook configuration options
 * @returns File list fetching functions and state
 */
export const useGetFileList = (options: UseGetFileListOptions): UseGetFileListReturn => {
    const { endpoint, limit, page, enabled = true, onError, onSuccess } = options;

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
        queryKey: storageQueryKeys.files.list({ limit, page }),
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
        error: (query.error as Error) || null,
        isLoading: query.isLoading,
        refetch: () => {
            query.refetch();
        },
    };
};
