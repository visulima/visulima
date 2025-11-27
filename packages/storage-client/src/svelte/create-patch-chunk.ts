import { createMutation, useQueryClient } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, readable } from "svelte/store";

import { buildUrl, patchChunk, storageQueryKeys } from "../core";
import type { UploadResult } from "../react/types";

export interface CreatePatchChunkOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
}

export interface CreatePatchChunkReturn {
    /** Last upload result, if any */
    data: Readable<UploadResult | undefined>;
    /** Last request error, if any */
    error: Readable<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** Upload a chunk for chunked uploads */
    patchChunk: (id: string, chunk: Blob, offset: number, checksum?: string) => Promise<UploadResult>;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * Svelte store-based utility for uploading chunks in chunked uploads using TanStack Query.
 * Requires X-Chunk-Offset header and chunk data.
 * Automatically invalidates related queries when upload is complete.
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
                    queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all(endpoint) });
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(endpoint, variables.id) });
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(endpoint, variables.id) });
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(endpoint, variables.id) });
                } else {
                    // Otherwise, just invalidate the head query to update progress
                    queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.head(endpoint, variables.id) });
                }
            },
        };
    });

    const dataStore = (mutation.data as unknown as Readable<UploadResult | undefined> | null) ?? readable<UploadResult | undefined>(undefined);
    const errorStore = (mutation.error as unknown as Readable<Error | null> | null) ?? readable<Error | null>(null);
    const isLoadingStore: Readable<boolean>
        = typeof (mutation.isPending as any) === "object" && (mutation.isPending as any) !== null && "subscribe" in (mutation.isPending as any)
            ? (mutation.isPending as unknown as Readable<boolean>)
            : readable<boolean>(false);

    return {
        data: derived(dataStore, ($data) => $data || undefined),
        error: derived(errorStore, ($error) => $error ? ($error as Error) : undefined),
        isLoading: isLoadingStore,
        patchChunk: (id: string, chunk: Blob, offset: number, checksum?: string) => mutation.mutateAsync({ checksum, chunk, id, offset }),
        reset: mutation.reset,
    };
};
