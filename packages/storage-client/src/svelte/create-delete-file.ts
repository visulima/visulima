import { createMutation, useQueryClient } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, readable } from "svelte/store";

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

    // Ensure stores are always defined (mutation stores might be undefined initially in test environments)
    // mutation.error and mutation.isPending are stores from createMutation, but we need to ensure they're always valid stores
    const errorStore = mutation.error ?? readable<Error | undefined>(undefined);
    const isLoadingStore = mutation.isPending ?? readable<boolean>(false);

    return {
        deleteFile: mutation.mutateAsync,
        error: derived(errorStore, ($error) => ($error as Error) || undefined),
        isLoading: isLoadingStore,
        reset: mutation.reset,
    };
};
