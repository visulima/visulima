import { useQuery } from "@tanstack/vue-query";
import type { MaybeRefOrGetter, Ref } from "vue";
import { computed, toValue } from "vue";

import { buildUrl, extractFileMetaFromHeaders, storageQueryKeys } from "../core";
import type { FileMeta } from "../react/types";

export interface TransformOptions {
    /** Additional transformation parameters */
    [key: string]: string | number | boolean | undefined;
    /** Resize fit mode */
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    /** Output format (jpeg, png, webp, etc.) */
    format?: string;
    /** Desired height in pixels */
    height?: number;
    /** Quality setting (0-100) */
    quality?: number;
    /** Desired width in pixels */
    width?: number;
}

export interface UseTransformFileOptions {
    /** Whether to enable the query */
    enabled?: MaybeRefOrGetter<boolean>;
    /** Base endpoint URL for transform operations */
    endpoint: string;
    /** File ID to transform */
    id: MaybeRefOrGetter<string>;
    /** Transformation parameters */
    transform: MaybeRefOrGetter<TransformOptions>;
}

export interface UseTransformFileReturn {
    /** Transformed file data as Blob */
    data: Readonly<Ref<Blob | undefined>>;
    /** Last request error, if any */
    error: Readonly<Ref<Error | undefined>>;
    /** Whether a request is currently in progress */
    isLoading: Readonly<Ref<boolean>>;
    /** File metadata from response headers */
    meta: Readonly<Ref<FileMeta | undefined>>;
    /** Refetch the transformed file */
    refetch: () => void;
}

/**
 * Vue composable for fetching transformed files using TanStack Query.
 * Supports image, video, and audio transformation parameters.
 * @param options Hook configuration options
 * @returns Transform file fetching functions and state
 */
export const useTransformFile = (options: UseTransformFileOptions): UseTransformFileReturn => {
    const { enabled = true, endpoint, id, transform } = options;

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
                const errorData = (await response.json().catch(() => {
                    return {
                        error: {
                            code: "RequestFailed",
                            message: response.statusText,
                        },
                    };
                })) as { error: { code: string; message: string } };

                throw new Error(errorData.error?.message || `Failed to get transformed file: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            const meta = extractFileMetaFromHeaders(fileId, response.headers);

            return { blob, meta };
        },
        queryKey: computed(() => {
            const transformValue = toValue(transform);
            const fileId = toValue(id);
            const filteredTransform = Object.fromEntries(Object.entries(transformValue).filter(([, value]) => value !== undefined)) as Record<
                string,
                string | number | boolean
            >;

            return storageQueryKeys.transform.file(endpoint, fileId, filteredTransform);
        }),
    });

    return {
        data: computed(() => query.data.value?.blob),
        error: computed(() => (query.error.value as Error) || undefined),
        isLoading: computed(() => query.isLoading.value),
        meta: computed(() => query.data.value?.meta || undefined),
        refetch: () => {
            query.refetch();
        },
    };
};
