import { useQuery } from "@tanstack/vue-query";
import type { MaybeRefOrGetter } from "vue";
import { computed, toValue } from "vue";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

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
    /** Whether to enable the query */
    enabled?: MaybeRefOrGetter<boolean>;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Maximum number of elements to retrieve */
    limit?: MaybeRefOrGetter<number | undefined>;
    /** Page number for pagination */
    page?: MaybeRefOrGetter<number | undefined>;
}

export interface UseGetFileListReturn {
    /** File list data */
    data: Readonly<Ref<FileListResponse | undefined>>;
    /** Last request error, if any */
    error: Readonly<Ref<Error | null>>;
    /** Whether a request is currently in progress */
    isLoading: Readonly<Ref<boolean>>;
    /** Refetch the file list */
    refetch: () => void;
}

/**
 * Vue composable for fetching a list of files using TanStack Query
 * Supports pagination via query parameters
 * @param options Hook configuration options
 * @returns File list fetching functions and state
 */
export const useGetFileList = (options: UseGetFileListOptions): UseGetFileListReturn => {
    const { enabled = true, endpoint, limit, page } = options;

    const query = useQuery({
        enabled: computed(() => toValue(enabled)),
        queryFn: async (): Promise<FileListResponse> => {
            const url = buildUrl(endpoint, "", { limit: toValue(limit), page: toValue(page) });
            const data = await fetchJson<FileListResponse | FileMeta[]>(url);

            // Handle both paginated and non-paginated responses
            return Array.isArray(data)
                ? { data }
                : {
                    data: data.data || (data as unknown as FileMeta[]),
                    meta: (data as FileListResponse).meta,
                };
        },
        queryKey: computed(() => storageQueryKeys.files.list({ limit: toValue(limit), page: toValue(page) })),
    });

    return {
        data: query.data,
        error: computed(() => (query.error.value as Error) || null),
        isLoading: computed(() => query.isLoading.value),
        refetch: () => {
            query.refetch();
        },
    };
};
