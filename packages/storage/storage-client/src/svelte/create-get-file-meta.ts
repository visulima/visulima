import { createQuery } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, fromStore } from "svelte/store";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";
import toReadable from "./to-readable";

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

    const idStore: Readable<string> = typeof id === "object" && "subscribe" in id ? id : derived([], () => id);
    const enabledStore: Readable<boolean> = typeof enabled === "object" && "subscribe" in enabled ? enabled : derived([], () => enabled);

    const idState = fromStore(idStore);
    const enabledState = fromStore(enabledStore);

    const query = createQuery(() => {
        const currentId = idState.current;
        const currentEnabled = enabledState.current;

        return {
            enabled: currentEnabled && !!currentId,
            queryFn: async ({ signal }): Promise<FileMeta> => {
                const url = buildUrl(endpoint, `${currentId}/metadata`);
                const data = await fetchJson<FileMeta>(url, { signal });

                return {
                    ...data,
                    id: data.id || currentId,
                };
            },
            queryKey: storageQueryKeys.files.meta(endpoint, currentId),
        };
    });

    const dataStore = toReadable(() => query.data);
    const errorStore = derived(
        toReadable(() => query.error),
        ($error) => $error ?? undefined,
    );
    const isLoadingStore: Readable<boolean> = toReadable(() => query.isLoading);

    return {
        data: derived(dataStore, ($data) => $data ?? undefined),
        error: errorStore,
        isLoading: isLoadingStore,
        refetch: () => {
            query.refetch().catch(() => {});
        },
    };
};
