import { createQuery } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, fromStore } from "svelte/store";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";
import toReadable from "./to-readable";

export interface FileListResponse {
    data: FileMeta[];
    meta?: {
        firstPage?: number;
        firstPageUrl?: string;
        lastPage?: number;
        lastPageUrl?: string;
        nextPageUrl?: string;
        page?: number;
        perPage?: number;
        previousPageUrl?: string;
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
 * Requires the server handler to be created with `allowList: true`; listing is off by default because it exposes every stored file.
 * Supports pagination via query parameters.
 * @param options Hook configuration options
 * @returns File list fetching functions and state stores
 */
export const createGetFileList = (options: CreateGetFileListOptions): CreateGetFileListReturn => {
    const { enabled = true, endpoint, limit, page } = options;

    const limitStore: Readable<number | undefined> = typeof limit === "object" && "subscribe" in limit ? limit : derived([], () => limit);
    const pageStore: Readable<number | undefined> = typeof page === "object" && "subscribe" in page ? page : derived([], () => page);
    const enabledStore: Readable<boolean> = typeof enabled === "object" && "subscribe" in enabled ? enabled : derived([], () => enabled);

    const limitState = fromStore(limitStore);
    const pageState = fromStore(pageStore);
    const enabledState = fromStore(enabledStore);

    const query = createQuery(() => {
        const currentLimit = limitState.current;
        const currentPage = pageState.current;
        const currentEnabled = enabledState.current;

        return {
            enabled: currentEnabled,
            queryFn: async ({ signal }): Promise<FileListResponse> => {
                const url = buildUrl(endpoint, "", { limit: currentLimit, page: currentPage });
                const data = await fetchJson<FileListResponse | FileMeta[]>(url, { signal });

                // Handle both paginated and non-paginated responses
                return Array.isArray(data)
                    ? { data }
                    : {
                          data: data.data,
                          meta: data.meta,
                      };
            },
            queryKey: storageQueryKeys.files.list(endpoint, { limit: currentLimit, page: currentPage }),
        };
    });

    const dataStore = toReadable(() => query.data);
    const errorStore = derived(
        toReadable(() => query.error),
        ($error) => $error ?? undefined,
    );
    const isLoadingStore: Readable<boolean> = toReadable(() => query.isLoading);

    return {
        data: derived(dataStore, ($data) => $data ?? undefined),
        error: errorStore,
        isLoading: isLoadingStore,
        refetch: () => {
            query.refetch().catch(() => {});
        },
    };
};
