import { useMutation, useQueryClient } from "@tanstack/react-query";

import { buildUrl, patchChunk, storageQueryKeys } from "../core";
import type { UploadResult } from "./types";

export interface UsePatchChunkOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: (result: UploadResult) => void;
}

export interface UsePatchChunkReturn {
    /** Last upload result, if any */
    data: UploadResult | undefined;
    /** Last request error, if any */
    error: Error | undefined;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** Upload a chunk for chunked uploads */
    patchChunk: (id: string, chunk: Blob, offset: number, checksum?: string) => Promise<UploadResult>;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * React hook for uploading chunks in chunked uploads using TanStack Query.
 * Requires X-Chunk-Offset header and chunk data.
 * Automatically invalidates related queries when upload is complete.
 * @param options Hook configuration options
 * @returns Chunk upload functions and state
 */
export const usePatchChunk = (options: UsePatchChunkOptions): UsePatchChunkReturn => {
    const { endpoint, onError, onSuccess } = options;
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
        onError: (error: Error) => {
            onError?.(error);
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

            onSuccess?.(result);
        },
    });

    return {
        data: mutation.data || undefined,
        error: (mutation.error as Error) || undefined,
        isLoading: mutation.isPending,
        patchChunk: (id: string, chunk: Blob, offset: number, checksum?: string) => mutation.mutateAsync({ checksum, chunk, id, offset }),
        reset: mutation.reset,
    };
};
