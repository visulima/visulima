import { createQuery } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, get, readable } from "svelte/store";

import type { FileHeadMetadata } from "../core";
import { buildUrl, extractHeadMetadataFromHeaders, fetchHead, storageQueryKeys } from "../core";

export interface CreateHeadFileOptions {
    /** Whether to enable the query */
    enabled?: Readable<boolean> | boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch metadata for */
    id: Readable<string> | string;
}

export interface CreateHeadFileReturn {
    /** File metadata from HEAD request */
    data: Readable<FileHeadMetadata | undefined>;
    /** Last request error, if any */
    error: Readable<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** Refetch the file metadata */
    refetch: () => void;
}

/**
 * Svelte store-based utility for fetching file metadata via HEAD request using TanStack Query.
 * Useful for checking upload progress and file status without downloading.
 * @param options Hook configuration options
 * @returns File HEAD request functions and state stores
 */
export const createHeadFile = (options: CreateHeadFileOptions): CreateHeadFileReturn => {
    const { enabled = true, endpoint, id } = options;

    const idStore: Readable<string> = typeof id === "object" && "subscribe" in id ? id : derived([], () => id);
    const enabledStore: Readable<boolean> = typeof enabled === "object" && "subscribe" in enabled ? enabled : derived([], () => enabled);

    const query = createQuery(() => {
        const currentId = get(idStore);
        const currentEnabled = get(enabledStore);

        return {
            enabled: currentEnabled && !!currentId,
            queryFn: async ({ signal }): Promise<FileHeadMetadata> => {
                const url = buildUrl(endpoint, currentId);

                return extractHeadMetadataFromHeaders(await fetchHead(url, { signal }));
            },
            queryKey: storageQueryKeys.files.head(endpoint, currentId),
        };
    });

    const dataStore = (query.data as unknown as Readable<FileHeadMetadata | undefined> | null) ?? readable<FileHeadMetadata | undefined>();
    const errorStore = (query.error as unknown as Readable<Error | null> | null) ?? readable<Error | null>();
    const isLoadingStore: Readable<boolean> =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Query query type is complex
        typeof (query.isLoading as any) === "object" && (query.isLoading as any) !== null && "subscribe" in (query.isLoading as any)
            ? (query.isLoading as unknown as Readable<boolean>)
            : readable(false);

    return {
        data: derived(dataStore, ($data) => $data ?? undefined),
        error: derived(errorStore, ($error) => $error ?? undefined),
        isLoading: isLoadingStore,
        refetch: () => {
            query.refetch().catch(() => {});
        },
    };
};
