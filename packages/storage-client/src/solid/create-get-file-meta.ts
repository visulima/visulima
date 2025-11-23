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
    const { enabled = true, endpoint, id } = options;

    const idValue = typeof id === "function" ? id : () => id;
    const enabledValue = typeof enabled === "function" ? enabled : () => enabled;

    const query = createQuery(() => {
        return {
            enabled: enabledValue() && !!idValue(),
            queryFn: async (): Promise<FileMeta> => {
                const fileId = idValue();
                const url = buildUrl(endpoint, `${fileId}/metadata`);
                const data = await fetchJson<FileMeta>(url);

                return {
                    ...data,
                    id: data.id || fileId,
                };
            },
            queryKey: () => storageQueryKeys.files.meta(endpoint, idValue()),
        };
    });

    return {
        data: query.data,
        error: () => {
            const error = query.error();

            return (error as Error) || undefined;
        },
        isLoading: query.isLoading,
        refetch: () => {
            query.refetch();
        },
    };
};
