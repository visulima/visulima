import { useEffect, useMemo, useRef, useState } from "react";

import { createMultipartAdapter } from "../core/multipart-adapter";
import type { FileMeta, UploadItem, UploadResult } from "./types";

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
 * React hook for multipart/form-data file uploads using custom uploader implementation
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
        const onItemProgress = (item: UploadItem): void => {
            // Debug logging
            if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
                console.debug("[useMultipartUpload] ITEM_PROGRESS event received:", {
                    completed: item.completed,
                    currentItemId: currentItemRef.current,
                    fileSize: item.size,
                    itemId: item.id,
                    loaded: item.loaded,
                    matches: item.id === currentItemRef.current,
                });
            }

            if (item.id === currentItemRef.current) {
                // Progress is already a percentage (0-100)
                const progressValue = Math.min(100, Math.max(0, item.completed));

                if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
                    console.debug("[useMultipartUpload] Updating progress state:", {
                        completed: item.completed,
                        progressValue,
                    });
                }

                setProgress(progressValue);
                callbacksRef.current.onProgress?.(progressValue);
            } else if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
                console.warn("[useMultipartUpload] ITEM_PROGRESS event ignored - item ID mismatch:", {
                    currentItemId: currentItemRef.current,
                    eventItemId: item.id,
                });
            }
        };

        // Track when upload starts
        const onItemStart = (item: UploadItem): void => {
            // Debug logging
            if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
                console.debug("[useMultipartUpload] ITEM_START event received:", {
                    fileName: item.file.name,
                    fileSize: item.file.size,
                    itemId: item.id,
                });
            }

            currentItemRef.current = item.id;
            currentFileRef.current = item.file;
            setIsUploading(true);
            setProgress(0);
            setError(undefined);
            callbacksRef.current.onStart?.();
        };

        // Track when upload completes
        // Parse response according to OpenAPI FileMeta schema
        const onItemFinish = (item: {
            file?: { name?: string; size?: number; type?: string };
            id: string;
            uploadResponse?: { data?: unknown; response?: string };
            url?: string;
        }): void => {
            if (item.id === currentItemRef.current) {
                // Try to parse the response as FileMeta (OpenAPI schema)
                let fileMeta: Partial<FileMeta> = {};

                try {
                    // Response may be in different formats
                    if (item.uploadResponse?.data && typeof item.uploadResponse.data === "object") {
                        fileMeta = item.uploadResponse.data as Partial<FileMeta>;
                    } else if (item.uploadResponse?.response) {
                        // Response might be a JSON string
                        const parsed = JSON.parse(item.uploadResponse.response as string) as Partial<FileMeta>;

                        fileMeta = parsed;
                    }
                } catch {
                    // If parsing fails, use fallback values
                }

                // Build UploadResult from FileMeta, with fallbacks
                const uploadResult: UploadResult = {
                    bytesWritten: fileMeta.bytesWritten,
                    contentType: fileMeta.contentType ?? item.file?.type,
                    createdAt: fileMeta.createdAt,
                    filename: fileMeta.originalName ?? item.file?.name, // Alias for compatibility
                    id: fileMeta.id ?? item.id,
                    metadata: fileMeta.metadata,
                    name: fileMeta.name,
                    originalName: fileMeta.originalName ?? item.file?.name,
                    size: fileMeta.size ?? item.file?.size,
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
        const onUploadError = (item: UploadItem): void => {
            if (item.id === currentItemRef.current) {
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
        // Reset state before starting new upload
        setError(undefined);
        setResult(undefined);
        setProgress(0);
        setIsUploading(true);
        currentFileRef.current = file;
        callbacksRef.current.onStart?.();

        return new Promise((resolve, reject) => {
            const { uploader } = uploaderInstance;
            let uploadResult: UploadResult | undefined;
            let resolved = false;
            const currentItemId = currentItemRef.current;
            const fileName = file.name;

            // Handler for upload completion
            const onItemFinish = (item: UploadItem): void => {
                if (!resolved && item.id === currentItemRef.current && item.file.name === file.name) {
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
                    setProgress(100);
                    setResult(uploadResult);
                    setIsUploading(false);
                    callbacksRef.current.onSuccess?.(uploadResult);
                    currentItemRef.current = undefined;
                    resolve(uploadResult);
                }
            };

            // Handler for upload errors
            const onUploadError = (item: UploadItem): void => {
                if (!resolved && item.id === currentItemRef.current && item.file.name === file.name) {
                    const uploadError = new Error(item.error || "Upload failed");

                    resolved = true;
                    cleanup();
                    setError(uploadError);
                    setIsUploading(false);
                    callbacksRef.current.onError?.(uploadError);
                    currentItemRef.current = undefined;
                    reject(uploadError);
                }
            };

            // Set up temporary listeners for this specific upload
            uploader.on("ITEM_FINISH", onItemFinish);
            uploader.on("ITEM_ERROR", onUploadError);

            // Add file to uploader - this will trigger ITEM_START and ITEM_PROGRESS events
            // which are already handled by the permanent listeners in useEffect
            const itemId = uploader.add(file);

            // Store item ID for cleanup
            currentItemRef.current = itemId;

            // Safety timeout - store timeout ID so we can clear it
            let timeoutId: NodeJS.Timeout | undefined;

            // Cleanup function
            const cleanup = (): void => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = undefined;
                }
                uploader.off("ITEM_FINISH", onItemFinish);
                uploader.off("ITEM_ERROR", onUploadError);
            };

            // Set timeout
            timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    const timeoutError = new Error("Upload timeout");

                    setError(timeoutError);
                    setIsUploading(false);
                    callbacksRef.current.onError?.(timeoutError);
                    currentItemRef.current = undefined;
                    reject(timeoutError);
                }
            }, 300_000); // 5 minutes
        });
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
