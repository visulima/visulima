import { createMutation, useQueryClient } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

import { storageQueryKeys } from "../core";

export interface BatchDeleteResult {
    /** Number of files that failed to delete */
    failed?: number;
    /** Number of files successfully deleted */
    successful?: number;
}

export interface CreateBatchDeleteFilesOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
}

export interface CreateBatchDeleteFilesReturn {
    /** Delete multiple files by IDs */
    batchDeleteFiles: (ids: string[]) => Promise<BatchDeleteResult>;
    /** Last request error, if any */
    error: Accessor<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Accessor<boolean>;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * Solid.js primitive for batch deleting files using TanStack Query.
 * Supports both query parameter and JSON body methods.
 * Automatically invalidates related queries.
 * @param options Hook configuration options
 * @returns Batch file deletion functions and state signals
 */
export const createBatchDeleteFiles = (options: CreateBatchDeleteFilesOptions): CreateBatchDeleteFilesReturn => {
    const { endpoint } = options;
    const queryClient = useQueryClient();

    const mutation = createMutation(() => {
        return {
            mutationFn: async (ids: string[]): Promise<BatchDeleteResult> => {
                const url = new URL(endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint);

                url.searchParams.append("ids", ids.join(","));

                const response = await fetch(url.toString(), {
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
            onSuccess: (result, ids) => {
                // Invalidate all file-related queries
                queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all(endpoint) });
                // Remove queries for deleted files
                ids.forEach((id) => {
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(endpoint, id) });
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(endpoint, id) });
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(endpoint, id) });
                });
            },
        };
    });

    return {
        batchDeleteFiles: mutation.mutateAsync,
        error: () => {
            const error = typeof mutation.error === "function" ? mutation.error() : mutation.error;

            return (error as Error) || undefined;
        },
        isLoading: () => (typeof mutation.isPending === "function" ? mutation.isPending() : mutation.isPending) as boolean,
        reset: mutation.reset,
    };
};
