import type { QueryClient } from "@tanstack/solid-query";
import { createQuery } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

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

export interface CreateGetFileListOptions {
    /** Whether to enable the query */
    enabled?: Accessor<boolean> | boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Maximum number of elements to retrieve */
    limit?: Accessor<number> | number;
    /** Page number for pagination */
    page?: Accessor<number> | number;
    /** Optional QueryClient to use */
    queryClient?: QueryClient;
}

export interface CreateGetFileListReturn {
    /** File list data */
    data: Accessor<FileListResponse | undefined>;
    /** Last request error, if any */
    error: Accessor<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Accessor<boolean>;
    /** Refetch the file list */
    refetch: () => void;
}

/**
 * Solid.js primitive for fetching a list of files using TanStack Query.
 * Supports pagination via query parameters.
 * @param options Hook configuration options
 * @returns File list fetching functions and state signals
 */
export const createGetFileList = (options: CreateGetFileListOptions): CreateGetFileListReturn => {
    const { enabled = true, endpoint, limit, page, queryClient } = options;

    const limitValue = typeof limit === "function" ? limit : () => limit;
    const pageValue = typeof page === "function" ? page : () => page;
    const enabledValue = typeof enabled === "function" ? enabled : () => enabled;

    const query = createQuery(
        () => {
            const limit = limitValue();
            const page = pageValue();
            const enabled = enabledValue();

            // Build filters with stable structure - use undefined for missing values
            // This ensures TanStack Query can properly compare queryKeys using deep equality
            const filters: { limit?: number; page?: number } | undefined
                = limit !== undefined || page !== undefined
                    ? {
                        ...limit !== undefined && { limit },
                        ...page !== undefined && { page },
                    }
                    : undefined;

            const queryKey = storageQueryKeys.files.list(endpoint, filters);

            return {
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
                queryKey,
            };
        },
        queryClient ? () => queryClient : undefined,
    );

    return {
        data: () => {
            try {
                const dataValue = (query as any).data;

                if (typeof dataValue === "function") {
                    return dataValue() as FileListResponse | undefined;
                }

                return dataValue as FileListResponse | undefined;
            } catch {
                return undefined;
            }
        },
        error: () => {
            try {
                const errorValue = (query as any).error;
                const error = typeof errorValue === "function" ? errorValue() : errorValue;

                return (error as Error) || undefined;
            } catch {
                return undefined;
            }
        },
        isLoading: () => {
            try {
                const isLoadingValue = (query as any).isLoading;

                return (typeof isLoadingValue === "function" ? isLoadingValue() : isLoadingValue) as boolean;
            } catch {
                return false;
            }
        },
        refetch: () => {
            query.refetch();
        },
    };
};
