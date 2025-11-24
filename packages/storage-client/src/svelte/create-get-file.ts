import type { QueryClient } from "@tanstack/svelte-query";
import { createQuery } from "@tanstack/svelte-query";
import { onDestroy } from "svelte";
import type { Readable } from "svelte/store";
import { derived, get, readable } from "svelte/store";

import { buildUrl, extractFileMetaFromHeaders, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

export interface CreateGetFileOptions {
    /** Whether to enable the query */
    enabled?: Readable<boolean> | boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch */
    id: Readable<string> | string;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: (data: Blob, meta: FileMeta | undefined) => void;
    /** Optional QueryClient to use */
    queryClient?: QueryClient;
    /** Transformation parameters for media files */
    transform?: Readable<Record<string, string | number | boolean> | undefined> | Record<string, string | number | boolean>;
}

export interface CreateGetFileReturn {
    /** File data as Blob */
    data: Readable<Blob | undefined>;
    /** Last request error, if any */
    error: Readable<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** File metadata from response headers */
    meta: Readable<FileMeta | undefined>;
    /** Refetch the file */
    refetch: () => void;
}

/**
 * Svelte store-based utility for fetching/downloading files using TanStack Query.
 * Supports optional transformation parameters for media files.
 * @param options Hook configuration options
 * @returns File fetching functions and state stores
 */
export const createGetFile = (options: CreateGetFileOptions): CreateGetFileReturn => {
    const { enabled = true, endpoint, id, onError, onSuccess, queryClient, transform } = options;

    // Convert to stores if needed
    const idStore: Readable<string> = typeof id === "object" && "subscribe" in id ? id : derived([], () => id as string);
    const transformStore: Readable<Record<string, string | number | boolean> | undefined>
        = typeof transform === "object" && "subscribe" in transform ? transform : derived([], () => transform);
    const enabledStore: Readable<boolean> = typeof enabled === "object" && "subscribe" in enabled ? enabled : derived([], () => enabled as boolean);

    // Create derived stores for reactive query options
    const enabledDerived = derived([enabledStore, idStore], ([$enabled, $id]) => $enabled && !!$id);

    const query = createQuery(
        () => {
            const currentId = get(idStore);
            const currentTransform = get(transformStore);

            return {
                enabled: get(enabledDerived),
                queryFn: async () => {
                    const url = buildUrl(endpoint, currentId, currentTransform);
                    const response = await fetch(url, {
                        method: "GET",
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

                        throw new Error(errorData.error?.message || `Failed to get file: ${response.status} ${response.statusText}`);
                    }

                    const blob = await response.blob();
                    const meta = extractFileMetaFromHeaders(currentId, response.headers);

                    return { blob, meta };
                },
                queryKey: storageQueryKeys.files.detail(endpoint, currentId, currentTransform),
            };
        },
        queryClient ? () => queryClient : undefined,
    );

    // Ensure stores are always defined
    const dataStore = query?.data ?? readable(undefined);
    const errorStore = query?.error ?? readable(undefined);
    const isLoadingStore = query?.isLoading ?? readable(false);

    // Extract metadata from response if available
    const meta = derived(dataStore, ($data) => $data?.meta || undefined);

    // Subscribe to data and error changes to call callbacks
    let unsubscribeData: (() => void) | undefined;
    let unsubscribeError: (() => void) | undefined;

    if (onSuccess || onError) {
        unsubscribeData = dataStore.subscribe(($data) => {
            if ($data && onSuccess) {
                const currentMeta = get(meta);

                onSuccess($data.blob, currentMeta);
            }
        });

        unsubscribeError = errorStore.subscribe(($error) => {
            if ($error && onError) {
                onError($error as Error);
            }
        });

        onDestroy(() => {
            unsubscribeData?.();
            unsubscribeError?.();
        });
    }

    return {
        data: derived(dataStore, ($data) => $data?.blob),
        error: derived(errorStore, ($error) => ($error as Error) || undefined),
        isLoading: isLoadingStore,
        meta,
        refetch: () => {
            query?.refetch();
        },
    };
};
