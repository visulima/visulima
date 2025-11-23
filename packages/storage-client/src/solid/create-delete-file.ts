import { createMutation, useQueryClient } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

import { buildUrl, deleteRequest, storageQueryKeys } from "../core";

export interface CreateDeleteFileOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
}

export interface CreateDeleteFileReturn {
    /** Delete a file by ID */
    deleteFile: (id: string) => Promise<void>;
    /** Last request error, if any */
    error: Accessor<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Accessor<boolean>;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * Solid.js primitive for deleting a single file using TanStack Query.
 * Automatically invalidates related queries.
 * @param options Hook configuration options
 * @returns File deletion functions and state signals
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
                queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(id) });
            },
        };
    });

    return {
        deleteFile: mutation.mutateAsync,
        error: mutation.error as Accessor<Error | undefined>,
        isLoading: mutation.isPending,
        reset: mutation.reset,
    };
};
