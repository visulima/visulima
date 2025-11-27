import { createQuery } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

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
    enabled?: Accessor<boolean> | boolean;
    /** Base endpoint URL for transform operations */
    endpoint: string;
    /** File ID to transform */
    id: Accessor<string> | string;
    /** Transformation parameters */
    transform: Accessor<TransformOptions> | TransformOptions;
}

export interface CreateTransformFileReturn {
    /** Transformed file data as Blob */
    data: Accessor<Blob | undefined>;
    /** Last request error, if any */
    error: Accessor<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Accessor<boolean>;
    /** File metadata from response headers */
    meta: Accessor<FileMeta | undefined>;
    /** Refetch the transformed file */
    refetch: () => void;
}

/**
 * Solid.js primitive for fetching transformed files using TanStack Query.
 * Supports image, video, and audio transformation parameters.
 * @param options Hook configuration options
 * @returns Transform file fetching functions and state signals
 */
export const createTransformFile = (options: CreateTransformFileOptions): CreateTransformFileReturn => {
    const { enabled = true, endpoint, id, transform } = options;

    const idValue = typeof id === "function" ? id : () => id;
    const transformValue = typeof transform === "function" ? transform : () => transform;
    const enabledValue = typeof enabled === "function" ? enabled : () => enabled;

    const query = createQuery(() => {
        const fileId = idValue();
        const transformParams = transformValue();

        return {
            enabled: enabledValue() && !!fileId && !!transformParams,
            queryFn: async () => {
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
            queryKey: (() => {
                const filteredTransform = Object.fromEntries(Object.entries(transformParams).filter(([, value]) => value !== undefined)) as Record<
                    string,
                    string | number | boolean
                >;

                return storageQueryKeys.transform.file(endpoint, fileId, filteredTransform);
            })(),
        };
    });

    return {
        data: () => {
            try {
                const dataValue = (query as any).data;
                const data = typeof dataValue === "function" ? dataValue() : dataValue;

                return data?.blob;
            } catch {
                return undefined;
            }
        },
        error: () => {
            try {
                const errorValue = (query as any).error;
                const error = typeof errorValue === "function" ? errorValue() : errorValue;

                return (error as Error) || undefined;
            } catch {
                return undefined;
            }
        },
        isLoading: () => {
            try {
                const isLoadingValue = (query as any).isLoading;

                return (typeof isLoadingValue === "function" ? isLoadingValue() : isLoadingValue) as boolean;
            } catch {
                return false;
            }
        },
        meta: () => {
            try {
                const dataValue = (query as any).data;
                const data = typeof dataValue === "function" ? dataValue() : dataValue;

                return data?.meta || undefined;
            } catch {
                return undefined;
            }
        },
        refetch: () => {
            query.refetch();
        },
    };
};
