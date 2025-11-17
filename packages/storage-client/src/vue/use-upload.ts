import type { ComputedRef } from "vue";
import { computed } from "vue";

import type { UploadMethod, UploadResult } from "../react/types";
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
    currentMethod: ComputedRef<UploadMethod>;
    /** Last upload error, if any */
    error: ComputedRef<Error | null>;
    /** Whether the upload is paused (TUS and chunked REST only) */
    isPaused: ComputedRef<boolean | undefined>;
    /** Whether an upload is currently in progress */
    isUploading: ComputedRef<boolean>;
    /** Current upload offset in bytes (TUS and chunked REST only) */
    offset: ComputedRef<number | undefined>;
    /** Pause the current upload (TUS and chunked REST only) */
    pause: ComputedRef<(() => void) | undefined>;
    /** Current upload progress (0-100) */
    progress: ComputedRef<number>;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: ComputedRef<UploadResult | null>;
    /** Resume a paused upload (TUS and chunked REST only) */
    resume: ComputedRef<(() => Promise<void>) | undefined>;
    /** Upload a file using the configured method */
    upload: (file: File) => Promise<UploadResult>;
}

const DEFAULT_TUS_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * Vue composable for file uploads with automatic method selection
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
    const detectedMethod = computed<UploadMethod>(() => {
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
    });

    const chunkedRestOptions: UseChunkedRestUploadOptions | undefined = endpointChunkedRest
        ? {
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
        }
        : undefined;

    const multipartOptions: UseMultipartUploadOptions | undefined = endpointMultipart
        ? {
            endpoint: endpointMultipart,
            metadata,
            onError,
            onProgress,
            onStart,
            onSuccess,
        }
        : undefined;

    const tusOptions: UseTusUploadOptions | undefined = endpointTus
        ? {
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
        }
        : undefined;

    const chunkedRestUpload = chunkedRestOptions ? useChunkedRestUpload(chunkedRestOptions) : null;
    const multipartUpload = multipartOptions ? useMultipartUpload(multipartOptions) : null;
    const tusUpload = tusOptions ? useTusUpload(tusOptions) : null;

    const determineMethod = (file: File): UploadMethod => {
        if (detectedMethod.value !== "auto") {
            return detectedMethod.value;
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
    };

    const upload = async (file: File): Promise<UploadResult> => {
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
    };

    const abort = (): void => {
        tusUpload?.abort();
        chunkedRestUpload?.abort();
        multipartUpload?.reset();
    };

    const reset = (): void => {
        tusUpload?.reset();
        chunkedRestUpload?.reset();
        multipartUpload?.reset();
    };

    // Determine current method based on which composable is active
    const currentMethod = computed<UploadMethod>(() => {
        if (detectedMethod.value !== "auto") {
            return detectedMethod.value;
        }

        // If TUS is uploading or has result, it's being used
        if (tusUpload && (tusUpload.isUploading.value || tusUpload.result.value)) {
            return "tus";
        }

        // If chunked REST is uploading or has result, it's being used
        if (chunkedRestUpload && (chunkedRestUpload.isUploading.value || chunkedRestUpload.result.value)) {
            return "chunked-rest";
        }

        // If multipart is uploading or has result, it's being used
        if (multipartUpload && (multipartUpload.isUploading.value || multipartUpload.result.value)) {
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
    });

    return {
        abort,
        currentMethod,
        error: computed(() =>
            (currentMethod.value === "tus"
                ? (tusUpload?.error.value ?? null)
                : currentMethod.value === "chunked-rest"
                  ? (chunkedRestUpload?.error.value ?? null)
                  : (multipartUpload?.error.value ?? null)),
        ),
        isPaused: computed(() =>
            (currentMethod.value === "tus" ? tusUpload?.isPaused.value : currentMethod.value === "chunked-rest" ? chunkedRestUpload?.isPaused.value : undefined),
        ),
        isUploading: computed(() =>
            (currentMethod.value === "tus"
                ? (tusUpload?.isUploading.value ?? false)
                : currentMethod.value === "chunked-rest"
                  ? (chunkedRestUpload?.isUploading.value ?? false)
                  : (multipartUpload?.isUploading.value ?? false)),
        ),
        offset: computed(() =>
            (currentMethod.value === "tus" ? tusUpload?.offset.value : currentMethod.value === "chunked-rest" ? chunkedRestUpload?.offset.value : undefined),
        ),
        pause: computed(() =>
            (currentMethod.value === "tus" ? tusUpload?.pause : currentMethod.value === "chunked-rest" ? chunkedRestUpload?.pause : undefined),
        ),
        progress: computed(() =>
            (currentMethod.value === "tus"
                ? (tusUpload?.progress.value ?? 0)
                : currentMethod.value === "chunked-rest"
                  ? (chunkedRestUpload?.progress.value ?? 0)
                  : (multipartUpload?.progress.value ?? 0)),
        ),
        reset,
        result: computed(() =>
            (currentMethod.value === "tus"
                ? (tusUpload?.result.value ?? null)
                : currentMethod.value === "chunked-rest"
                  ? (chunkedRestUpload?.result.value ?? null)
                  : (multipartUpload?.result.value ?? null)),
        ),
        resume: computed(() =>
            (currentMethod.value === "tus" ? tusUpload?.resume : currentMethod.value === "chunked-rest" ? chunkedRestUpload?.resume : undefined),
        ),
        upload,
    };
};
