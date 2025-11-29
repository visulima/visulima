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
            try {
                const dataValue = (query as { data?: Accessor<TransformMetadata | undefined> | TransformMetadata | undefined }).data;

                if (typeof dataValue === "function") {
                    return dataValue() as TransformMetadata | undefined;
                }

                return dataValue as TransformMetadata | undefined;
            } catch {
                return undefined;
            }
        },
        error: () => {
            try {
                const errorValue = (query as { error?: Accessor<Error | undefined> | Error | undefined }).error;
                const error = typeof errorValue === "function" ? errorValue() : errorValue;

                return (error as Error) || undefined;
            } catch {
                return undefined;
            }
        },
        isLoading: () => {
            try {
                const isLoadingValue = (query as { isLoading?: Accessor<boolean> | boolean }).isLoading;

                return (typeof isLoadingValue === "function" ? isLoadingValue() : isLoadingValue) as boolean;
            } catch {
                return false;
            }
        },
        refetch: () => {
            query.refetch();
        },
    };
};
