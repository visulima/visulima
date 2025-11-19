import { useCallback, useMemo } from "react";

import type { UploadMethod, UploadResult } from "./types";
import type { UseChunkedRestUploadOptions } from "./use-chunked-rest-upload";
import { useChunkedRestUpload } from "./use-chunked-rest-upload";
import type { UseMultipartUploadOptions } from "./use-multipart-upload";
import { useMultipartUpload } from "./use-multipart-upload";
import type { UseTusUploadOptions } from "./use-tus-upload";
import { useTusUpload } from "./use-tus-upload";

export interface UseUploadOptions {
    /** Chunk size for TUS and chunked REST uploads (default: 1MB for TUS, 5MB for chunked REST) */
    chunkSize?: number;
    /** Chunked REST upload endpoint URL */
    endpointChunkedRest?: string;
    /** Multipart upload endpoint URL */
    endpointMultipart?: string;
    /** TUS upload endpoint URL */
    endpointTus?: string;
    /** Maximum number of retry attempts (TUS and chunked REST only) */
    maxRetries?: number;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Upload method to use: 'multipart', 'tus', 'chunked-rest', or 'auto'. If undefined, auto-detected based on provided endpoints */
    method?: UploadMethod;
    /** Callback when upload fails */
    onError?: (error: Error) => void;
    /** Callback when upload is paused (TUS and chunked REST only) */
    onPause?: () => void;
    /** Callback when upload progress updates */
    onProgress?: (progress: number) => void;
    /** Callback when upload is resumed (TUS and chunked REST only) */
    onResume?: () => void;
    /** Callback when upload starts */
    onStart?: () => void;
    /** Callback when upload completes successfully */
    onSuccess?: (file: UploadResult) => void;
    /** Enable automatic retry on failure (TUS and chunked REST only) */
    retry?: boolean;
    /** File size threshold for auto-selecting TUS (default: 10MB) */
    tusThreshold?: number;
}

export interface UseUploadReturn {
    /** Abort the current upload */
    abort: () => void;
    /** Current upload method being used */
    currentMethod: UploadMethod;
    /** Last upload error, if any */
    error: Error | null;
    /** Whether the upload is paused (TUS and chunked REST only) */
    isPaused?: boolean;
    /** Whether an upload is currently in progress */
    isUploading: boolean;
    /** Current upload offset in bytes (TUS and chunked REST only) */
    offset?: number;
    /** Pause the current upload (TUS and chunked REST only) */
    pause?: () => void;
    /** Current upload progress (0-100) */
    progress: number;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: UploadResult | null;
    /** Resume a paused upload (TUS and chunked REST only) */
    resume?: () => Promise<void>;
    /** Upload a file using the configured method */
    upload: (file: File) => Promise<UploadResult>;
}

const DEFAULT_TUS_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * React hook for file uploads with automatic method selection
 * Uses custom uploader implementations for multipart, TUS, and chunked REST
 * Automatically chooses between methods based on file size and method preference
 * @param options Upload configuration options
 * @returns Upload functions and state
 */
export const useUpload = (options: UseUploadOptions): UseUploadReturn => {
    const {
        chunkSize,
        endpointChunkedRest,
        endpointMultipart,
        endpointTus,
        maxRetries,
        metadata,
        method,
        onError,
        onPause,
        onProgress,
        onResume,
        onStart,
        onSuccess,
        retry,
        tusThreshold = DEFAULT_TUS_THRESHOLD,
    } = options;

    // Auto-detect method based on provided endpoints if method is undefined
    const detectedMethod: UploadMethod = useMemo(() => {
        if (method !== undefined) {
            return method;
        }

        const endpoints = [endpointChunkedRest, endpointMultipart, endpointTus].filter(Boolean);

        // If only one endpoint is provided, use that method
        if (endpoints.length === 1) {
            if (endpointChunkedRest) {
                return "chunked-rest";
            }

            if (endpointTus) {
                return "tus";
            }

            return "multipart";
        }

        // If multiple endpoints are provided, use auto selection
        if (endpoints.length > 1) {
            return "auto";
        }

        // If none are provided, throw error
        throw new Error("At least one endpoint must be provided: endpointChunkedRest, endpointMultipart, or endpointTus");
    }, [method, endpointChunkedRest, endpointMultipart, endpointTus]);

    const chunkedRestOptions: UseChunkedRestUploadOptions | undefined = useMemo(() => {
        if (!endpointChunkedRest) {
            return undefined;
        }

        return {
            chunkSize,
            endpoint: endpointChunkedRest,
            maxRetries,
            metadata,
            onError,
            onPause,
            onProgress,
            onResume,
            onStart,
            onSuccess,
            retry,
        };
    }, [endpointChunkedRest, chunkSize, metadata, onStart, onSuccess, onError, onProgress, onPause, onResume, retry, maxRetries]);

    const multipartOptions: UseMultipartUploadOptions | undefined = useMemo(() => {
        if (!endpointMultipart) {
            return undefined;
        }

        return {
            endpoint: endpointMultipart,
            metadata,
            onError,
            onProgress,
            onStart,
            onSuccess,
        };
    }, [endpointMultipart, metadata, onStart, onSuccess, onError, onProgress]);

    const tusOptions: UseTusUploadOptions | undefined = useMemo(() => {
        if (!endpointTus) {
            return undefined;
        }

        return {
            chunkSize,
            endpoint: endpointTus,
            maxRetries,
            metadata,
            onError,
            onPause,
            onProgress,
            onResume,
            onStart,
            onSuccess,
            retry,
        };
    }, [endpointTus, chunkSize, metadata, onStart, onSuccess, onError, onProgress, onPause, onResume, retry, maxRetries]);

    const chunkedRestUpload = chunkedRestOptions ? useChunkedRestUpload(chunkedRestOptions) : null;
    const multipartUpload = multipartOptions ? useMultipartUpload(multipartOptions) : null;
    const tusUpload = tusOptions ? useTusUpload(tusOptions) : null;

    const determineMethod = useCallback(
        (file: File): UploadMethod => {
            if (detectedMethod !== "auto") {
                return detectedMethod;
            }

            // Auto-select TUS or chunked REST for large files
            if (file.size > tusThreshold) {
                if (endpointTus) {
                    return "tus";
                }

                if (endpointChunkedRest) {
                    return "chunked-rest";
                }
            }

            // Prefer chunked REST for medium files if available
            if (endpointChunkedRest) {
                return "chunked-rest";
            }

            // Fallback to multipart if available
            if (endpointMultipart) {
                return "multipart";
            }

            throw new Error("No available endpoint for upload");
        },
        [detectedMethod, tusThreshold, endpointChunkedRest, endpointMultipart, endpointTus],
    );

    const upload = useCallback(
        async (file: File): Promise<UploadResult> => {
            const selectedMethod = determineMethod(file);

            if (selectedMethod === "tus") {
                if (!tusUpload) {
                    throw new Error("TUS endpoint not configured");
                }

                return tusUpload.upload(file);
            }

            if (selectedMethod === "chunked-rest") {
                if (!chunkedRestUpload) {
                    throw new Error("Chunked REST endpoint not configured");
                }

                return chunkedRestUpload.upload(file);
            }

            if (!multipartUpload) {
                throw new Error("Multipart endpoint not configured");
            }

            return multipartUpload.upload(file);
        },
        [determineMethod, tusUpload, chunkedRestUpload, multipartUpload],
    );

    const abort = useCallback((): void => {
        tusUpload?.abort();
        chunkedRestUpload?.abort();
        multipartUpload?.reset();
    }, [tusUpload, chunkedRestUpload, multipartUpload]);

    const reset = useCallback((): void => {
        tusUpload?.reset();
        chunkedRestUpload?.reset();
        multipartUpload?.reset();
    }, [tusUpload, chunkedRestUpload, multipartUpload]);

    // Determine current method based on which hook is active
    const currentMethod: UploadMethod = useMemo(() => {
        if (detectedMethod !== "auto") {
            return detectedMethod;
        }

        // If TUS is uploading or has result, it's being used
        if (tusUpload && (tusUpload.isUploading || tusUpload.result)) {
            return "tus";
        }

        // If chunked REST is uploading or has result, it's being used
        if (chunkedRestUpload && (chunkedRestUpload.isUploading || chunkedRestUpload.result)) {
            return "chunked-rest";
        }

        // If multipart is uploading or has result, it's being used
        if (multipartUpload && (multipartUpload.isUploading || multipartUpload.result)) {
            return "multipart";
        }

        // Default based on available endpoints (priority: chunked-rest > tus > multipart)
        if (endpointChunkedRest) {
            return "chunked-rest";
        }

        if (endpointTus) {
            return "tus";
        }

        return "multipart";
    }, [detectedMethod, tusUpload, chunkedRestUpload, multipartUpload, endpointChunkedRest, endpointMultipart, endpointTus]);

    return {
        abort,
        currentMethod,
        error:
            currentMethod === "tus"
                ? tusUpload?.error ?? null
                : currentMethod === "chunked-rest"
                    ? chunkedRestUpload?.error ?? null
                    : multipartUpload?.error ?? null,
        isPaused: currentMethod === "tus" ? tusUpload?.isPaused : currentMethod === "chunked-rest" ? chunkedRestUpload?.isPaused : undefined,
        isUploading:
            currentMethod === "tus"
                ? tusUpload?.isUploading ?? false
                : currentMethod === "chunked-rest"
                    ? chunkedRestUpload?.isUploading ?? false
                    : multipartUpload?.isUploading ?? false,
        offset: currentMethod === "tus" ? tusUpload?.offset : currentMethod === "chunked-rest" ? chunkedRestUpload?.offset : undefined,
        pause: currentMethod === "tus" ? tusUpload?.pause : currentMethod === "chunked-rest" ? chunkedRestUpload?.pause : undefined,
        progress:
            currentMethod === "tus"
                ? tusUpload?.progress ?? 0
                : currentMethod === "chunked-rest"
                    ? chunkedRestUpload?.progress ?? 0
                    : multipartUpload?.progress ?? 0,
        reset,
        result:
            currentMethod === "tus"
                ? tusUpload?.result ?? null
                : currentMethod === "chunked-rest"
                    ? chunkedRestUpload?.result ?? null
                    : multipartUpload?.result ?? null,
        resume: currentMethod === "tus" ? tusUpload?.resume : currentMethod === "chunked-rest" ? chunkedRestUpload?.resume : undefined,
        upload,
    };
};
