import { ref } from "vue";

import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";

import { buildUrl, putFile, storageQueryKeys } from "../core";
import type { UploadResult } from "../react/types";

export interface UsePutFileOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Callback when upload progress updates */
    onProgress?: (progress: number) => void;
}

export interface UsePutFileReturn {
    /** Last request error, if any */
    error: Readonly<Ref<Error | null>>;
    /** Whether a request is currently in progress */
    isLoading: Readonly<Ref<boolean>>;
    /** Current upload progress (0-100) */
    progress: Readonly<Ref<number>>;
    /** Create or update a file by ID */
    putFile: (id: string, file: File | Blob) => Promise<UploadResult>;
    /** Reset mutation state */
    reset: () => void;
    /** Last upload result, if any */
    data: Readonly<Ref<UploadResult | null>>;
}

/**
 * Vue composable for creating or updating files via PUT request using TanStack Query
 * Automatically invalidates related queries
 * @param options Hook configuration options
 * @returns File PUT functions and state
 */
export const usePutFile = (options: UsePutFileOptions): UsePutFileReturn => {
    const { endpoint, onProgress } = options;
    const queryClient = useQueryClient();

    const progress = ref(0);

    const mutation = useMutation({
        mutationFn: async ({ id, file }: { id: string; file: File | Blob }): Promise<UploadResult> => {
            const url = buildUrl(endpoint, id);
            const result = await putFile(url, file, (progressValue) => {
                progress.value = progressValue;
                onProgress?.(progressValue);
            });

            return {
                id,
                url: result.location || url,
                metadata: result.etag ? { etag: result.etag } : undefined,
            };
        },
        onError: () => {
            progress.value = 0;
        },
        onSuccess: (_data, variables) => {
            // Invalidate file-related queries
            queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(variables.id) });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(variables.id) });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(variables.id) });
            progress.value = 0;
        },
    });

    return {
        data: computed(() => mutation.data.value || null),
        error: computed(() => (mutation.error.value as Error) || null),
        isLoading: computed(() => mutation.isPending.value),
        progress,
        putFile: (id: string, file: File | Blob) => mutation.mutateAsync({ id, file }),
        reset: () => {
            progress.value = 0;
            mutation.reset();
        },
    };
};

