import { useQuery } from "@tanstack/vue-query";
import type { MaybeRefOrGetter } from "vue";
import { computed, toValue } from "vue";

import { buildUrl, extractFileMetaFromHeaders, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

export interface UseGetFileOptions {
    /** Whether to enable the query */
    enabled?: MaybeRefOrGetter<boolean>;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch */
    id: MaybeRefOrGetter<string>;
    /** Transformation parameters for media files */
    transform?: MaybeRefOrGetter<Record<string, string | number | boolean> | undefined>;
}

export interface UseGetFileReturn {
    /** File data as Blob */
    data: Readonly<Ref<Blob | undefined>>;
    /** Last request error, if any */
    error: Readonly<Ref<Error | null>>;
    /** Whether a request is currently in progress */
    isLoading: Readonly<Ref<boolean>>;
    /** File metadata from response headers */
    meta: Readonly<Ref<FileMeta | null>>;
    /** Refetch the file */
    refetch: () => void;
}

/**
 * Vue composable for fetching/downloading files using TanStack Query
 * Supports optional transformation parameters for media files
 * @param options Hook configuration options
 * @returns File fetching functions and state
 */
export const useGetFile = (options: UseGetFileOptions): UseGetFileReturn => {
    const { enabled = true, endpoint, id, transform } = options;

    const query = useQuery({
        enabled: computed(() => toValue(enabled) && !!toValue(id)),
        queryFn: async () => {
            const fileId = toValue(id);
            const transformParams = toValue(transform);
            const url = buildUrl(endpoint, fileId, transformParams);
            const response = await fetch(url, {
                method: "GET",
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => {
                    return {
                        error: {
                            code: "RequestFailed",
                            message: response.statusText,
                        },
                    };
                });

                throw new Error(errorData.error?.message || `Failed to get file: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            const meta = extractFileMetaFromHeaders(fileId, response.headers);

            return { blob, meta };
        },
        queryKey: computed(() => storageQueryKeys.files.detail(toValue(id), toValue(transform))),
    });

    return {
        data: computed(() => query.data.value?.blob),
        error: computed(() => (query.error.value as Error) || null),
        isLoading: computed(() => query.isLoading.value),
        meta: computed(() => query.data.value?.meta || null),
        refetch: () => {
            query.refetch();
        },
    };
};
