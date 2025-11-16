import { useCallback, useMemo } from "react";

import type { UploadMethod, UploadResult } from "./types";
import type { UseMultipartUploadOptions } from "./use-multipart-upload";
import { useMultipartUpload } from "./use-multipart-upload";
import type { UseTusUploadOptions } from "./use-tus-upload";
import { useTusUpload } from "./use-tus-upload";

export interface UseUploadOptions {
    /** Chunk size for TUS uploads (default: 1MB) */
    chunkSize?: number;
    /** Multipart upload endpoint URL */
    endpointMultipart?: string;
    /** TUS upload endpoint URL */
    endpointTus?: string;
    /** Maximum number of retry attempts (TUS only) */
    maxRetries?: number;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Upload method to use: 'multipart', 'tus', or 'auto'. If undefined, auto-detected based on provided endpoints */
    method?: UploadMethod;
    /** Callback when upload fails */
    onError?: (error: Error) => void;
    /** Callback when upload is paused (TUS only) */
    onPause?: () => void;
    /** Callback when upload progress updates */
    onProgress?: (progress: number) => void;
    /** Callback when upload is resumed (TUS only) */
    onResume?: () => void;
    /** Callback when upload starts */
    onStart?: () => void;
    /** Callback when upload completes successfully */
    onSuccess?: (file: UploadResult) => void;
    /** Enable automatic retry on failure (TUS only) */
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
    /** Whether the upload is paused (TUS only) */
    isPaused?: boolean;
    /** Whether an upload is currently in progress */
    isUploading: boolean;
    /** Current upload offset in bytes (TUS only) */
    offset?: number;
    /** Pause the current upload (TUS only) */
    pause?: () => void;
    /** Current upload progress (0-100) */
    progress: number;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: UploadResult | null;
    /** Resume a paused upload (TUS only) */
    resume?: () => Promise<void>;
    /** Upload a file using the configured method */
    upload: (file: File) => Promise<UploadResult>;
}

const DEFAULT_TUS_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * React hook for file uploads with automatic method selection
 * Uses custom uploader implementations for both multipart and TUS
 * Automatically chooses between multipart and TUS based on file size and method preference
 * @param options Upload configuration options
 * @returns Upload functions and state
 */
export const useUpload = (options: UseUploadOptions): UseUploadReturn => {
    const {
        chunkSize,
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

        // If only multipart endpoint is provided, use multipart
        if (endpointMultipart && !endpointTus) {
            return "multipart";
        }

        // If only TUS endpoint is provided, use TUS
        if (endpointTus && !endpointMultipart) {
            return "tus";
        }

        // If both are provided, use auto selection
        if (endpointMultipart && endpointTus) {
            return "auto";
        }

        // If neither is provided, throw error
        throw new Error("At least one endpoint must be provided: endpointMultipart or endpointTus");
    }, [method, endpointMultipart, endpointTus]);

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

    const multipartUpload = multipartOptions ? useMultipartUpload(multipartOptions) : null;
    const tusUpload = tusOptions ? useTusUpload(tusOptions) : null;

    const determineMethod = useCallback(
        (file: File): UploadMethod => {
            if (detectedMethod !== "auto") {
                return detectedMethod;
            }

            // Auto-select TUS for large files, but only if TUS endpoint is available
            if (file.size > tusThreshold && endpointTus) {
                return "tus";
            }

            // Fallback to multipart if available
            if (endpointMultipart) {
                return "multipart";
            }

            throw new Error("No available endpoint for upload");
        },
        [detectedMethod, tusThreshold, endpointMultipart, endpointTus],
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

            if (!multipartUpload) {
                throw new Error("Multipart endpoint not configured");
            }

            return multipartUpload.upload(file);
        },
        [determineMethod, tusUpload, multipartUpload],
    );

    const abort = useCallback((): void => {
        tusUpload?.abort();
        multipartUpload?.reset();
    }, [tusUpload, multipartUpload]);

    const reset = useCallback((): void => {
        tusUpload?.reset();
        multipartUpload?.reset();
    }, [tusUpload, multipartUpload]);

    // Determine current method based on which hook is active
    const currentMethod: UploadMethod = useMemo(() => {
        if (detectedMethod !== "auto") {
            return detectedMethod;
        }

        // If TUS is uploading or has result, it's being used
        if (tusUpload && (tusUpload.isUploading || tusUpload.result)) {
            return "tus";
        }

        // If multipart is uploading or has result, it's being used
        if (multipartUpload && (multipartUpload.isUploading || multipartUpload.result)) {
            return "multipart";
        }

        // Default based on available endpoints
        if (endpointTus && endpointMultipart) {
            return "multipart"; // Default to multipart when both available
        }

        return endpointTus ? "tus" : "multipart";
    }, [detectedMethod, tusUpload, multipartUpload, endpointMultipart, endpointTus]);

    return {
        abort,
        currentMethod,
        error: currentMethod === "tus" ? tusUpload?.error ?? null : multipartUpload?.error ?? null,
        isPaused: currentMethod === "tus" ? tusUpload?.isPaused : undefined,
        isUploading: currentMethod === "tus" ? tusUpload?.isUploading ?? false : multipartUpload?.isUploading ?? false,
        offset: currentMethod === "tus" ? tusUpload?.offset : undefined,
        pause: currentMethod === "tus" ? tusUpload?.pause : undefined,
        progress: currentMethod === "tus" ? tusUpload?.progress ?? 0 : multipartUpload?.progress ?? 0,
        reset,
        result: currentMethod === "tus" ? tusUpload?.result ?? null : multipartUpload?.result ?? null,
        resume: currentMethod === "tus" ? tusUpload?.resume : undefined,
        upload,
    };
};
