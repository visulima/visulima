import type { QueryClient } from "@tanstack/solid-query";
import { createQuery } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

export interface CreateGetFileMetaOptions {
    /** Whether to enable the query */
    enabled?: Accessor<boolean> | boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch metadata for */
    id: Accessor<string> | string;
    /** Optional QueryClient to use */
    queryClient?: QueryClient;
}

export interface CreateGetFileMetaReturn {
    /** File metadata */
    data: Accessor<FileMeta | undefined>;
    /** Last request error, if any */
    error: Accessor<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Accessor<boolean>;
    /** Refetch the file metadata */
    refetch: () => void;
}

/**
 * Solid.js primitive for fetching file metadata using TanStack Query.
 * @param options Hook configuration options
 * @returns File metadata fetching functions and state signals
 */
export const createGetFileMeta = (options: CreateGetFileMetaOptions): CreateGetFileMetaReturn => {
    const { enabled = true, endpoint, id, queryClient } = options;

    const idValue = typeof id === "function" ? id : () => id;
    const enabledValue = typeof enabled === "function" ? enabled : () => enabled;

    const query = createQuery(
        () => {
            const fileId = idValue();
            const enabled = enabledValue() && !!fileId;

            const queryKey = storageQueryKeys.files.meta(endpoint, fileId);

            return {
                enabled,
                queryFn: async (): Promise<FileMeta> => {
                    const url = buildUrl(endpoint, `${fileId}/metadata`);
                    const data = await fetchJson<FileMeta>(url);

                    return {
                        ...data,
                        id: data.id || fileId,
                    };
                },
                queryKey,
            };
        },
        queryClient ? () => queryClient : undefined,
    );

    return {
        data: () => {
            try {
                const dataValue = (query as any).data;

                if (typeof dataValue === "function") {
                    return dataValue() as FileMeta | undefined;
                }

                return dataValue as FileMeta | undefined;
            } catch {
                return undefined;
            }
        },
        error: () => {
            try {
                const errorValue = (query as any).error;
                const error = typeof errorValue === "function" ? errorValue() : errorValue;

                return (error as Error) || undefined;
            } catch {
                return undefined;
            }
        },
        isLoading: () => {
            try {
                const isLoadingValue = (query as any).isLoading;

                return (typeof isLoadingValue === "function" ? isLoadingValue() : isLoadingValue) as boolean;
            } catch {
                return false;
            }
        },
        refetch: () => {
            query.refetch();
        },
    };
};
