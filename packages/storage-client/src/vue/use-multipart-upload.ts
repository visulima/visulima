import type { Ref } from "vue";
import { onBeforeUnmount, onMounted, ref } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { FileMeta, UploadItem, UploadResult } from "../react/types";

export interface UseMultipartUploadOptions {
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

export interface UseMultipartUploadReturn {
    /** Last upload error, if any */
    error: Ref<Error | undefined>;
    /** Whether an upload is currently in progress */
    isUploading: Ref<boolean>;
    /** Current upload progress (0-100) */
    progress: Ref<number>;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: Ref<UploadResult | undefined>;
    /** Upload a file using multipart/form-data */
    upload: (file: File) => Promise<UploadResult>;
}

/**
 * Vue composable for multipart/form-data file uploads using rpldy uploader core
 * @param options Upload configuration options
 * @returns Upload functions and state
 */
export const useMultipartUpload = (options: UseMultipartUploadOptions): UseMultipartUploadReturn => {
    const { endpoint, metadata, onError, onProgress, onStart, onSuccess } = options;

    const progress = ref(0);
    const isUploading = ref(false);
    const error = ref<Error | undefined>(undefined);
    const result = ref<UploadResult | undefined>(undefined);
    const currentItemId = ref<string | undefined>(undefined);
    const currentFile = ref<File | undefined>(undefined);

    // Create uploader instance (create once, reuse)
    const uploaderInstance = createMultipartAdapter({
        endpoint,
        metadata,
    });

    // Subscribe to uploader events
    onMounted(() => {
        const { uploader } = uploaderInstance;

        // Track upload progress
        const onItemProgress = (item: UploadItem): void => {
            if (item.id === currentItemId.value) {
                // Progress is already a percentage (0-100)
                const progressValue = Math.min(100, Math.max(0, item.completed));

                progress.value = progressValue;
                onProgress?.(progressValue);
            }
        };

        // Track when upload starts
        const onItemStart = (item: UploadItem): void => {
            currentItemId.value = item.id;
            currentFile.value = item.file;
            isUploading.value = true;
            progress.value = 0;
            error.value = undefined;
            onStart?.();
        };

        // Track when upload completes
        // Parse response according to OpenAPI FileMeta schema
        const onItemFinish = (item: UploadItem): void => {
            if (item.id === currentItemId.value) {
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

                progress.value = 100;
                result.value = uploadResult;
                isUploading.value = false;
                onSuccess?.(uploadResult);
                currentItemId.value = undefined;
                currentFile.value = undefined;
            }
        };

        // Track errors
        const onUploadError = (item: UploadItem): void => {
            if (item.id === currentItemId.value) {
                const uploadError = new Error(item.error || "Upload failed");

                error.value = uploadError;
                isUploading.value = false;
                onError?.(uploadError);
                currentItemId.value = undefined;
            }
        };

        uploader.on("ITEM_START", onItemStart);
        uploader.on("ITEM_PROGRESS", onItemProgress);
        uploader.on("ITEM_FINISH", onItemFinish);
        uploader.on("ITEM_ERROR", onUploadError);

        // Cleanup on unmount
        onBeforeUnmount(() => {
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

            error.value = uploadError;
            onError?.(uploadError);
            throw uploadError;
        }
    };

    const reset = (): void => {
        uploaderInstance.clear();
        progress.value = 0;
        isUploading.value = false;
        error.value = undefined;
        result.value = undefined;
        currentItemId.value = undefined;
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
