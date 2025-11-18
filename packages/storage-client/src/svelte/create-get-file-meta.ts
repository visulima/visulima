import { createQuery } from "@tanstack/svelte-query";
import { derived, get, type Readable } from "svelte/store";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

export interface CreateGetFileMetaOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch metadata for */
    id: Readable<string> | string;
    /** Whether to enable the query */
    enabled?: Readable<boolean> | boolean;
}

export interface CreateGetFileMetaReturn {
    /** Last request error, if any */
    error: Readable<Error | null>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** File metadata */
    data: Readable<FileMeta | undefined>;
    /** Refetch the file metadata */
    refetch: () => void;
}

/**
 * Svelte store-based utility for fetching file metadata using TanStack Query
 * @param options Hook configuration options
 * @returns File metadata fetching functions and state stores
 */
export const createGetFileMeta = (options: CreateGetFileMetaOptions): CreateGetFileMetaReturn => {
    const { endpoint, id, enabled = true } = options;

    const idStore: Readable<string> = typeof id === "object" && "subscribe" in id ? id : derived([], () => id as string);
    const enabledStore: Readable<boolean> = typeof enabled === "object" && "subscribe" in enabled ? enabled : derived([], () => enabled as boolean);

    const query = createQuery(() => {
        const currentId = get(idStore);
        const currentEnabled = get(enabledStore);

        return {
            enabled: currentEnabled && !!currentId,
            queryFn: async (): Promise<FileMeta> => {
                const url = buildUrl(endpoint, `${currentId}/metadata`);
                const data = await fetchJson<FileMeta>(url);

                return {
                    ...data,
                    id: data.id || currentId,
                };
            },
            queryKey: storageQueryKeys.files.meta(currentId),
        };
    });

    return {
        data: query.data,
        error: derived(query.error, ($error) => ($error as Error) || null),
        isLoading: query.isLoading,
        refetch: () => {
            query.refetch();
        },
    };
};

