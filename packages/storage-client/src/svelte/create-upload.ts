import type { Readable } from "svelte/store";
import { derived } from "svelte/store";

import type { UploadMethod, UploadResult } from "../react/types";
import type { CreateMultipartUploadOptions } from "./create-multipart-upload";
import { createMultipartUpload } from "./create-multipart-upload";
import type { CreateTusUploadOptions } from "./create-tus-upload";
import { createTusUpload } from "./create-tus-upload";

export interface CreateUploadOptions {
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

export interface CreateUploadReturn {
    /** Abort the current upload */
    abort: () => void;
    /** Current upload method being used */
    currentMethod: Readable<UploadMethod>;
    /** Last upload error, if any */
    error: Readable<Error | null>;
    /** Whether the upload is paused (TUS only) */
    isPaused: Readable<boolean | undefined>;
    /** Whether an upload is currently in progress */
    isUploading: Readable<boolean>;
    /** Current upload offset in bytes (TUS only) */
    offset: Readable<number | undefined>;
    /** Pause the current upload (TUS only) */
    pause: Readable<(() => void) | undefined>;
    /** Current upload progress (0-100) */
    progress: Readable<number>;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: Readable<UploadResult | null>;
    /** Resume a paused upload (TUS only) */
    resume: Readable<(() => Promise<void>) | undefined>;
    /** Upload a file using the configured method */
    upload: (file: File) => Promise<UploadResult>;
}

const DEFAULT_TUS_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * Svelte store-based utility for file uploads with automatic method selection
 * Uses rpldy uploader core for multipart, falls back to custom TUS implementation
 * Automatically chooses between multipart and TUS based on file size and method preference
 * @param options Upload configuration options
 * @returns Upload functions and state stores
 */
export const createUpload = (options: CreateUploadOptions): CreateUploadReturn => {
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
    let detectedMethod: UploadMethod;

    if (method !== undefined) {
        detectedMethod = method;
    } else if (endpointMultipart && !endpointTus) {
        // If only multipart endpoint is provided, use multipart
        detectedMethod = "multipart";
    } else if (endpointTus && !endpointMultipart) {
        // If only TUS endpoint is provided, use TUS
        detectedMethod = "tus";
    } else if (endpointMultipart && endpointTus) {
        // If both are provided, use auto selection
        detectedMethod = "auto";
    } else {
        // If neither is provided, throw error
        throw new Error("At least one endpoint must be provided: endpointMultipart or endpointTus");
    }

    const multipartOptions: CreateMultipartUploadOptions | undefined = endpointMultipart
        ? {
            endpoint: endpointMultipart,
            metadata,
            onError,
            onProgress,
            onStart,
            onSuccess,
        }
        : undefined;

    const tusOptions: CreateTusUploadOptions | undefined = endpointTus
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

    const multipartUpload = multipartOptions ? createMultipartUpload(multipartOptions) : null;
    const tusUpload = tusOptions ? createTusUpload(tusOptions) : null;

    const determineMethod = (file: File): UploadMethod => {
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

    // Determine current method based on which store is active
    const currentMethod = derived(
        [
            tusUpload?.isUploading ?? { subscribe: () => () => {} },
            tusUpload?.result ?? { subscribe: () => () => {} },
            multipartUpload?.isUploading ?? { subscribe: () => () => {} },
            multipartUpload?.result ?? { subscribe: () => () => {} },
        ],
        ([tusIsUploading, tusResult, multipartIsUploading, multipartResult]) => {
            if (detectedMethod !== "auto") {
                return detectedMethod;
            }

            // If TUS is uploading or has result, it's being used
            if (tusUpload && (tusIsUploading || tusResult)) {
                return "tus";
            }

            // If multipart is uploading or has result, it's being used
            if (multipartUpload && (multipartIsUploading || multipartResult)) {
                return "multipart";
            }

            // Default based on available endpoints
            if (endpointTus && endpointMultipart) {
                return "multipart"; // Default to multipart when both available
            }

            return endpointTus ? "tus" : "multipart";
        },
    );

    // Create derived stores for reactive values
    const error = derived(
        [currentMethod, tusUpload?.error ?? { subscribe: () => () => {} }, multipartUpload?.error ?? { subscribe: () => () => {} }],
        ([current, tusError, multipartError]) => current === "tus" ? tusError : (multipartError ?? null),
    );
    const isPaused = derived([currentMethod, tusUpload?.isPaused ?? { subscribe: () => () => {} }], ([current, tusPaused]) =>
        (current === "tus" ? tusPaused : undefined),
    );
    const isUploading = derived(
        [currentMethod, tusUpload?.isUploading ?? { subscribe: () => () => {} }, multipartUpload?.isUploading ?? { subscribe: () => () => {} }],
        ([current, tusIsUploading, multipartIsUploading]) => current === "tus" ? (tusIsUploading ?? false) : (multipartIsUploading ?? false),
    );
    const offset = derived([currentMethod, tusUpload?.offset ?? { subscribe: () => () => {} }], ([current, tusOffset]) =>
        (current === "tus" ? tusOffset : undefined),
    );
    const progress = derived(
        [currentMethod, tusUpload?.progress ?? { subscribe: () => () => {} }, multipartUpload?.progress ?? { subscribe: () => () => {} }],
        ([current, tusProgress, multipartProgress]) => current === "tus" ? (tusProgress ?? 0) : (multipartProgress ?? 0),
    );
    const result = derived(
        [currentMethod, tusUpload?.result ?? { subscribe: () => () => {} }, multipartUpload?.result ?? { subscribe: () => () => {} }],
        ([current, tusRes, multipartRes]) => current === "tus" ? (tusRes ?? null) : (multipartRes ?? null),
    );

    // Create derived stores for functions (they return functions based on current method)
    const pause = derived([currentMethod], ([current]) => current === "tus" ? tusUpload?.pause : undefined);
    const resume = derived([currentMethod], ([current]) => current === "tus" ? tusUpload?.resume : undefined);

    return {
        abort,
        currentMethod,
        error,
        isPaused,
        isUploading,
        offset,
        pause,
        progress,
        reset,
        result,
        resume,
        upload,
    };
};
