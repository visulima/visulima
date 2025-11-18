import { createQuery } from "@tanstack/svelte-query";
import { derived, get, type Readable } from "svelte/store";

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

export interface CreateTransformFileOptions {
    /** Base endpoint URL for transform operations */
    endpoint: string;
    /** File ID to transform */
    id: Readable<string> | string;
    /** Transformation parameters */
    transform: Readable<TransformOptions> | TransformOptions;
    /** Whether to enable the query */
    enabled?: Readable<boolean> | boolean;
}

export interface CreateTransformFileReturn {
    /** Last request error, if any */
    error: Readable<Error | null>;
    /** Whether a request is currently in progress */
    isLoading: Readable<boolean>;
    /** Transformed file data as Blob */
    data: Readable<Blob | undefined>;
    /** File metadata from response headers */
    meta: Readable<FileMeta | null>;
    /** Refetch the transformed file */
    refetch: () => void;
}

/**
 * Svelte store-based utility for fetching transformed files using TanStack Query
 * Supports image, video, and audio transformation parameters
 * @param options Hook configuration options
 * @returns Transform file fetching functions and state stores
 */
export const createTransformFile = (options: CreateTransformFileOptions): CreateTransformFileReturn => {
    const { endpoint, id, transform, enabled = true } = options;

    const idStore: Readable<string> = typeof id === "object" && "subscribe" in id ? id : derived([], () => id as string);
    const transformStore: Readable<TransformOptions> =
        typeof transform === "object" && "subscribe" in transform ? transform : derived([], () => transform as TransformOptions);
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
                    const errorData = await response.json().catch(() => ({
                        error: {
                            code: "RequestFailed",
                            message: response.statusText,
                        },
                    }));

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
        error: derived(query.error, ($error) => ($error as Error) || null),
        isLoading: query.isLoading,
        meta: derived(query.data, ($data) => $data?.meta || null),
        refetch: () => {
            query.refetch();
        },
    };
};

