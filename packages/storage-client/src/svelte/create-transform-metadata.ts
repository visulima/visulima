import { createQuery } from "@tanstack/svelte-query";
import { derived, get, type Readable } from "svelte/store";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";

export interface TransformMetadata {
    /** Available transformation formats */
    formats?: string[];
    /** Supported transformation parameters */
    parameters?: string[];
}

export interface CreateTransformMetadataOptions {
    /** Base endpoint URL for transform operations */
    endpoint: string;
    /** Whether to enable the query */
    enabled?: Readable<boolean> | boolean;
}

export interface CreateTransformMetadataReturn {
    /** Last request error, if any */
    error: Readable<Error | null>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** Transform metadata */
    data: Readable<TransformMetadata | undefined>;
    /** Refetch the transform metadata */
    refetch: () => void;
}

/**
 * Svelte store-based utility for fetching transformation metadata using TanStack Query
 * Returns available formats and transformation parameters
 * @param options Hook configuration options
 * @returns Transform metadata fetching functions and state stores
 */
export const createTransformMetadata = (options: CreateTransformMetadataOptions): CreateTransformMetadataReturn => {
    const { endpoint, enabled = true } = options;

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
        error: derived(query.error, ($error) => ($error as Error) || null),
        isLoading: query.isLoading,
        refetch: () => {
            query.refetch();
        },
    };
};

