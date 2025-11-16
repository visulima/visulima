import type { ComputedRef } from "vue";
import { computed } from "vue";

import type { UploadMethod, UploadResult } from "../react/types";
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
    currentMethod: ComputedRef<UploadMethod>;
    /** Last upload error, if any */
    error: ComputedRef<Error | null>;
    /** Whether the upload is paused (TUS only) */
    isPaused: ComputedRef<boolean | undefined>;
    /** Whether an upload is currently in progress */
    isUploading: ComputedRef<boolean>;
    /** Current upload offset in bytes (TUS only) */
    offset: ComputedRef<number | undefined>;
    /** Pause the current upload (TUS only) */
    pause: ComputedRef<(() => void) | undefined>;
    /** Current upload progress (0-100) */
    progress: ComputedRef<number>;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: ComputedRef<UploadResult | null>;
    /** Resume a paused upload (TUS only) */
    resume: ComputedRef<(() => Promise<void>) | undefined>;
    /** Upload a file using the configured method */
    upload: (file: File) => Promise<UploadResult>;
}

const DEFAULT_TUS_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * Vue composable for file uploads with automatic method selection
 * Uses rpldy uploader core for multipart, falls back to custom TUS implementation
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
    const detectedMethod = computed<UploadMethod>(() => {
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
    });

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

    const multipartUpload = multipartOptions ? useMultipartUpload(multipartOptions) : null;
    const tusUpload = tusOptions ? useTusUpload(tusOptions) : null;

    const determineMethod = (file: File): UploadMethod => {
        if (detectedMethod.value !== "auto") {
            return detectedMethod.value;
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
    };

    const upload = async (file: File): Promise<UploadResult> => {
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
    };

    const abort = (): void => {
        tusUpload?.abort();
        multipartUpload?.reset();
    };

    const reset = (): void => {
        tusUpload?.reset();
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

        // If multipart is uploading or has result, it's being used
        if (multipartUpload && (multipartUpload.isUploading.value || multipartUpload.result.value)) {
            return "multipart";
        }

        // Default based on available endpoints
        if (endpointTus && endpointMultipart) {
            return "multipart"; // Default to multipart when both available
        }

        return endpointTus ? "tus" : "multipart";
    });

    return {
        abort,
        currentMethod,
        error: computed(() => currentMethod.value === "tus" ? (tusUpload?.error.value ?? null) : (multipartUpload?.error.value ?? null)),
        isPaused: computed(() => currentMethod.value === "tus" ? tusUpload?.isPaused.value : undefined),
        isUploading: computed(() => currentMethod.value === "tus" ? (tusUpload?.isUploading.value ?? false) : (multipartUpload?.isUploading.value ?? false)),
        offset: computed(() => currentMethod.value === "tus" ? tusUpload?.offset.value : undefined),
        pause: computed(() => currentMethod.value === "tus" ? tusUpload?.pause : undefined),
        progress: computed(() => currentMethod.value === "tus" ? (tusUpload?.progress.value ?? 0) : (multipartUpload?.progress.value ?? 0)),
        reset,
        result: computed(() => currentMethod.value === "tus" ? (tusUpload?.result.value ?? null) : (multipartUpload?.result.value ?? null)),
        resume: computed(() => currentMethod.value === "tus" ? tusUpload?.resume : undefined),
        upload,
    };
};
