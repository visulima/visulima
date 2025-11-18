import { useQuery } from "@tanstack/vue-query";
import type { MaybeRefOrGetter } from "vue";
import { computed, toValue } from "vue";

import { buildUrl, fetchJson, storageQueryKeys } from "../core";

export interface TransformMetadata {
    /** Available transformation formats */
    formats?: string[];
    /** Supported transformation parameters */
    parameters?: string[];
}

export interface UseTransformMetadataOptions {
    /** Base endpoint URL for transform operations */
    endpoint: string;
    /** Whether to enable the query */
    enabled?: MaybeRefOrGetter<boolean>;
}

export interface UseTransformMetadataReturn {
    /** Last request error, if any */
    error: Readonly<Ref<Error | null>>;
    /** Whether a request is currently in progress */
    isLoading: Readonly<Ref<boolean>>;
    /** Transform metadata */
    data: Readonly<Ref<TransformMetadata | undefined>>;
    /** Refetch the transform metadata */
    refetch: () => void;
}

/**
 * Vue composable for fetching transformation metadata using TanStack Query
 * Returns available formats and transformation parameters
 * @param options Hook configuration options
 * @returns Transform metadata fetching functions and state
 */
export const useTransformMetadata = (options: UseTransformMetadataOptions): UseTransformMetadataReturn => {
    const { endpoint, enabled = true } = options;

    const query = useQuery({
        enabled: computed(() => toValue(enabled)),
        queryFn: async (): Promise<TransformMetadata> => {
            const url = buildUrl(endpoint, "metadata");
            const data = await fetchJson<TransformMetadata>(url);

            return {
                formats: data.formats,
                parameters: data.parameters,
            };
        },
        queryKey: computed(() => storageQueryKeys.transform.metadata()),
    });

    return {
        data: query.data,
        error: computed(() => (query.error.value as Error) || null),
        isLoading: computed(() => query.isLoading.value),
        refetch: () => {
            query.refetch();
        },
    };
};

