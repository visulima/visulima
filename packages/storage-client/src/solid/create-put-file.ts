import { createSignal } from "solid-js";

import { createMutation } from "@tanstack/solid-query";
import { useQueryClient } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

import { buildUrl, putFile, storageQueryKeys } from "../core";
import type { UploadResult } from "../react/types";

export interface CreatePutFileOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Callback when upload progress updates */
    onProgress?: (progress: number) => void;
}

export interface CreatePutFileReturn {
    /** Last request error, if any */
    error: Accessor<Error | null>;
    /** Whether a request is currently in progress */
    isLoading: Accessor<boolean>;
    /** Current upload progress (0-100) */
    progress: Accessor<number>;
    /** Create or update a file by ID */
    putFile: (id: string, file: File | Blob) => Promise<UploadResult>;
    /** Reset mutation state */
    reset: () => void;
    /** Last upload result, if any */
    data: Accessor<UploadResult | null>;
}

/**
 * Solid.js primitive for creating or updating files via PUT request using TanStack Query
 * Automatically invalidates related queries
 * @param options Hook configuration options
 * @returns File PUT functions and state signals
 */
export const createPutFile = (options: CreatePutFileOptions): CreatePutFileReturn => {
    const { endpoint, onProgress } = options;
    const queryClient = useQueryClient();

    const [progress, setProgress] = createSignal(0);

    const mutation = createMutation(() => ({
        mutationFn: async ({ id, file }: { id: string; file: File | Blob }): Promise<UploadResult> => {
            const url = buildUrl(endpoint, id);
            const result = await putFile(url, file, (progressValue) => {
                setProgress(progressValue);
                onProgress?.(progressValue);
            });

            return {
                id,
                url: result.location || url,
                metadata: result.etag ? { etag: result.etag } : undefined,
            };
        },
        onError: () => {
            setProgress(0);
        },
        onSuccess: (_data, variables) => {
            // Invalidate file-related queries
            queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(variables.id) });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(variables.id) });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(variables.id) });
            setProgress(0);
        },
    }));

    return {
        data: () => mutation.data() || null,
        error: mutation.error as Accessor<Error | null>,
        isLoading: mutation.isPending,
        progress,
        putFile: (id: string, file: File | Blob) => mutation.mutateAsync({ id, file }),
        reset: () => {
            setProgress(0);
            mutation.reset();
        },
    };
};


