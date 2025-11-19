import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { buildUrl, putFile, storageQueryKeys } from "../core";
import type { UploadResult } from "./types";

export interface UsePutFileOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when upload progress updates */
    onProgress?: (progress: number) => void;
    /** Callback when request succeeds */
    onSuccess?: (result: UploadResult) => void;
}

export interface UsePutFileReturn {
    /** Last upload result, if any */
    data: UploadResult | null;
    /** Last request error, if any */
    error: Error | null;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** Current upload progress (0-100) */
    progress: number;
    /** Create or update a file by ID */
    putFile: (id: string, file: File | Blob) => Promise<UploadResult>;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * React hook for creating or updating files via PUT request using TanStack Query
 * Automatically invalidates related queries
 * @param options Hook configuration options
 * @returns File PUT functions and state
 */
export const usePutFile = (options: UsePutFileOptions): UsePutFileReturn => {
    const { endpoint, onError, onProgress, onSuccess } = options;
    const queryClient = useQueryClient();

    const [progress, setProgress] = useState(0);

    const mutation = useMutation({
        mutationFn: async ({ file, id }: { file: File | Blob; id: string }): Promise<UploadResult> => {
            const url = buildUrl(endpoint, id);
            const result = await putFile(url, file, (progressValue) => {
                setProgress(progressValue);
                onProgress?.(progressValue);
            });

            return {
                id,
                metadata: result.etag ? { etag: result.etag } : undefined,
                url: result.location || url,
            };
        },
        onError: (error: Error) => {
            setProgress(0);
            onError?.(error);
        },
        onSuccess: (result, variables) => {
            // Invalidate file-related queries
            queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(variables.id) });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(variables.id) });
            queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(variables.id) });
            setProgress(0);
            onSuccess?.(result);
        },
    });

    return {
        data: mutation.data || null,
        error: (mutation.error as Error) || null,
        isLoading: mutation.isPending,
        progress,
        putFile: (id: string, file: File | Blob) => mutation.mutateAsync({ file, id }),
        reset: () => {
            setProgress(0);
            mutation.reset();
        },
    };
};
