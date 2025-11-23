import { useQuery } from "@tanstack/vue-query";
import type { MaybeRefOrGetter } from "vue";
import { computed, toValue } from "vue";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

export interface UseGetFileMetaOptions {
    /** Whether to enable the query */
    enabled?: MaybeRefOrGetter<boolean>;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch metadata for */
    id: MaybeRefOrGetter<string>;
}

export interface UseGetFileMetaReturn {
    /** File metadata */
    data: Readonly<Ref<FileMeta | undefined>>;
    /** Last request error, if any */
    error: Readonly<Ref<Error | undefined>>;
    /** Whether a request is currently in progress */
    isLoading: Readonly<Ref<boolean>>;
    /** Refetch the file metadata */
    refetch: () => void;
}

/**
 * Vue composable for fetching file metadata using TanStack Query.
 * @param options Hook configuration options
 * @returns File metadata fetching functions and state
 */
export const useGetFileMeta = (options: UseGetFileMetaOptions): UseGetFileMetaReturn => {
    const { enabled = true, endpoint, id } = options;

    const query = useQuery({
        enabled: computed(() => toValue(enabled) && !!toValue(id)),
        queryFn: async (): Promise<FileMeta> => {
            const fileId = toValue(id);
            const url = buildUrl(endpoint, `${fileId}/metadata`);
            const data = await fetchJson<FileMeta>(url);

            return {
                ...data,
                id: data.id || fileId,
            };
        },
        queryKey: computed(() => storageQueryKeys.files.meta(toValue(id))),
    });

    return {
        data: query.data,
        error: computed(() => (query.error.value as Error) || undefined),
        isLoading: computed(() => query.isLoading.value),
        refetch: () => {
            query.refetch();
        },
    };
};
