import { createQuery } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

import type { FileHeadMetadata } from "../core";
import { buildUrl, extractHeadMetadataFromHeaders, fetchHead, storageQueryKeys } from "../core";

export interface CreateHeadFileOptions {
    /** Whether to enable the query */
    enabled?: Accessor<boolean> | boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch metadata for */
    id: Accessor<string> | string;
}

export interface CreateHeadFileReturn {
    /** File metadata from HEAD request */
    data: Accessor<FileHeadMetadata | undefined>;
    /** Last request error, if any */
    error: Accessor<Error | undefined>;
    /** Whether a request is currently in progress */
    isLoading: Accessor<boolean>;
    /** Refetch the file metadata */
    refetch: () => void;
}

/**
 * Solid.js primitive for fetching file metadata via HEAD request using TanStack Query.
 * Useful for checking upload progress and file status without downloading.
 * @param options Hook configuration options
 * @returns File HEAD request functions and state signals
 */
export const createHeadFile = (options: CreateHeadFileOptions): CreateHeadFileReturn => {
    const { enabled = true, endpoint, id } = options;

    const idValue = typeof id === "function" ? id : () => id;
    const enabledValue = typeof enabled === "function" ? enabled : () => enabled;

    const query = createQuery(() => {
        const fileId = idValue();

        return {
            enabled: enabledValue() && !!fileId,
            queryFn: async ({ signal }): Promise<FileHeadMetadata> => {
                const url = buildUrl(endpoint, fileId);

                return extractHeadMetadataFromHeaders(await fetchHead(url, { signal }));
            },
            queryKey: storageQueryKeys.files.head(endpoint, fileId),
        };
    });

    return {
        data: () => {
            try {
                const dataValue = (query as { data: Accessor<FileHeadMetadata | undefined> | FileHeadMetadata | undefined }).data;

                if (typeof dataValue === "function") {
                    return dataValue();
                }

                return dataValue;
            } catch {
                return undefined;
            }
        },
        error: () => {
            try {
                const errorValue = (query as { error: Accessor<Error | undefined> | Error | undefined }).error;
                const error = typeof errorValue === "function" ? errorValue() : errorValue;

                return error ?? undefined;
            } catch {
                return undefined;
            }
        },
        isLoading: () => {
            try {
                const isLoadingValue = (query as { isLoading: Accessor<boolean> | boolean }).isLoading;

                return typeof isLoadingValue === "function" ? isLoadingValue() : isLoadingValue;
            } catch {
                return false;
            }
        },
        refetch: () => {
            query.refetch().catch(() => {});
        },
    };
};
