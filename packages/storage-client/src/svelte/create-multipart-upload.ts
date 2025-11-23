import { onDestroy, onMount } from "svelte";
import type { Readable } from "svelte/store";
import { get, writable } from "svelte/store";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { FileMeta, UploadItem, UploadResult } from "../react/types";

export interface CreateMultipartUploadOptions {
    /** Upload endpoint URL */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when upload fails */
    onError?: (error: Error) => void;
    /** Callback when upload progress updates */
    onProgress?: (progress: number) => void;
    /** Callback when upload starts */
    onStart?: () => void;
    /** Callback when upload completes successfully */
    onSuccess?: (file: UploadResult) => void;
}

export interface CreateMultipartUploadReturn {
    /** Last upload error, if any */
    error: Readable<Error | undefined>;
    /** Whether an upload is currently in progress */
    isUploading: Readable<boolean>;
    /** Current upload progress (0-100) */
    progress: Readable<number>;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: Readable<UploadResult | undefined>;
    /** Upload a file using multipart/form-data */
    upload: (file: File) => Promise<UploadResult>;
}

/**
 * Svelte store-based utility for multipart/form-data file uploads using rpldy uploader core.
 * @param options Upload configuration options
 * @returns Upload functions and state stores
 */
export const createMultipartUpload = (options: CreateMultipartUploadOptions): CreateMultipartUploadReturn => {
    const { endpoint, metadata, onError, onProgress, onStart, onSuccess } = options;

    const progress = writable(0);
    const isUploading = writable(false);
    const error = writable<Error | undefined>(undefined);
    const result = writable<UploadResult | undefined>(undefined);
    const currentItemId = writable<string | undefined>(undefined);
    const currentFile = writable<File | undefined>(undefined);

    // Create uploader instance (create once, reuse)
    const uploaderInstance = createMultipartAdapter({
        endpoint,
        metadata,
    });

    // Subscribe to uploader events
    onMount(() => {
        const { uploader } = uploaderInstance;

        // Track upload progress
        const onItemProgress = (item: UploadItem): void => {
            if (item.id === get(currentItemId)) {
                // Progress is already a percentage (0-100)
                const progressValue = Math.min(100, Math.max(0, item.completed));

                progress.set(progressValue);
                onProgress?.(progressValue);
            }
        };

        // Track when upload starts
        const onItemStart = (item: UploadItem): void => {
            currentItemId.set(item.id);
            currentFile.set(item.file);
            isUploading.set(true);
            progress.set(0);
            error.set(undefined);
            onStart?.();
        };

        // Track when upload completes
        // Parse response according to OpenAPI FileMeta schema
        const onItemFinish = (item: UploadItem): void => {
            if (item.id === get(currentItemId)) {
                // Try to parse the response as FileMeta (OpenAPI schema)
                let fileMeta: Partial<FileMeta> = {};

                try {
                    if (item.uploadResponse?.data && typeof item.uploadResponse.data === "object") {
                        fileMeta = item.uploadResponse.data as Partial<FileMeta>;
                    } else if (item.uploadResponse?.response) {
                        fileMeta = JSON.parse(item.uploadResponse.response) as Partial<FileMeta>;
                    }
                } catch {
                    // If parsing fails, use fallback values
                }

                // Build UploadResult from FileMeta, with fallbacks
                const uploadResult: UploadResult = {
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

                progress.set(100);
                result.set(uploadResult);
                isUploading.set(false);
                onSuccess?.(uploadResult);
                currentItemId.set(undefined);
                currentFile.set(undefined);
            }
        };

        // Track errors
        const onUploadError = (item: UploadItem): void => {
            if (item.id === get(currentItemId)) {
                const uploadError = new Error(item.error || "Upload failed");

                error.set(uploadError);
                isUploading.set(false);
                onError?.(uploadError);
                currentItemId.set(undefined);
            }
        };

        uploader.on("ITEM_START", onItemStart);
        uploader.on("ITEM_PROGRESS", onItemProgress);
        uploader.on("ITEM_FINISH", onItemFinish);
        uploader.on("ITEM_ERROR", onUploadError);

        // Cleanup on destroy
        onDestroy(() => {
            uploader.off("ITEM_START", onItemStart);
            uploader.off("ITEM_PROGRESS", onItemProgress);
            uploader.off("ITEM_FINISH", onItemFinish);
            uploader.off("ITEM_ERROR", onUploadError);
        });
    });

    const upload = async (file: File): Promise<UploadResult> => {
        // Use the convenience method from the adapter
        try {
            return await uploaderInstance.upload(file);
        } catch (error_) {
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));

            error.set(uploadError);
            onError?.(uploadError);
            throw uploadError;
        }
    };

    const reset = (): void => {
        uploaderInstance.clear();
        progress.set(0);
        isUploading.set(false);
        error.set(undefined);
        result.set(undefined);
        currentItemId.set(undefined);
    };

    return {
        error,
        isUploading,
        progress,
        reset,
        result,
        upload,
    };
};
