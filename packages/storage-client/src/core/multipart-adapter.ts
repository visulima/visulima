import type { FileMeta, UploadResult } from "../react/types";
import type { Uploader, UploadItem } from "./uploader";
import { createUploader } from "./uploader";

export interface MultipartAdapterOptions {
    /** Upload endpoint URL */
    endpoint: string;
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Enable automatic retry on failure */
    retry?: boolean;
}

export interface MultipartAdapter {
    /** Abort all uploads */
    abort: () => void;
    /** Clear all uploads */
    clear: () => void;
    /** Upload a file and return visulima-compatible result */
    upload: (file: File) => Promise<UploadResult>;
    /** The underlying uploader instance */
    uploader: Uploader;
}

/**
 * Creates a multipart upload adapter.
 * This adapter provides a clean interface for multipart file uploads
 * with proper progress tracking and event handling.
 */
export const createMultipartAdapter = (options: MultipartAdapterOptions): MultipartAdapter => {
    const uploader = createUploader({
        endpoint: options.endpoint,
        maxRetries: options.maxRetries,
        metadata: options.metadata,
        retry: options.retry,
    });

    return {
        /**
         * Aborts all uploads.
         */
        abort: () => {
            uploader.abort();
        },

        /**
         * Clears all uploads.
         */
        clear: () => {
            uploader.clear();
        },

        /**
         * Uploads a file and returns visulima-compatible result.
         */
        upload: async (file: File): Promise<UploadResult> =>
            new Promise((resolve, reject) => {
                let uploadResult: UploadResult | undefined;
                let resolved = false;

                // Cleanup function
                const cleanup = (): void => {
                    uploader.off("ITEM_FINISH", onItemFinish);
                    uploader.off("ITEM_ERROR", onError);
                };

                // Handle upload completion
                const onItemFinish = (item: UploadItem): void => {
                    if (!resolved && item.file.name === file.name) {
                        // Parse response as FileMeta
                        let fileMeta: Partial<FileMeta> = {};

                        try {
                            if (item.uploadResponse?.data && typeof item.uploadResponse.data === "object") {
                                fileMeta = item.uploadResponse.data as Partial<FileMeta>;
                            } else if (item.uploadResponse?.response) {
                                fileMeta = JSON.parse(item.uploadResponse.response) as Partial<FileMeta>;
                            }
                        } catch {
                            // Use fallback values if parsing fails
                        }

                        // Build UploadResult from FileMeta
                        uploadResult = {
                            bytesWritten: fileMeta.bytesWritten,
                            contentType: fileMeta.contentType ?? item.file.type,
                            createdAt: fileMeta.createdAt,
                            filename: fileMeta.originalName ?? item.file.name,
                            id: fileMeta.id ?? item.id,
                            metadata: fileMeta.metadata,
                            name: fileMeta.name,
                            originalName: fileMeta.originalName ?? item.file.name,
                            size: fileMeta.size ?? item.file.size,
                            status: (fileMeta.status as UploadResult["status"]) ?? "completed",
                            url: item.url,
                        };

                        resolved = true;
                        cleanup();
                        resolve(uploadResult);
                    }
                };

                // Handle errors
                const onError = (item: UploadItem): void => {
                    if (!resolved && item.file.name === file.name) {
                        const error = new Error(item.error || "Upload failed");

                        resolved = true;
                        cleanup();
                        reject(error);
                    }
                };

                // Set up event listeners
                uploader.on("ITEM_FINISH", onItemFinish);
                uploader.on("ITEM_ERROR", onError);

                // Start upload
                uploader.add(file);

                // Safety timeout - store timeout ID so we can clear it
                let timeoutId: NodeJS.Timeout | undefined;

                // Update cleanup to also clear timeout
                const originalCleanup = cleanup;
                const cleanupWithTimeout = (): void => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = undefined;
                    }

                    originalCleanup();
                };

                // Set timeout
                timeoutId = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        cleanupWithTimeout();
                        reject(new Error("Upload timeout"));
                    }
                }, 300_000); // 5 minutes

                // Update callbacks to use cleanup with timeout
                const originalOnItemFinish = onItemFinish;
                const originalOnError = onError;

                uploader.off("ITEM_FINISH", onItemFinish);
                uploader.off("ITEM_ERROR", onError);

                uploader.on("ITEM_FINISH", (item: UploadItem) => {
                    originalOnItemFinish(item);
                    cleanupWithTimeout();
                });

                uploader.on("ITEM_ERROR", (item: UploadItem) => {
                    originalOnError(item);
                    cleanupWithTimeout();
                });
            }),
        uploader,
    };
};
