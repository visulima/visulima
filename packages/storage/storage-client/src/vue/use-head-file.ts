import { useQuery } from "@tanstack/vue-query";
import type { MaybeRefOrGetter, Ref } from "vue";
import { computed, toValue } from "vue";

import type { FileHeadMetadata } from "../core";
import { buildUrl, extractHeadMetadataFromHeaders, fetchHead, storageQueryKeys } from "../core";

export interface UseHeadFileOptions {
    /** Whether to enable the query */
    enabled?: MaybeRefOrGetter<boolean>;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch metadata for */
    id: MaybeRefOrGetter<string>;
}

export interface UseHeadFileReturn {
    /** File metadata from HEAD request */
    data: Readonly<Ref<FileHeadMetadata | undefined>>;
    /** Last request error, if any */
    error: Readonly<Ref<Error | undefined>>;
    /** Whether a request is currently in progress */
    isLoading: Readonly<Ref<boolean>>;
    /** Refetch the file metadata */
    refetch: () => void;
}

/**
 * Vue composable for fetching file metadata via HEAD request using TanStack Query.
 * Useful for checking upload progress and file status without downloading.
 * @param options Hook configuration options
 * @returns File HEAD request functions and state
 */
export const useHeadFile = (options: UseHeadFileOptions): UseHeadFileReturn => {
    const { enabled = true, endpoint, id } = options;

    const query = useQuery({
        enabled: computed(() => toValue(enabled) && !!toValue(id)),
        queryFn: async ({ signal }): Promise<FileHeadMetadata> => {
            const fileId = toValue(id);
            const url = buildUrl(endpoint, fileId);

            return extractHeadMetadataFromHeaders(await fetchHead(url, { signal }));
        },
        queryKey: computed(() => storageQueryKeys.files.head(endpoint, toValue(id))),
    });

    return {
        data: computed(() => query.data.value),
        error: computed(() => query.error.value ?? undefined),
        isLoading: computed(() => query.isLoading.value),
        refetch: () => {
            query.refetch().catch(() => {});
        },
    };
};
