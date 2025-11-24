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
    /** Whether to enable the query */
    enabled?: Accessor<boolean> | boolean;
    /** Base endpoint URL for transform operations */
    endpoint: string;
}

export interface CreateTransformMetadataReturn {
    /** Transform metadata */
    data: Accessor<TransformMetadata | undefined>;
    /** Last request error, if any */
    error: Accessor<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Accessor<boolean>;
    /** Refetch the transform metadata */
    refetch: () => void;
}

/**
 * Solid.js primitive for fetching transformation metadata using TanStack Query.
 * Returns available formats and transformation parameters.
 * @param options Hook configuration options
 * @returns Transform metadata fetching functions and state signals
 */
export const createTransformMetadata = (options: CreateTransformMetadataOptions): CreateTransformMetadataReturn => {
    const { enabled = true, endpoint } = options;

    const enabledValue = typeof enabled === "function" ? enabled : () => enabled;

    const query = createQuery(() => {
        return {
            enabled: enabledValue(),
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

    return {
        data: () => {
            if (typeof query.data === "function") {
                return query.data() as TransformMetadata | undefined;
            }

            return query.data as TransformMetadata | undefined;
        },
        error: () => {
            const error = typeof query.error === "function" ? query.error() : query.error;

            return (error as Error) || undefined;
        },
        isLoading: () => (typeof query.isLoading === "function" ? query.isLoading() : query.isLoading) as boolean,
        refetch: () => {
            query.refetch();
        },
    };
};
