import { createMutation, useQueryClient } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived } from "svelte/store";

import { buildUrl, patchChunk, storageQueryKeys } from "../core";
import type { UploadResult } from "../react/types";

export interface CreatePatchChunkOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
}

export interface CreatePatchChunkReturn {
    /** Last upload result, if any */
    data: Readable<UploadResult | null>;
    /** Last request error, if any */
    error: Readable<Error | null>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** Upload a chunk for chunked uploads */
    patchChunk: (id: string, chunk: Blob, offset: number, checksum?: string) => Promise<UploadResult>;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * Svelte store-based utility for uploading chunks in chunked uploads using TanStack Query
 * Requires X-Chunk-Offset header and chunk data
 * Automatically invalidates related queries when upload is complete
 * @param options Hook configuration options
 * @returns Chunk upload functions and state stores
 */
export const createPatchChunk = (options: CreatePatchChunkOptions): CreatePatchChunkReturn => {
    const { endpoint } = options;
    const queryClient = useQueryClient();

    const mutation = createMutation(() => {
        return {
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
                    queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all });
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(variables.id) });
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(variables.id) });
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(variables.id) });
                } else {
                // Otherwise, just invalidate the head query to update progress
                    queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.head(variables.id) });
                }
            },
        };
    });

    return {
        data: derived(mutation.data, ($data) => $data || null),
        error: derived(mutation.error, ($error) => ($error as Error) || null),
        isLoading: mutation.isPending,
        patchChunk: (id: string, chunk: Blob, offset: number, checksum?: string) => mutation.mutateAsync({ checksum, chunk, id, offset }),
        reset: mutation.reset,
    };
};
