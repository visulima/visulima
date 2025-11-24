import type { Ref } from "vue";
import { onBeforeUnmount, onMounted, ref } from "vue";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";
import type { FileMeta, UploadResult } from "../react/types";

export interface UseBatchUploadOptions {
    /** Upload endpoint URL */
    endpoint: string;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when batch fails */
    onError?: (error: Error, batchId: string) => void;
    /** Callback when batch progress updates */
    onProgress?: (progress: number, batchId: string) => void;
    /** Callback when batch starts */
    onStart?: (batchId: string) => void;
    /** Callback when batch completes successfully */
    onSuccess?: (results: UploadResult[], batchId: string) => void;
}

export interface UseBatchUploadReturn {
    /** Abort a specific batch */
    abortBatch: (batchId: string) => void;
    /** Number of completed items in current batch */
    completedCount: Ref<number>;
    /** Number of failed items in current batch */
    errorCount: Ref<number>;
    /** Last batch error, if any */
    error: Ref<Error | undefined>;
    /** All upload items in current batch */
    items: Ref<UploadItem[]>;
    /** Whether a batch is currently uploading */
    isUploading: Ref<boolean>;
    /** Current batch progress (0-100) */
    progress: Ref<number>;
    /** Reset batch state */
    reset: () => void;
    /** Upload multiple files as a batch */
    uploadBatch: (files: File[]) => string[];
}

/**
 * Vue composable for batch file uploads using multipart/form-data.
 * @param options Upload configuration options
 * @returns Batch upload functions and state
 */
export const useBatchUpload = (options: UseBatchUploadOptions): UseBatchUploadReturn => {
    const { endpoint, metadata, onError, onProgress, onStart, onSuccess } = options;

    const items = ref<UploadItem[]>([]);
    const progress = ref(0);
    const isUploading = ref(false);
    const error = ref<Error | undefined>(undefined);
    const completedCount = ref(0);
    const errorCount = ref(0);
    const currentBatchId = ref<string | undefined>(undefined);

    // Create uploader instance (create once, reuse)
    const uploaderInstance = createMultipartAdapter({
        endpoint,
        metadata,
    });

    // Subscribe to uploader events
    onMounted(() => {
        const { uploader } = uploaderInstance;

        // Track batch start
        const onBatchStart = (batch: BatchState): void => {
            currentBatchId.value = batch.id;
            isUploading.value = true;
            progress.value = 0;
            error.value = undefined;
            completedCount.value = 0;
            errorCount.value = 0;
            items.value = uploader.getBatchItems(batch.id);
            onStart?.(batch.id);
        };

        // Track batch progress
        const onBatchProgress = (batch: BatchState): void => {
            if (batch.id === currentBatchId.value) {
                progress.value = batch.progress;
                completedCount.value = batch.completedCount;
                errorCount.value = batch.errorCount;
                items.value = uploader.getBatchItems(batch.id);
                onProgress?.(batch.progress, batch.id);
            }
        };

        // Track batch finish
        const onBatchFinish = (batch: BatchState): void => {
            if (batch.id === currentBatchId.value) {
                const batchItems = uploader.getBatchItems(batch.id);
                const results: UploadResult[] = batchItems
                    .filter((item) => item.status === "completed")
                    .map((item) => {
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

                        return {
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
                        } as UploadResult;
                    });

                progress.value = 100;
                isUploading.value = false;
                onSuccess?.(results, batch.id);
            }
        };

        // Track batch error
        const onBatchError = (batch: BatchState): void => {
            if (batch.id === currentBatchId.value) {
                const uploadError = new Error(`Batch upload failed: ${batch.errorCount} file(s) failed`);

                error.value = uploadError;
                isUploading.value = false;
                errorCount.value = batch.errorCount;
                completedCount.value = batch.completedCount;
                onError?.(uploadError, batch.id);
            }
        };

        // Track batch cancelled
        const onBatchCancelled = (batch: BatchState): void => {
            if (batch.id === currentBatchId.value) {
                isUploading.value = false;
                progress.value = 0;
            }
        };

        uploader.on("BATCH_START", onBatchStart);
        uploader.on("BATCH_PROGRESS", onBatchProgress);
        uploader.on("BATCH_FINISH", onBatchFinish);
        uploader.on("BATCH_ERROR", onBatchError);
        uploader.on("BATCH_CANCELLED", onBatchCancelled);

        onBeforeUnmount(() => {
            uploader.off("BATCH_START", onBatchStart);
            uploader.off("BATCH_PROGRESS", onBatchProgress);
            uploader.off("BATCH_FINISH", onBatchFinish);
            uploader.off("BATCH_ERROR", onBatchError);
            uploader.off("BATCH_CANCELLED", onBatchCancelled);
        });
    });

    const uploadBatch = (files: File[]): string[] => {
        if (files.length === 0) {
            return [];
        }

        return uploaderInstance.uploadBatch(files);
    };

    const abortBatch = (batchId: string): void => {
        uploaderInstance.abortBatch(batchId);
    };

    const reset = (): void => {
        uploaderInstance.clear();
        progress.value = 0;
        isUploading.value = false;
        error.value = undefined;
        items.value = [];
        completedCount.value = 0;
        errorCount.value = 0;
        currentBatchId.value = undefined;
    };

    return {
        abortBatch,
        completedCount,
        error,
        errorCount,
        isUploading,
        items,
        progress,
        reset,
        uploadBatch,
    };
};

