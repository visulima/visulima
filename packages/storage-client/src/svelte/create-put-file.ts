import { createMutation, useQueryClient } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, writable } from "svelte/store";

import { buildUrl, putFile, storageQueryKeys } from "../core";
import type { UploadResult } from "../react/types";

export interface CreatePutFileOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Callback when upload progress updates */
    onProgress?: (progress: number) => void;
}

export interface CreatePutFileReturn {
    /** Last upload result, if any */
    data: Readable<UploadResult | null>;
    /** Last request error, if any */
    error: Readable<Error | null>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** Current upload progress (0-100) */
    progress: Readable<number>;
    /** Create or update a file by ID */
    putFile: (id: string, file: File | Blob) => Promise<UploadResult>;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * Svelte store-based utility for creating or updating files via PUT request using TanStack Query
 * Automatically invalidates related queries
 * @param options Hook configuration options
 * @returns File PUT functions and state stores
 */
export const createPutFile = (options: CreatePutFileOptions): CreatePutFileReturn => {
    const { endpoint, onProgress } = options;
    const queryClient = useQueryClient();

    const progress = writable(0);

    const mutation = createMutation(() => {
        return {
            mutationFn: async ({ file, id }: { file: File | Blob; id: string }): Promise<UploadResult> => {
                const url = buildUrl(endpoint, id);
                const result = await putFile(url, file, (progressValue) => {
                    progress.set(progressValue);
                    onProgress?.(progressValue);
                });

                return {
                    id,
                    metadata: result.etag ? { etag: result.etag } : undefined,
                    url: result.location || url,
                };
            },
            onError: () => {
                progress.set(0);
            },
            onSuccess: (_data, variables) => {
            // Invalidate file-related queries
                queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(variables.id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(variables.id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(variables.id) });
                progress.set(0);
            },
        };
    });

    return {
        data: derived(mutation.data, ($data) => $data || null),
        error: derived(mutation.error, ($error) => ($error as Error) || null),
        isLoading: mutation.isPending,
        progress,
        putFile: (id: string, file: File | Blob) => mutation.mutateAsync({ file, id }),
        reset: () => {
            progress.set(0);
            mutation.reset();
        },
    };
};
