import { QueryClient, createQuery } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

import { buildUrl, extractFileMetaFromHeaders, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

export interface CreateGetFileOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch */
    id: Accessor<string> | string;
    /** Transformation parameters for media files */
    transform?: Accessor<Record<string, string | number | boolean> | undefined> | Record<string, string | number | boolean>;
    /** Whether to enable the query */
    enabled?: Accessor<boolean> | boolean;
    /** Optional QueryClient to use */
    queryClient?: QueryClient;
}

export interface CreateGetFileReturn {
    /** Last request error, if any */
    error: Accessor<Error | null>;
    /** Whether a request is currently in progress */
    isLoading: Accessor<boolean>;
    /** File data as Blob */
    data: Accessor<Blob | undefined>;
    /** File metadata from response headers */
    meta: Accessor<FileMeta | null>;
    /** Refetch the file */
    refetch: () => void;
}

/**
 * Solid.js primitive for fetching/downloading files using TanStack Query
 * Supports optional transformation parameters for media files
 * @param options Hook configuration options
 * @returns File fetching functions and state signals
 */
export const createGetFile = (options: CreateGetFileOptions): CreateGetFileReturn => {
    const { endpoint, id, transform, enabled = true, queryClient } = options;

    const idValue = typeof id === "function" ? id : () => id;
    const transformValue = typeof transform === "function" ? transform : () => transform;
    const enabledValue = typeof enabled === "function" ? enabled : () => enabled;

    const query = createQuery(
        () => {
            const fileId = idValue();
            const transformParams = transformValue();

            return {
                enabled: enabledValue() && !!fileId,
                queryFn: async () => {
                    const url = buildUrl(endpoint, fileId, transformParams);
                    const response = await fetch(url, {
                        method: "GET",
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({
                            error: {
                                code: "RequestFailed",
                                message: response.statusText,
                            },
                        }));

                        throw new Error(errorData.error?.message || `Failed to get file: ${response.status} ${response.statusText}`);
                    }

                    const blob = await response.blob();
                    const meta = extractFileMetaFromHeaders(fileId, response.headers);

                    return { blob, meta };
                },
                queryKey: storageQueryKeys.files.detail(fileId, transformParams),
            };
        },
        () => queryClient,
    );

    return {
        data: () => query.data?.blob,
        error: () => {
            const err = query.error;
            return (err as Error) || null;
        },
        isLoading: () => query.isLoading,
        meta: () => query.data?.meta || null,
        refetch: () => {
            query.refetch();
        },
    };
};
