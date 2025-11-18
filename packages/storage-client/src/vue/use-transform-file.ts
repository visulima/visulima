import { useQuery } from "@tanstack/vue-query";
import type { MaybeRefOrGetter } from "vue";
import { computed, toValue } from "vue";

import { buildUrl, extractFileMetaFromHeaders, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

export interface TransformOptions {
    /** Output format (jpeg, png, webp, etc.) */
    format?: string;
    /** Quality setting (0-100) */
    quality?: number;
    /** Desired width in pixels */
    width?: number;
    /** Desired height in pixels */
    height?: number;
    /** Resize fit mode */
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    /** Additional transformation parameters */
    [key: string]: string | number | boolean | undefined;
}

export interface UseTransformFileOptions {
    /** Base endpoint URL for transform operations */
    endpoint: string;
    /** File ID to transform */
    id: MaybeRefOrGetter<string>;
    /** Transformation parameters */
    transform: MaybeRefOrGetter<TransformOptions>;
    /** Whether to enable the query */
    enabled?: MaybeRefOrGetter<boolean>;
}

export interface UseTransformFileReturn {
    /** Last request error, if any */
    error: Readonly<Ref<Error | null>>;
    /** Whether a request is currently in progress */
    isLoading: Readonly<Ref<boolean>>;
    /** Transformed file data as Blob */
    data: Readonly<Ref<Blob | undefined>>;
    /** File metadata from response headers */
    meta: Readonly<Ref<FileMeta | null>>;
    /** Refetch the transformed file */
    refetch: () => void;
}

/**
 * Vue composable for fetching transformed files using TanStack Query
 * Supports image, video, and audio transformation parameters
 * @param options Hook configuration options
 * @returns Transform file fetching functions and state
 */
export const useTransformFile = (options: UseTransformFileOptions): UseTransformFileReturn => {
    const { endpoint, id, transform, enabled = true } = options;

    const query = useQuery({
        enabled: computed(() => toValue(enabled) && !!toValue(id) && !!toValue(transform)),
        queryFn: async () => {
            const fileId = toValue(id);
            const transformParams = toValue(transform);
            const url = buildUrl(endpoint, fileId, transformParams);
            const response = await fetch(url, {
                method: "GET",
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    error: {
                        code: "RequestFailed",
                        message: response.statusText,
                    },
                }));

                throw new Error(errorData.error?.message || `Failed to get transformed file: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            const meta = extractFileMetaFromHeaders(fileId, response.headers);

            return { blob, meta };
        },
        queryKey: computed(() => storageQueryKeys.transform.file(toValue(id), toValue(transform))),
    });

    return {
        data: computed(() => query.data.value?.blob),
        error: computed(() => (query.error.value as Error) || null),
        isLoading: computed(() => query.isLoading.value),
        meta: computed(() => query.data.value?.meta || null),
        refetch: () => {
            query.refetch();
        },
    };
};

