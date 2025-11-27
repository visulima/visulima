import { createMutation, useQueryClient } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, readable } from "svelte/store";

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
    error: Readable<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** Reset mutation state */
    reset: () => void;
}

/**
 * Svelte store-based utility for batch deleting files using TanStack Query.
 * Supports both query parameter and JSON body methods.
 * Automatically invalidates related queries.
 * @param options Hook configuration options
 * @returns Batch file deletion functions and state stores
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
                    const errorData = (await response.json().catch(() => {
                        return {
                            error: {
                                code: "RequestFailed",
                                message: response.statusText,
                            },
                        };
                    })) as { error: { code: string; message: string } };

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
            onSuccess: (_result, ids) => {
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

    const errorStore = derived((mutation.error as Readable<Error | null> | null) ?? readable<Error | null>(null), ($error) =>
        ($error ? ($error as Error) : undefined),
    );
    const isLoadingStore: Readable<boolean>
        = typeof (mutation.isPending as any) === "object" && (mutation.isPending as any) !== null && "subscribe" in (mutation.isPending as any)
            ? (mutation.isPending as unknown as Readable<boolean>)
            : readable<boolean>(false);

    return {
        batchDeleteFiles: mutation.mutateAsync,
        error: errorStore,
        isLoading: isLoadingStore,
        reset: mutation.reset,
    };
};
