import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";
import type { FileMeta, UploadResult } from "./types";

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
    completedCount: number;
    /** Last batch error, if any */
    error: Error | undefined;
    /** Number of failed items in current batch */
    errorCount: number;
    /** Whether a batch is currently uploading */
    isUploading: boolean;
    /** All upload items in current batch */
    items: UploadItem[];
    /** Current batch progress (0-100) */
    progress: number;
    /** Reset batch state */
    reset: () => void;
    /** Upload multiple files as a batch */
    uploadBatch: (files: File[]) => string[];
}

/**
 * React hook for batch file uploads using multipart/form-data.
 * @param options Upload configuration options
 * @returns Batch upload functions and state
 */
export const useBatchUpload = (options: UseBatchUploadOptions): UseBatchUploadReturn => {
    const { endpoint, metadata, onError, onProgress, onStart, onSuccess } = options;

    // Create uploader instance (memoized)
    const uploaderInstance = useMemo(
        () =>
            createMultipartAdapter({
                endpoint,
                metadata,
            }),
        [endpoint, metadata],
    );

    const [items, setItems] = useState<UploadItem[]>([]);
    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [completedCount, setCompletedCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);
    const currentBatchIdRef = useRef<string | undefined>(undefined);

    // Store callbacks in refs to avoid re-subscribing on every render
    const callbacksRef = useRef({ onError, onProgress, onStart, onSuccess });

    useEffect(() => {
        callbacksRef.current = { onError, onProgress, onStart, onSuccess };
    }, [onError, onProgress, onStart, onSuccess]);

    // Subscribe to uploader events
    useEffect(() => {
        const { uploader } = uploaderInstance;

        // Track batch start
        const onBatchStart = (batch: BatchState): void => {
            currentBatchIdRef.current = batch.id;
            setIsUploading(true);
            setProgress(0);
            setError(undefined);
            setCompletedCount(0);
            setErrorCount(0);
            setItems(uploader.getBatchItems(batch.id));
            callbacksRef.current.onStart?.(batch.id);
        };

        // Track batch progress
        const onBatchProgress = (batch: BatchState): void => {
            if (batch.id === currentBatchIdRef.current) {
                setProgress(batch.progress);
                setCompletedCount(batch.completedCount);
                setErrorCount(batch.errorCount);
                setItems(uploader.getBatchItems(batch.id));
                callbacksRef.current.onProgress?.(batch.progress, batch.id);
            }
        };

        // Track batch finish
        const onBatchFinish = (batch: BatchState): void => {
            if (batch.id === currentBatchIdRef.current) {
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
                callbacksRef.current.onSuccess?.(results, batch.id);
            }
        };

        // Track batch error
        const onBatchError = (batch: BatchState): void => {
            if (batch.id === currentBatchIdRef.current) {
                const uploadError = new Error(`Batch upload failed: ${batch.errorCount} file(s) failed`);

                setError(uploadError);
                setIsUploading(false);
                setErrorCount(batch.errorCount);
                setCompletedCount(batch.completedCount);
                callbacksRef.current.onError?.(uploadError, batch.id);
            }
        };

        // Track batch cancelled
        const onBatchCancelled = (batch: BatchState): void => {
            if (batch.id === currentBatchIdRef.current) {
                setIsUploading(false);
                setProgress(0);
            }
        };

        uploader.on("BATCH_START", onBatchStart);
        uploader.on("BATCH_PROGRESS", onBatchProgress);
        uploader.on("BATCH_FINISH", onBatchFinish);
        uploader.on("BATCH_ERROR", onBatchError);
        uploader.on("BATCH_CANCELLED", onBatchCancelled);

        return () => {
            uploader.off("BATCH_START", onBatchStart);
            uploader.off("BATCH_PROGRESS", onBatchProgress);
            uploader.off("BATCH_FINISH", onBatchFinish);
            uploader.off("BATCH_ERROR", onBatchError);
            uploader.off("BATCH_CANCELLED", onBatchCancelled);
        };
    }, [uploaderInstance]);

    const uploadBatch = useCallback(
        (files: File[]): string[] => {
            if (files.length === 0) {
                return [];
            }

            return uploaderInstance.uploadBatch(files);
        },
        [uploaderInstance],
    );

    const abortBatch = useCallback(
        (batchId: string): void => {
            uploaderInstance.abortBatch(batchId);
        },
        [uploaderInstance],
    );

    const reset = useCallback((): void => {
        uploaderInstance.clear();
        setProgress(0);
        setIsUploading(false);
        setError(undefined);
        setItems([]);
        setCompletedCount(0);
        setErrorCount(0);
        currentBatchIdRef.current = undefined;
    }, [uploaderInstance]);

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


