import { useEffect, useMemo, useRef, useState } from "react";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { BatchState, UploadItem } from "../core/uploader";
import type { FileMeta, UploadResult } from "./types";

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
    error: Error | undefined;
    /** Whether an upload is currently in progress */
    isUploading: boolean;
    /** Current upload progress (0-100) */
    progress: number;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: UploadResult | undefined;
    /** Upload a file using multipart/form-data */
    upload: (file: File) => Promise<UploadResult>;
}

/**
 * React hook for multipart/form-data file uploads using custom uploader implementation.
 * @param options Upload configuration options
 * @returns Upload functions and state
 */
export const useMultipartUpload = (options: UseMultipartUploadOptions): UseMultipartUploadReturn => {
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

    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [result, setResult] = useState<UploadResult | undefined>(undefined);
    const currentItemRef = useRef<string | undefined>(undefined);
    const currentFileRef = useRef<File | undefined>(undefined);

    // Store callbacks in refs to avoid re-subscribing on every render
    const callbacksRef = useRef({ onError, onProgress, onStart, onSuccess });

    useEffect(() => {
        callbacksRef.current = { onError, onProgress, onStart, onSuccess };
    }, [onError, onProgress, onStart, onSuccess]);

    // Subscribe to uploader events
    useEffect(() => {
        const { uploader } = uploaderInstance;

        // Track upload progress
        const onItemProgress = (itemOrBatch: UploadItem | BatchState): void => {
            if ("file" in itemOrBatch && itemOrBatch.id === currentItemRef.current) {
                const item = itemOrBatch;
                // Progress is already a percentage (0-100)
                const progressValue = Math.min(100, Math.max(0, item.completed));

                setProgress(progressValue);
                callbacksRef.current.onProgress?.(progressValue);
            }
        };

        // Track when upload starts
        const onItemStart = (itemOrBatch: UploadItem | BatchState): void => {
            if ("file" in itemOrBatch) {
                const item = itemOrBatch;

                currentItemRef.current = item.id;
                currentFileRef.current = item.file;
                setIsUploading(true);
                setProgress(0);
                setError(undefined);
                callbacksRef.current.onStart?.();
            }
        };

        // Track when upload completes
        // Parse response according to OpenAPI FileMeta schema
        const onItemFinish = (itemOrBatch: UploadItem | BatchState): void => {
            if ("file" in itemOrBatch && itemOrBatch.id === currentItemRef.current) {
                const item = itemOrBatch;
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

                setProgress(100);
                setResult(uploadResult);
                setIsUploading(false);
                callbacksRef.current.onSuccess?.(uploadResult);
                currentItemRef.current = undefined;
                currentFileRef.current = undefined;
            }
        };

        // Track errors
        const onUploadError = (itemOrBatch: UploadItem | BatchState): void => {
            if ("file" in itemOrBatch && itemOrBatch.id === currentItemRef.current) {
                const item = itemOrBatch;
                const uploadError = new Error(item.error || "Upload failed");

                setError(uploadError);
                setIsUploading(false);
                callbacksRef.current.onError?.(uploadError);
                currentItemRef.current = undefined;
            }
        };

        uploader.on("ITEM_START", onItemStart);
        uploader.on("ITEM_PROGRESS", onItemProgress);
        uploader.on("ITEM_FINISH", onItemFinish);
        uploader.on("ITEM_ERROR", onUploadError);

        return () => {
            uploader.off("ITEM_START", onItemStart);
            uploader.off("ITEM_PROGRESS", onItemProgress);
            uploader.off("ITEM_FINISH", onItemFinish);
            uploader.off("ITEM_ERROR", onUploadError);
        };
    }, [uploaderInstance]);

    const upload = async (file: File): Promise<UploadResult> => {
        // Use the convenience method from the adapter
        try {
            return await uploaderInstance.upload(file);
        } catch (error_) {
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));

            setError(uploadError);
            callbacksRef.current.onError?.(uploadError);
            throw uploadError;
        }
    };

    const reset = (): void => {
        uploaderInstance.clear();
        setProgress(0);
        setIsUploading(false);
        setError(undefined);
        setResult(undefined);
        currentItemRef.current = undefined;
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
