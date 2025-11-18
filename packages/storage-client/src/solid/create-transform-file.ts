import { createQuery } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

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
    id: Accessor<string> | string;
    /** Transformation parameters */
    transform: Accessor<TransformOptions> | TransformOptions;
    /** Whether to enable the query */
    enabled?: Accessor<boolean> | boolean;
}

export interface CreateTransformFileReturn {
    /** Last request error, if any */
    error: Accessor<Error | null>;
    /** Whether a request is currently in progress */
    isLoading: Accessor<boolean>;
    /** Transformed file data as Blob */
    data: Accessor<Blob | undefined>;
    /** File metadata from response headers */
    meta: Accessor<FileMeta | null>;
    /** Refetch the transformed file */
    refetch: () => void;
}

/**
 * Solid.js primitive for fetching transformed files using TanStack Query
 * Supports image, video, and audio transformation parameters
 * @param options Hook configuration options
 * @returns Transform file fetching functions and state signals
 */
export const createTransformFile = (options: CreateTransformFileOptions): CreateTransformFileReturn => {
    const { endpoint, id, transform, enabled = true } = options;

    const idValue = typeof id === "function" ? id : () => id;
    const transformValue = typeof transform === "function" ? transform : () => transform;
    const enabledValue = typeof enabled === "function" ? enabled : () => enabled;

    const query = createQuery(() => ({
        enabled: enabledValue() && !!idValue() && !!transformValue(),
        queryFn: async () => {
            const fileId = idValue();
            const transformParams = transformValue();
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
        queryKey: () => storageQueryKeys.transform.file(idValue(), transformValue()),
    }));

    return {
        data: () => query.data()?.blob,
        error: () => {
            const err = query.error();
            return (err as Error) || null;
        },
        isLoading: query.isLoading as Accessor<boolean>,
        meta: () => query.data()?.meta || null,
        refetch: () => {
            query.refetch();
        },
    };
};

