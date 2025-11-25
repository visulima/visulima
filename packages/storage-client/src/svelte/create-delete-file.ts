import { createMutation, useQueryClient } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived } from "svelte/store";

import { buildUrl, deleteRequest, storageQueryKeys } from "../core";

export interface CreateDeleteFileOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
}

export interface CreateDeleteFileReturn {
    /** Delete a file by ID */
    deleteFile: (id: string) => Promise<void>;
    /** Last request error, if any */
    error: Readable<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * Svelte store-based utility for deleting a single file using TanStack Query.
 * Automatically invalidates related queries.
 *
 * IMPORTANT: Due to TanStack Query Svelte requirements, createMutation must be called
 * at the component's top level, not inside utility functions. For proper usage, call
 * createMutation directly in your component and use the returned stores.
 *
 * @param options Hook configuration options
 * @returns File deletion functions and state stores
 */
export const createDeleteFile = (options: CreateDeleteFileOptions): CreateDeleteFileReturn => {
    const { endpoint } = options;
    const queryClient = useQueryClient();

    const mutation = createMutation(() => {
        return {
            mutationFn: async (id: string): Promise<void> => {
                const url = buildUrl(endpoint, id);

                await deleteRequest(url);
            },
            onSuccess: (_data, id) => {
                // Invalidate file-related queries
                queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all(endpoint) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(endpoint, id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(endpoint, id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(endpoint, id) });
            },
        };
    });

    return {
        deleteFile: mutation.mutateAsync,
        error: derived(mutation.error, ($error) => ($error as Error) || undefined),
        isLoading: mutation.isPending,
        reset: mutation.reset,
    };
};
