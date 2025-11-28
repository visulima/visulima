import { createQuery } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";

import { buildUrl, fetchHead, storageQueryKeys } from "../core";

export interface FileHeadMetadata {
    /** Whether this is a chunked upload session */
    chunkedUpload?: boolean;
    /** Content length in bytes */
    contentLength?: number;
    /** Content type */
    contentType?: string;
    /** Entity tag for caching */
    etag?: string;
    /** Last modified date */
    lastModified?: string;
    /** Received chunk offsets (chunked uploads) */
    receivedChunks?: number[];
    /** Whether upload is complete (chunked uploads) */
    uploadComplete?: boolean;
    /** Upload expiration date */
    uploadExpires?: string;
    /** Upload offset for chunked uploads */
    uploadOffset?: number;
}

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
            queryFn: async (): Promise<FileHeadMetadata> => {
                const url = buildUrl(endpoint, fileId);
                const headers = await fetchHead(url);

                // Extract metadata from headers
                const contentLength = headers.get("Content-Length");
                const contentType = headers.get("Content-Type");
                const etag = headers.get("ETag");
                const lastModified = headers.get("Last-Modified");
                const uploadExpires = headers.get("X-Upload-Expires");
                const uploadOffset = headers.get("X-Upload-Offset");
                const uploadComplete = headers.get("X-Upload-Complete");
                const chunkedUpload = headers.get("X-Chunked-Upload");
                const receivedChunks = headers.get("X-Received-Chunks");

                const fileMeta: FileHeadMetadata = {};

                if (contentLength) {
                    fileMeta.contentLength = Number.parseInt(contentLength, 10);
                }

                if (contentType) {
                    fileMeta.contentType = contentType;
                }

                if (etag) {
                    fileMeta.etag = etag;
                }

                if (lastModified) {
                    fileMeta.lastModified = lastModified;
                }

                if (uploadExpires) {
                    fileMeta.uploadExpires = uploadExpires;
                }

                if (uploadOffset) {
                    fileMeta.uploadOffset = Number.parseInt(uploadOffset, 10);
                }

                if (uploadComplete) {
                    fileMeta.uploadComplete = uploadComplete === "true";
                }

                if (chunkedUpload) {
                    fileMeta.chunkedUpload = chunkedUpload === "true";
                }

                if (receivedChunks) {
                    try {
                        fileMeta.receivedChunks = JSON.parse(receivedChunks) as number[];
                    } catch {
                        // Ignore parse errors
                    }
                }

                return fileMeta;
            },
            queryKey: storageQueryKeys.files.head(endpoint, fileId),
        };
    });

    return {
        data: () => {
            try {
                const dataValue = (query as { data?: Accessor<FileHeadMetadata | undefined> | FileHeadMetadata | undefined }).data;

                if (typeof dataValue === "function") {
                    return dataValue() as FileHeadMetadata | undefined;
                }

                return dataValue as FileHeadMetadata | undefined;
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
