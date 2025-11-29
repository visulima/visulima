import { useMutation, useQueryClient } from "@tanstack/react-query";

import { buildUrl, deleteRequest, storageQueryKeys } from "../core";

export interface UseDeleteFileOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: () => void;
}

export interface UseDeleteFileReturn {
    /** Delete a file by ID */
    deleteFile: (id: string) => Promise<void>;
    /** Last request error, if any */
    error: Error | undefined;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * React hook for deleting a single file using TanStack Query.
 * Automatically invalidates related queries.
 * @param options Hook configuration options
 * @returns File deletion functions and state
 */
export const useDeleteFile = (options: UseDeleteFileOptions): UseDeleteFileReturn => {
    const { endpoint, onError, onSuccess } = options;
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (id: string): Promise<void> => {
            const url = buildUrl(endpoint, id);

            await deleteRequest(url);
        },
        onError: (error: Error) => {
            onError?.(error);
        },
        onSuccess: (_data, id) => {
            // Invalidate file-related queries
            queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all(endpoint) });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(endpoint, id) });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(endpoint, id) });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(endpoint, id) });
            onSuccess?.();
        },
    });

    return {
        deleteFile: mutation.mutateAsync,
        error: (mutation.error as Error) || undefined,
        isLoading: mutation.isPending,
        reset: mutation.reset,
    };
};
