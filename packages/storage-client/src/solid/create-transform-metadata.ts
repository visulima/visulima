import { createQuery } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

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
    enabled?: Accessor<boolean> | boolean;
}

export interface CreateTransformMetadataReturn {
    /** Last request error, if any */
    error: Accessor<Error | null>;
    /** Whether a request is currently in progress */
    isLoading: Accessor<boolean>;
    /** Transform metadata */
    data: Accessor<TransformMetadata | undefined>;
    /** Refetch the transform metadata */
    refetch: () => void;
}

/**
 * Solid.js primitive for fetching transformation metadata using TanStack Query
 * Returns available formats and transformation parameters
 * @param options Hook configuration options
 * @returns Transform metadata fetching functions and state signals
 */
export const createTransformMetadata = (options: CreateTransformMetadataOptions): CreateTransformMetadataReturn => {
    const { endpoint, enabled = true } = options;

    const enabledValue = typeof enabled === "function" ? enabled : () => enabled;

    const query = createQuery(() => ({
        enabled: enabledValue(),
        queryFn: async (): Promise<TransformMetadata> => {
            const url = buildUrl(endpoint, "metadata");
            const data = await fetchJson<TransformMetadata>(url);

            return {
                formats: data.formats,
                parameters: data.parameters,
            };
        },
        queryKey: () => storageQueryKeys.transform.metadata(),
    }));

    return {
        data: query.data,
        error: () => {
            const err = query.error();
            return (err as Error) || null;
        },
        isLoading: query.isLoading,
        refetch: () => {
            query.refetch();
        },
    };
};

