import { useMutation, useQueryClient } from "@tanstack/react-query";

import { buildUrl, storageQueryKeys } from "../core";

export interface BatchDeleteResult {
    /** Number of files that failed to delete */
    failed?: number;
    /** Number of files successfully deleted */
    successful?: number;
}

export interface UseBatchDeleteFilesOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: (result: BatchDeleteResult) => void;
}

export interface UseBatchDeleteFilesReturn {
    /** Delete multiple files by IDs */
    batchDeleteFiles: (ids: string[]) => Promise<BatchDeleteResult>;
    /** Last request error, if any */
    error: Error | undefined;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * React hook for batch deleting files using TanStack Query.
 * Supports both query parameter and JSON body methods.
 * Automatically invalidates related queries.
 * @param options Hook configuration options
 * @returns Batch file deletion functions and state
 */
export const useBatchDeleteFiles = (options: UseBatchDeleteFilesOptions): UseBatchDeleteFilesReturn => {
    const { endpoint, onError, onSuccess } = options;
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (ids: string[]): Promise<BatchDeleteResult> => {
            const url = buildUrl(endpoint, "", { ids: ids.join(",") });

            const response = await fetch(url, {
                method: "DELETE",
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => {
                    return {
                        error: {
                            code: "RequestFailed",
                            message: response.statusText,
                        },
                    };
                });

                throw new Error(errorData.error?.message || `Failed to batch delete files: ${response.status} ${response.statusText}`);
            }

            // Extract batch delete results from headers (if available)
            const successfulHeader = response.headers.get("X-Delete-Successful");
            const failedHeader = response.headers.get("X-Delete-Failed");

            const result: BatchDeleteResult = {
                failed: failedHeader ? Number.parseInt(failedHeader, 10) : undefined,
                successful: successfulHeader ? Number.parseInt(successfulHeader, 10) : undefined,
            };

            // If no headers, assume all succeeded for 204, or check 207 status
            if (response.status === 204) {
                result.successful = ids.length;
                result.failed = 0;
            }

            return result;
        },
        onError: (error: Error) => {
            onError?.(error);
        },
        onSuccess: (result, ids) => {
            // Invalidate all file-related queries
            queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all(endpoint) });
            // Remove queries for deleted files
            ids.forEach((id) => {
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(endpoint, id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(endpoint, id) });
                queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(endpoint, id) });
            });
            onSuccess?.(result);
        },
    });

    return {
        batchDeleteFiles: mutation.mutateAsync,
        error: (mutation.error as Error) || undefined,
        isLoading: mutation.isPending,
        reset: mutation.reset,
    };
};
