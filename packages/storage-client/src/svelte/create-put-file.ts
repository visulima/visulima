import { createMutation, useQueryClient } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, readable, writable } from "svelte/store";

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
    data: Readable<UploadResult | undefined>;
    /** Last request error, if any */
    error: Readable<Error | undefined>;
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
 * Svelte store-based utility for creating or updating files via PUT request using TanStack Query.
 * Automatically invalidates related queries.
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
                queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all(endpoint) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(endpoint, variables.id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(endpoint, variables.id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(endpoint, variables.id) });
                progress.set(0);
            },
        };
    });

    const dataStore = (mutation.data as unknown as Readable<UploadResult | undefined> | null) ?? readable<UploadResult | undefined>(undefined);
    const errorStore = (mutation.error as unknown as Readable<Error | null> | null) ?? readable<Error | null>(undefined);
    const isLoadingStore: Readable<boolean>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Query mutation type is complex
        = typeof (mutation.isPending as any) === "object" && (mutation.isPending as any) !== null && "subscribe" in (mutation.isPending as any)
            ? (mutation.isPending as unknown as Readable<boolean>)
            : readable<boolean>(false);

    return {
        data: derived(dataStore, ($data) => $data || undefined),
        error: derived(errorStore, ($error) => $error ? ($error as Error) : undefined),
        isLoading: isLoadingStore,
        progress,
        putFile: (id: string, file: File | Blob) => mutation.mutateAsync({ file, id }),
        reset: () => {
            progress.set(0);
            mutation.reset();
        },
    };
};
