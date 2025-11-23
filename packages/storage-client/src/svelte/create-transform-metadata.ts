import { createQuery } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, get } from "svelte/store";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";

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

    const enabledStore: Readable<boolean> = typeof enabled === "object" && "subscribe" in enabled ? enabled : derived([], () => enabled as boolean);

    const query = createQuery(() => {
        const currentEnabled = get(enabledStore);

        return {
            enabled: currentEnabled,
            queryFn: async (): Promise<TransformMetadata> => {
                const url = buildUrl(endpoint, "metadata");
                const data = await fetchJson<TransformMetadata>(url);

                return {
                    formats: data.formats,
                    parameters: data.parameters,
                };
            },
            queryKey: storageQueryKeys.transform.metadata(),
        };
    });

    return {
        data: query.data,
        error: derived(query.error, ($error) => ($error as Error) || undefined),
        isLoading: query.isLoading,
        refetch: () => {
            query.refetch();
        },
    };
};
