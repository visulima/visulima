import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";

import { buildUrl, patchChunk, storageQueryKeys } from "../core";
import type { UploadResult } from "../react/types";

export interface UsePatchChunkOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
}

export interface UsePatchChunkReturn {
    /** Last upload result, if any */
    data: Readonly<Ref<UploadResult | undefined>>;
    /** Last request error, if any */
    error: Readonly<Ref<Error | undefined>>;
    /** Whether a request is currently in progress */
    isLoading: Readonly<Ref<boolean>>;
    /** Upload a chunk for chunked uploads */
    patchChunk: (id: string, chunk: Blob, offset: number, checksum?: string) => Promise<UploadResult>;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * Vue composable for uploading chunks in chunked uploads using TanStack Query.
 * Requires X-Chunk-Offset header and chunk data.
 * Automatically invalidates related queries when upload is complete.
 * @param options Hook configuration options
 * @returns Chunk upload functions and state
 */
export const usePatchChunk = (options: UsePatchChunkOptions): UsePatchChunkReturn => {
    const { endpoint } = options;
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ checksum, chunk, id, offset }: { checksum?: string; chunk: Blob; id: string; offset: number }): Promise<UploadResult> => {
            const url = buildUrl(endpoint, id);
            const result = await patchChunk(url, chunk, offset, checksum);

            const uploadResult: UploadResult = {
                id,
                offset: result.uploadOffset,
                url: result.location || url,
            };

            if (result.etag) {
                uploadResult.metadata = { etag: result.etag };
            }

            if (result.uploadComplete) {
                uploadResult.status = "completed";
            }

            return uploadResult;
        },
        onSuccess: (result, variables) => {
            // If upload is complete, invalidate file queries
            if (result.status === "completed") {
                queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all(endpoint) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(endpoint, variables.id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(endpoint, variables.id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(endpoint, variables.id) });
            } else {
                // Otherwise, just invalidate the head query to update progress
                queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.head(endpoint, variables.id) });
            }
        },
    });

    return {
        data: computed(() => mutation.data.value || undefined),
        error: computed(() => (mutation.error.value as Error) || undefined),
        isLoading: computed(() => mutation.isPending.value),
        patchChunk: (id: string, chunk: Blob, offset: number, checksum?: string) => mutation.mutateAsync({ checksum, chunk, id, offset }),
        reset: mutation.reset,
    };
};
