import { useMutation, useQueryClient } from "@tanstack/vue-query";
import type { Ref } from "vue";
import { computed } from "vue";

import { buildUrl, deleteRequest, storageQueryKeys } from "../core";

export interface UseDeleteFileOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
}

export interface UseDeleteFileReturn {
    /** Delete a file by ID */
    deleteFile: (id: string) => Promise<void>;
    /** Last request error, if any */
    error: Readonly<Ref<Error | undefined>>;
    /** Whether a request is currently in progress */
    isLoading: Readonly<Ref<boolean>>;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * Vue composable for deleting a single file using TanStack Query.
 * Automatically invalidates related queries.
 * @param options Hook configuration options
 * @returns File deletion functions and state
 */
export const useDeleteFile = (options: UseDeleteFileOptions): UseDeleteFileReturn => {
    const { endpoint } = options;
    const queryClient = useQueryClient();

    const mutation = useMutation({
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
    });

    return {
        deleteFile: mutation.mutateAsync,
        error: computed(() => (mutation.error.value as Error) || undefined),
        isLoading: computed(() => mutation.isPending.value),
        reset: mutation.reset,
    };
};
