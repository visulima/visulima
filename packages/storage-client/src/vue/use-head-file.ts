import { useQuery } from "@tanstack/vue-query";
import type { MaybeRefOrGetter } from "vue";
import { computed, toValue } from "vue";

import { buildUrl, fetchHead, storageQueryKeys } from "../core";

export interface FileHeadMetadata {
    /** Content length in bytes */
    contentLength?: number;
    /** Content type */
    contentType?: string;
    /** Entity tag for caching */
    etag?: string;
    /** Last modified date */
    lastModified?: string;
    /** Upload expiration date */
    uploadExpires?: string;
    /** Upload offset for chunked uploads */
    uploadOffset?: number;
    /** Whether upload is complete (chunked uploads) */
    uploadComplete?: boolean;
    /** Whether this is a chunked upload session */
    chunkedUpload?: boolean;
    /** Received chunk offsets (chunked uploads) */
    receivedChunks?: number[];
}

export interface UseHeadFileOptions {
    /** Base endpoint URL for file operations */
    endpoint: string;
    /** File ID to fetch metadata for */
    id: MaybeRefOrGetter<string>;
    /** Whether to enable the query */
    enabled?: MaybeRefOrGetter<boolean>;
}

export interface UseHeadFileReturn {
    /** Last request error, if any */
    error: Readonly<Ref<Error | null>>;
    /** Whether a request is currently in progress */
    isLoading: Readonly<Ref<boolean>>;
    /** File metadata from HEAD request */
    data: Readonly<Ref<FileHeadMetadata | undefined>>;
    /** Refetch the file metadata */
    refetch: () => void;
}

/**
 * Vue composable for fetching file metadata via HEAD request using TanStack Query
 * Useful for checking upload progress and file status without downloading
 * @param options Hook configuration options
 * @returns File HEAD request functions and state
 */
export const useHeadFile = (options: UseHeadFileOptions): UseHeadFileReturn => {
    const { endpoint, id, enabled = true } = options;

    const query = useQuery({
        enabled: computed(() => toValue(enabled) && !!toValue(id)),
        queryFn: async (): Promise<FileHeadMetadata> => {
            const fileId = toValue(id);
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
        queryKey: computed(() => storageQueryKeys.files.head(toValue(id))),
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

