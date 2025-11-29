import { onDestroy, onMount } from "svelte";
import type { Readable } from "svelte/store";
import { get, writable } from "svelte/store";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";
import type { FileMeta, UploadResult } from "../react/types";

export interface CreateBatchUploadOptions {
    endpoint: string;
    metadata?: Record<string, string>;
    onError?: (error: Error, batchId: string) => void;
    onProgress?: (progress: number, batchId: string) => void;
    onStart?: (batchId: string) => void;
    onSuccess?: (results: UploadResult[], batchId: string) => void;
}

export interface CreateBatchUploadReturn {
    abortBatch: (batchId: string) => void;
    completedCount: Readable<number>;
    error: Readable<Error | undefined>;
    errorCount: Readable<number>;
    isUploading: Readable<boolean>;
    items: Readable<UploadItem[]>;
    progress: Readable<number>;
    reset: () => void;
    uploadBatch: (files: File[]) => string[];
}

export const createBatchUpload = (options: CreateBatchUploadOptions): CreateBatchUploadReturn => {
    const { endpoint, metadata, onError, onProgress, onStart, onSuccess } = options;

    const items = writable<UploadItem[]>([]);
    const progress = writable(0);
    const isUploading = writable(false);
    const error = writable<Error | undefined>(undefined);
    const completedCount = writable(0);
    const errorCount = writable(0);
    const currentBatchId = writable<string | undefined>(undefined);

    const uploaderInstance = createMultipartAdapter({ endpoint, metadata });

    onMount(() => {
        const { uploader } = uploaderInstance;

        const onBatchStart = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                const batch = itemOrBatch;

                currentBatchId.set(batch.id);
                isUploading.set(true);
                progress.set(0);
                error.set(undefined);
                completedCount.set(0);
                errorCount.set(0);
                items.set(uploader.getBatchItems(batch.id));
                onStart?.(batch.id);
            }
        };

        const onBatchProgress = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                const batch = itemOrBatch;

                if (batch.id === get(currentBatchId)) {
                    progress.set(batch.progress);
                    completedCount.set(batch.completedCount);
                    errorCount.set(batch.errorCount);
                    items.set(uploader.getBatchItems(batch.id));
                    onProgress?.(batch.progress, batch.id);
                }
            }
        };

        const onBatchFinish = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                const batch = itemOrBatch;

                if (batch.id === get(currentBatchId)) {
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

                    progress.set(100);
                    isUploading.set(false);
                    onSuccess?.(results, batch.id);
                }
            }
        };

        const onBatchError = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                const batch = itemOrBatch;

                if (batch.id === get(currentBatchId)) {
                    const uploadError = new Error(`Batch upload failed: ${batch.errorCount} file(s) failed`);

                    error.set(uploadError);
                    isUploading.set(false);
                    errorCount.set(batch.errorCount);
                    completedCount.set(batch.completedCount);
                    onError?.(uploadError, batch.id);
                }
            }
        };

        const onBatchCancelled = (itemOrBatch: UploadItem | BatchState): void => {
            if ("itemIds" in itemOrBatch) {
                const batch = itemOrBatch;

                if (batch.id === get(currentBatchId)) {
                    isUploading.set(false);
                    progress.set(0);
                }
            }
        };

        uploader.on("BATCH_START", onBatchStart);
        uploader.on("BATCH_PROGRESS", onBatchProgress);
        uploader.on("BATCH_FINISH", onBatchFinish);
        uploader.on("BATCH_ERROR", onBatchError);
        uploader.on("BATCH_CANCELLED", onBatchCancelled);

        onDestroy(() => {
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
        progress.set(0);
        isUploading.set(false);
        error.set(undefined);
        items.set([]);
        completedCount.set(0);
        errorCount.set(0);
        currentBatchId.set(undefined);
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
