import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

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

export interface UseHeadFileOptions {
    /** Whether to enable the query */
    enabled?: boolean;
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch metadata for */
    id: string;
    /** Callback when request fails */
    onError?: (error: Error) => void;
    /** Callback when request succeeds */
    onSuccess?: (meta: FileHeadMetadata) => void;
}

export interface UseHeadFileReturn {
    /** File metadata from HEAD request */
    data: FileHeadMetadata | undefined;
    /** Last request error, if any */
    error: Error | undefined;
    /** Whether a request is currently in progress */
    isLoading: boolean;
    /** Refetch the file metadata */
    refetch: () => void;
}

/**
 * React hook for fetching file metadata via HEAD request using TanStack Query.
 * Useful for checking upload progress and file status without downloading.
 * @param options Hook configuration options
 * @returns File HEAD request functions and state
 */
export const useHeadFile = (options: UseHeadFileOptions): UseHeadFileReturn => {
    const { enabled = true, endpoint, id, onError, onSuccess } = options;

    const query = useQuery({
        enabled: enabled && !!id,
        queryFn: async (): Promise<FileHeadMetadata> => {
            const url = buildUrl(endpoint, id);
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
        queryKey: storageQueryKeys.files.head(endpoint, id),
    });

    // Store callbacks in refs to avoid re-running effects when callbacks change
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onSuccessRef.current = onSuccess;
    }, [onSuccess]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    // Call callbacks in useEffect to avoid calling during render
    useEffect(() => {
        if (query.data && onSuccessRef.current) {
            onSuccessRef.current(query.data);
        }
    }, [query.data]);

    useEffect(() => {
        if (query.error && onErrorRef.current) {
            onErrorRef.current(query.error as Error);
        }
    }, [query.error]);

    return {
        data: query.data,
        error: (query.error as Error) || undefined,
        isLoading: query.isLoading,
        refetch: () => {
            query.refetch();
        },
    };
};
