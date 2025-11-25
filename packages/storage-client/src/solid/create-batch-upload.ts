import type { Accessor } from "solid-js";
import { createSignal, onCleanup, onMount } from "solid-js";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";
import type { FileMeta, UploadResult } from "../react/types";

export interface CreateBatchUploadOptions {
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

export interface CreateBatchUploadReturn {
    /** Abort a specific batch */
    abortBatch: (batchId: string) => void;
    /** Number of completed items in current batch */
    completedCount: Accessor<number>;
    /** Last batch error, if any */
    error: Accessor<Error | undefined>;
    /** Number of failed items in current batch */
    errorCount: Accessor<number>;
    /** Whether a batch is currently uploading */
    isUploading: Accessor<boolean>;
    /** All upload items in current batch */
    items: Accessor<UploadItem[]>;
    /** Current batch progress (0-100) */
    progress: Accessor<number>;
    /** Reset batch state */
    reset: () => void;
    /** Upload multiple files as a batch */
    uploadBatch: (files: File[]) => string[];
}

/**
 * Solid.js primitive for batch file uploads using multipart/form-data.
 * @param options Upload configuration options
 * @returns Batch upload functions and state signals
 */
export const createBatchUpload = (options: CreateBatchUploadOptions): CreateBatchUploadReturn => {
    const { endpoint, metadata, onError, onProgress, onStart, onSuccess } = options;

    const [items, setItems] = createSignal<UploadItem[]>([]);
    const [progress, setProgress] = createSignal(0);
    const [isUploading, setIsUploading] = createSignal(false);
    const [error, setError] = createSignal<Error | undefined>(undefined);
    const [completedCount, setCompletedCount] = createSignal(0);
    const [errorCount, setErrorCount] = createSignal(0);
    const [currentBatchId, setCurrentBatchId] = createSignal<string | undefined>(undefined);

    // Create uploader instance
    const uploaderInstance = createMultipartAdapter({
        endpoint,
        metadata,
    });

    // Subscribe to uploader events
    onMount(() => {
        const { uploader } = uploaderInstance;

        // Track batch start
        const onBatchStart = (batch: BatchState): void => {
            setCurrentBatchId(batch.id);
            setIsUploading(true);
            setProgress(0);
            setError(undefined);
            setCompletedCount(0);
            setErrorCount(0);
            setItems(uploader.getBatchItems(batch.id));
            onStart?.(batch.id);
        };

        // Track batch progress
        const onBatchProgress = (batch: BatchState): void => {
            if (batch.id === currentBatchId()) {
                setProgress(batch.progress);
                setCompletedCount(batch.completedCount);
                setErrorCount(batch.errorCount);
                setItems(uploader.getBatchItems(batch.id));
                onProgress?.(batch.progress, batch.id);
            }
        };

        // Track batch finish
        const onBatchFinish = (batch: BatchState): void => {
            if (batch.id === currentBatchId()) {
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

                setProgress(100);
                setIsUploading(false);
                onSuccess?.(results, batch.id);
            }
        };

        // Track batch error
        const onBatchError = (batch: BatchState): void => {
            if (batch.id === currentBatchId()) {
                const uploadError = new Error(`Batch upload failed: ${batch.errorCount} file(s) failed`);

                setError(uploadError);
                setIsUploading(false);
                setErrorCount(batch.errorCount);
                setCompletedCount(batch.completedCount);
                onError?.(uploadError, batch.id);
            }
        };

        // Track batch cancelled
        const onBatchCancelled = (batch: BatchState): void => {
            if (batch.id === currentBatchId()) {
                setIsUploading(false);
                setProgress(0);
            }
        };

        uploader.on("BATCH_START", onBatchStart);
        uploader.on("BATCH_PROGRESS", onBatchProgress);
        uploader.on("BATCH_FINISH", onBatchFinish);
        uploader.on("BATCH_ERROR", onBatchError);
        uploader.on("BATCH_CANCELLED", onBatchCancelled);

        onCleanup(() => {
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
        setProgress(0);
        setIsUploading(false);
        setError(undefined);
        setItems([]);
        setCompletedCount(0);
        setErrorCount(0);
        setCurrentBatchId(undefined);
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
