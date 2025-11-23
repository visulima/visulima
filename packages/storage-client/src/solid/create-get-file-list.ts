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
    const { enabled = true, endpoint, limit, page } = options;

    const limitValue = typeof limit === "function" ? limit : () => limit;
    const pageValue = typeof page === "function" ? page : () => page;
    const enabledValue = typeof enabled === "function" ? enabled : () => enabled;

    const query = createQuery(() => {
        return {
            enabled: enabledValue(),
            queryFn: async (): Promise<FileListResponse> => {
                const url = buildUrl(endpoint, "", { limit: limitValue(), page: pageValue() });
                const data = await fetchJson<FileListResponse | FileMeta[]>(url);

                // Handle both paginated and non-paginated responses
                return Array.isArray(data)
                    ? { data }
                    : {
                        data: data.data || (data as unknown as FileMeta[]),
                        meta: (data as FileListResponse).meta,
                    };
            },
            queryKey: storageQueryKeys.files.list(endpoint, { limit: limitValue(), page: pageValue() }),
        };
    });

    return {
        data: query.data as unknown as Accessor<FileListResponse | undefined>,
        error: (() => {
            const error = query.error?.();

            return (error as Error) || undefined;
        }) as Accessor<Error | undefined>,
        isLoading: query.isLoading as unknown as Accessor<boolean>,
        refetch: () => {
            query.refetch();
        },
    };
};
