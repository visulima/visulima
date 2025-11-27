import { createQuery } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, get, readable } from "svelte/store";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

export interface CreateGetFileMetaOptions {
    /** Whether to enable the query */
    enabled?: Readable<boolean> | boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch metadata for */
    id: Readable<string> | string;
}

export interface CreateGetFileMetaReturn {
    /** File metadata */
    data: Readable<FileMeta | undefined>;
    /** Last request error, if any */
    error: Readable<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** Refetch the file metadata */
    refetch: () => void;
}

/**
 * Svelte store-based utility for fetching file metadata using TanStack Query.
 * @param options Hook configuration options
 * @returns File metadata fetching functions and state stores
 */
export const createGetFileMeta = (options: CreateGetFileMetaOptions): CreateGetFileMetaReturn => {
    const { enabled = true, endpoint, id } = options;

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
            queryKey: storageQueryKeys.files.meta(endpoint, currentId),
        };
    });

    const dataStore = (query.data as unknown as Readable<FileMeta | undefined> | null) ?? readable<FileMeta | undefined>(undefined);
    const errorStore = derived((query.error as unknown as Readable<Error | null> | null) ?? readable<Error | null>(null), ($error) =>
        ($error ? ($error as Error) : undefined),
    );
    const isLoadingStore: Readable<boolean>
        = typeof (query.isLoading as any) === "object" && (query.isLoading as any) !== null && "subscribe" in (query.isLoading as any)
            ? (query.isLoading as unknown as Readable<boolean>)
            : readable<boolean>(false);

    return {
        data: derived(dataStore, ($data) => $data || undefined),
        error: errorStore,
        isLoading: isLoadingStore,
        refetch: () => {
            query.refetch();
        },
    };
};
