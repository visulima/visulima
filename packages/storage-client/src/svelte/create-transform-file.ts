import { createQuery } from "@tanstack/svelte-query";
import type { Readable } from "svelte/store";
import { derived, get } from "svelte/store";

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

export interface CreateTransformFileOptions {
    /** Whether to enable the query */
    enabled?: Readable<boolean> | boolean;
    /** Base endpoint URL for transform operations */
    endpoint: string;
    /** File ID to transform */
    id: Readable<string> | string;
    /** Transformation parameters */
    transform: Readable<TransformOptions> | TransformOptions;
}

export interface CreateTransformFileReturn {
    /** Transformed file data as Blob */
    data: Readable<Blob | undefined>;
    /** Last request error, if any */
    error: Readable<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** File metadata from response headers */
    meta: Readable<FileMeta | undefined>;
    /** Refetch the transformed file */
    refetch: () => void;
}

/**
 * Svelte store-based utility for fetching transformed files using TanStack Query.
 * Supports image, video, and audio transformation parameters.
 * @param options Hook configuration options
 * @returns Transform file fetching functions and state stores
 */
export const createTransformFile = (options: CreateTransformFileOptions): CreateTransformFileReturn => {
    const { enabled = true, endpoint, id, transform } = options;

    const idStore: Readable<string> = typeof id === "object" && "subscribe" in id ? id : derived([], () => id as string);
    const transformStore: Readable<TransformOptions>
        = typeof transform === "object" && "subscribe" in transform ? transform : derived([], () => transform as TransformOptions);
    const enabledStore: Readable<boolean> = typeof enabled === "object" && "subscribe" in enabled ? enabled : derived([], () => enabled as boolean);

    const query = createQuery(() => {
        const currentId = get(idStore);
        const currentTransform = get(transformStore);
        const currentEnabled = get(enabledStore);

        return {
            enabled: currentEnabled && !!currentId && !!currentTransform,
            queryFn: async () => {
                const url = buildUrl(endpoint, currentId, currentTransform);
                const response = await fetch(url, {
                    method: "GET",
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => {
                        return {
                            error: {
                                code: "RequestFailed",
                                message: response.statusText,
                            },
                        };
                    });

                    throw new Error(errorData.error?.message || `Failed to get transformed file: ${response.status} ${response.statusText}`);
                }

                const blob = await response.blob();
                const meta = extractFileMetaFromHeaders(currentId, response.headers);

                return { blob, meta };
            },
            queryKey: storageQueryKeys.transform.file(currentId, currentTransform),
        };
    });

    return {
        data: derived(query.data, ($data) => $data?.blob),
        error: derived(query.error, ($error) => ($error as Error) || undefined),
        isLoading: query.isLoading,
        meta: derived(query.data, ($data) => $data?.meta || undefined),
        refetch: () => {
            query.refetch();
        },
    };
};
