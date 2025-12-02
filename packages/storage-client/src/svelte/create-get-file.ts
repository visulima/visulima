import { createQuery } from "@tanstack/svelte-query";
import { onDestroy } from "svelte";
import type { Readable } from "svelte/store";
import { derived, get, readable } from "svelte/store";

import { buildUrl, extractFileMetaFromHeaders, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

type TransformParams = Record<string, string | number | boolean> | undefined;

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
    /** Transformation parameters for media files */
    transform?: Readable<TransformParams> | TransformParams;
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
 *
 * IMPORTANT: Due to TanStack Query Svelte requirements, createQuery must be called
 * at the component's top level, not inside utility functions. For proper usage, call
 * createQuery directly in your component and use the returned stores.
 * @param options Hook configuration options
 * @returns File fetching functions and state stores
 */
export const createGetFile = (options: CreateGetFileOptions): CreateGetFileReturn => {
    const { enabled = true, endpoint, id, onError, onSuccess, transform } = options;

    // Convert to stores if needed
    const idStore: Readable<string> = typeof id === "object" && "subscribe" in id ? id : derived([], () => id as string);
    const transformStore: Readable<Record<string, string | number | boolean> | undefined>
        = typeof transform === "object" && "subscribe" in transform
            ? (transform as Readable<Record<string, string | number | boolean> | undefined>)
            : derived([], () => transform);
    const enabledStore: Readable<boolean> = typeof enabled === "object" && "subscribe" in enabled ? enabled : derived([], () => enabled as boolean);

    // Create derived stores for reactive query options
    const enabledDerived = derived([enabledStore, idStore], ([$enabled, $id]) => $enabled && !!$id);

    // According to TanStack Svelte Query docs, when inside QueryClientProvider,
    // createQuery automatically uses context - no need to pass queryClient parameter
    // Calling useQueryClient() above ensures context is available
    const query = createQuery(() => {
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
                    const errorData = (await response.json().catch(() => {
                        return {
                            error: {
                                code: "RequestFailed",
                                message: response.statusText,
                            },
                        };
                    })) as { error: { code: string; message: string } };

                    throw new Error(errorData.error?.message || `Failed to get file: ${response.status} ${response.statusText}`);
                }

                const blob = await response.blob();
                const meta = extractFileMetaFromHeaders(currentId, response.headers);

                return { blob, meta };
            },
            queryKey: (() => {
                const filteredTransform = currentTransform
                    ? (Object.fromEntries(Object.entries(currentTransform).filter(([, value]) => value !== undefined)) as Record<
                        string,
                          string | number | boolean
                    >)
                    : undefined;

                return storageQueryKeys.files.detail(endpoint, currentId, filteredTransform);
            })(),
        };
    });

    const queryDataStore
        = (query.data as unknown as Readable<{ blob: Blob; meta: FileMeta } | undefined> | null)
            ?? readable<{ blob: Blob; meta: FileMeta } | undefined>(undefined);
    const queryErrorStore = (query.error as unknown as Readable<Error | null> | null) ?? readable<Error | null>(undefined);
    const queryIsLoadingStore: Readable<boolean>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Query query type is complex
        = typeof (query.isLoading as any) === "object" && (query.isLoading as any) !== null && "subscribe" in (query.isLoading as any)
            ? (query.isLoading as unknown as Readable<boolean>)
            : readable<boolean>(false);

    // Extract metadata from response if available
    const meta = derived(queryDataStore, ($data) => $data?.meta || undefined);

    // Subscribe to data and error changes to call callbacks
    let unsubscribeData: (() => void) | undefined;
    let unsubscribeError: (() => void) | undefined;

    if (onSuccess || onError) {
        unsubscribeData = queryDataStore.subscribe(($data: { blob: Blob; meta: FileMeta } | undefined) => {
            if ($data && onSuccess) {
                const currentMeta = get(meta);

                onSuccess($data.blob, currentMeta);
            }
        });

        unsubscribeError = queryErrorStore.subscribe(($error: Error | null) => {
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
        data: derived(queryDataStore, ($data) => $data?.blob),
        error: derived(queryErrorStore, ($error) => ($error ? ($error as Error) : undefined)),
        isLoading: queryIsLoadingStore,
        meta,
        refetch: () => {
            query.refetch();
        },
    };
};
