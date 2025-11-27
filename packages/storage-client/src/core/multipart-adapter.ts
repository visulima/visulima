import type { FileMeta, UploadResult } from "../react/types";
import type { BatchState, Uploader, UploadItem } from "./uploader";
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
    /** Abort a batch of uploads */
    abortBatch: (batchId: string) => void;
    /** Abort a specific upload item */
    abortItem: (id: string) => void;
    /** Clear all uploads */
    clear: () => void;
    /** Upload a file and return visulima-compatible result */
    upload: (file: File) => Promise<UploadResult>;
    /** Upload multiple files as a batch and return item IDs */
    uploadBatch: (files: File[]) => string[];
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
         * Aborts a batch of uploads.
         */
        abortBatch: (batchId: string) => {
            uploader.abortBatch(batchId);
        },

        /**
         * Aborts a specific upload item.
         */
        abortItem: (id: string) => {
            uploader.abortItem(id);
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
                let timeoutId: ReturnType<typeof setTimeout> | undefined;

                // Handle upload completion
                const onItemFinish = (itemOrBatch: UploadItem | BatchState): void => {
                    if ("file" in itemOrBatch && !resolved && itemOrBatch.file.name === file.name) {
                        const item = itemOrBatch as UploadItem;
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
                const onError = (itemOrBatch: UploadItem | BatchState): void => {
                    if ("file" in itemOrBatch && !resolved && itemOrBatch.file.name === file.name) {
                        const item = itemOrBatch as UploadItem;
                        const error = new Error(item.error || "Upload failed");

                        resolved = true;
                        cleanup();
                        reject(error);
                    }
                };

                // Cleanup function
                const cleanup = (): void => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = undefined;
                    }

                    uploader.off("ITEM_FINISH", onItemFinish);
                    uploader.off("ITEM_ERROR", onError);
                };

                uploader.on("ITEM_FINISH", onItemFinish);
                uploader.on("ITEM_ERROR", onError);

                // Start upload
                uploader.add(file);

                timeoutId = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        reject(new Error("Upload timeout"));
                    }
                }, 300_000); // 5 minutes
            }),

        /**
         * Uploads multiple files as a batch and returns item IDs.
         */
        uploadBatch: (files: File[]): string[] => uploader.addBatch(files),
        uploader,
    };
};
