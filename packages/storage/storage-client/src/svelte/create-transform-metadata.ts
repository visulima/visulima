import { createQuery } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, fromStore } from "svelte/store";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";
import toReadable from "./to-readable";

export interface TransformMetadata {
    /** Available transformation formats */
    formats?: string[];
    /** Supported transformation parameters */
    parameters?: string[];
}

export interface CreateTransformMetadataOptions {
    /** Whether to enable the query */
    enabled?: Readable<boolean> | boolean;
    /** Base endpoint URL for transform operations */
    endpoint: string;
}

export interface CreateTransformMetadataReturn {
    /** Transform metadata */
    data: Readable<TransformMetadata | undefined>;
    /** Last request error, if any */
    error: Readable<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** Refetch the transform metadata */
    refetch: () => void;
}

/**
 * Svelte store-based utility for fetching transformation metadata using TanStack Query.
 * Returns available formats and transformation parameters.
 * @param options Hook configuration options
 * @returns Transform metadata fetching functions and state stores
 */
export const createTransformMetadata = (options: CreateTransformMetadataOptions): CreateTransformMetadataReturn => {
    const { enabled = true, endpoint } = options;

    const enabledStore: Readable<boolean> = typeof enabled === "object" && "subscribe" in enabled ? enabled : derived([], () => enabled);

    const enabledState = fromStore(enabledStore);

    const query = createQuery(() => {
        const currentEnabled = enabledState.current;

        return {
            enabled: currentEnabled,
            queryFn: async ({ signal }): Promise<TransformMetadata> => {
                const url = buildUrl(endpoint, "metadata");
                const data = await fetchJson<TransformMetadata>(url, { signal });

                return {
                    formats: data.formats,
                    parameters: data.parameters,
                };
            },
            queryKey: storageQueryKeys.transform.metadata(endpoint),
        };
    });

    const dataStore = toReadable(() => query.data);
    const errorStore = toReadable(() => query.error);
    const isLoadingStore: Readable<boolean> = toReadable(() => query.isLoading);

    return {
        data: derived(dataStore, ($data) => $data ?? undefined),
        error: derived(errorStore, ($error) => $error ?? undefined),
        isLoading: isLoadingStore,
        refetch: () => {
            query.refetch().catch(() => {});
        },
    };
};
