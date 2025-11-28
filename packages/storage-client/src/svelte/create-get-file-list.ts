import { createQuery } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, get, readable } from "svelte/store";

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
    enabled?: Readable<boolean> | boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Maximum number of elements to retrieve */
    limit?: Readable<number> | number;
    /** Page number for pagination */
    page?: Readable<number> | number;
}

export interface CreateGetFileListReturn {
    /** File list data */
    data: Readable<FileListResponse | undefined>;
    /** Last request error, if any */
    error: Readable<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** Refetch the file list */
    refetch: () => void;
}

/**
 * Svelte store-based utility for fetching a list of files using TanStack Query.
 * Supports pagination via query parameters.
 * @param options Hook configuration options
 * @returns File list fetching functions and state stores
 */
export const createGetFileList = (options: CreateGetFileListOptions): CreateGetFileListReturn => {
    const { enabled = true, endpoint, limit, page } = options;

    const limitStore: Readable<number | undefined> = typeof limit === "object" && "subscribe" in limit ? limit : derived([], () => limit);
    const pageStore: Readable<number | undefined> = typeof page === "object" && "subscribe" in page ? page : derived([], () => page);
    const enabledStore: Readable<boolean> = typeof enabled === "object" && "subscribe" in enabled ? enabled : derived([], () => enabled as boolean);

    const query = createQuery(() => {
        const currentLimit = get(limitStore);
        const currentPage = get(pageStore);
        const currentEnabled = get(enabledStore);

        return {
            enabled: currentEnabled,
            queryFn: async (): Promise<FileListResponse> => {
                const url = buildUrl(endpoint, "", { limit: currentLimit, page: currentPage });
                const data = await fetchJson<FileListResponse | FileMeta[]>(url);

                // Handle both paginated and non-paginated responses
                return Array.isArray(data)
                    ? { data }
                    : {
                        data: data.data || (data as unknown as FileMeta[]),
                        meta: (data as FileListResponse).meta,
                    };
            },
            queryKey: storageQueryKeys.files.list(endpoint, { limit: currentLimit, page: currentPage }),
        };
    });

    const dataStore = (query.data as unknown as Readable<FileListResponse | undefined> | null) ?? readable<FileListResponse | undefined>(undefined);
    const errorStore = derived((query.error as unknown as Readable<Error | null> | null) ?? readable<Error | null>(undefined), ($error) =>
        ($error ? ($error as Error) : undefined),
    );
    const isLoadingStore: Readable<boolean>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Query query type is complex
        = typeof (query.isLoading as any) === "object" && (query.isLoading as any) !== null && "subscribe" in (query.isLoading as any)
            ? (query.isLoading as unknown as Readable<boolean>)
            : readable<boolean>(false);

    return {
        data: derived(dataStore, ($data) => $data || undefined),
        error: errorStore,
        isLoading: isLoadingStore,
        refetch: () => {
            query.refetch();
        },
    };
};
