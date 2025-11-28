import { createQuery } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, get, readable } from "svelte/store";

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
            queryKey: storageQueryKeys.transform.metadata(endpoint),
        };
    });

    const dataStore = (query.data as Readable<TransformMetadata | undefined> | null) ?? readable<TransformMetadata | undefined>(undefined);
    const errorStore = (query.error as Readable<Error | null> | null) ?? readable<Error | null>(undefined);
    const isLoadingStore: Readable<boolean>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Query query type is complex
        = typeof (query.isLoading as any) === "object" && (query.isLoading as any) !== null && "subscribe" in (query.isLoading as any)
            ? (query.isLoading as unknown as Readable<boolean>)
            : readable<boolean>(false);

    return {
        data: derived(dataStore, ($data) => $data || undefined),
        error: derived(errorStore, ($error) => $error ? ($error as Error) : undefined),
        isLoading: isLoadingStore,
        refetch: () => {
            query.refetch();
        },
    };
};
