import type { Readable } from "svelte/store";
import { derived } from "svelte/store";

import type { UploadMethod, UploadResult } from "../react/types";
import type { CreateChunkedRestUploadOptions } from "./create-chunked-rest-upload";
import { createChunkedRestUpload } from "./create-chunked-rest-upload";
import type { CreateMultipartUploadOptions } from "./create-multipart-upload";
import { createMultipartUpload } from "./create-multipart-upload";
import type { CreateTusUploadOptions } from "./create-tus-upload";
import { createTusUpload } from "./create-tus-upload";

export interface CreateUploadOptions {
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

export interface CreateUploadReturn {
    /** Abort the current upload */
    abort: () => void;
    /** Current upload method being used */
    currentMethod: Readable<UploadMethod>;
    /** Last upload error, if any */
    error: Readable<Error | null>;
    /** Whether the upload is paused (TUS and chunked REST only) */
    isPaused: Readable<boolean | undefined>;
    /** Whether an upload is currently in progress */
    isUploading: Readable<boolean>;
    /** Current upload offset in bytes (TUS and chunked REST only) */
    offset: Readable<number | undefined>;
    /** Pause the current upload (TUS and chunked REST only) */
    pause: Readable<(() => void) | undefined>;
    /** Current upload progress (0-100) */
    progress: Readable<number>;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: Readable<UploadResult | null>;
    /** Resume a paused upload (TUS and chunked REST only) */
    resume: Readable<(() => Promise<void>) | undefined>;
    /** Upload a file using the configured method */
    upload: (file: File) => Promise<UploadResult>;
}

const DEFAULT_TUS_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * Svelte store-based utility for file uploads with automatic method selection
 * Uses custom uploader implementations for multipart, TUS, and chunked REST
 * Automatically chooses between methods based on file size and method preference
 * @param options Upload configuration options
 * @returns Upload functions and state stores
 */
export const createUpload = (options: CreateUploadOptions): CreateUploadReturn => {
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
    let detectedMethod: UploadMethod;

    if (method === undefined) {
        const endpoints = [endpointChunkedRest, endpointMultipart, endpointTus].filter(Boolean);

        // If only one endpoint is provided, use that method
        if (endpoints.length === 1) {
            if (endpointChunkedRest) {
                detectedMethod = "chunked-rest";
            } else if (endpointTus) {
                detectedMethod = "tus";
            } else {
                detectedMethod = "multipart";
            }
        } else if (endpoints.length > 1) {
            // If multiple endpoints are provided, use auto selection
            detectedMethod = "auto";
        } else {
            // If none are provided, throw error
            throw new Error("At least one endpoint must be provided: endpointChunkedRest, endpointMultipart, or endpointTus");
        }
    } else {
        detectedMethod = method;
    }

    const chunkedRestOptions: CreateChunkedRestUploadOptions | undefined = endpointChunkedRest
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

    const chunkedRestUpload = chunkedRestOptions ? createChunkedRestUpload(chunkedRestOptions) : null;
    const multipartUpload = multipartOptions ? createMultipartUpload(multipartOptions) : null;
    const tusUpload = tusOptions ? createTusUpload(tusOptions) : null;

    const determineMethod = (file: File): UploadMethod => {
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

    // Determine current method based on which store is active
    const currentMethod = derived(
        [
            tusUpload?.isUploading ?? { subscribe: () => () => {} },
            tusUpload?.result ?? { subscribe: () => () => {} },
            chunkedRestUpload?.isUploading ?? { subscribe: () => () => {} },
            chunkedRestUpload?.result ?? { subscribe: () => () => {} },
            multipartUpload?.isUploading ?? { subscribe: () => () => {} },
            multipartUpload?.result ?? { subscribe: () => () => {} },
        ],
        ([tusIsUploading, tusResult, chunkedRestIsUploading, chunkedRestResult, multipartIsUploading, multipartResult]) => {
            if (detectedMethod !== "auto") {
                return detectedMethod;
            }

            // If TUS is uploading or has result, it's being used
            if (tusUpload && (tusIsUploading || tusResult)) {
                return "tus";
            }

            // If chunked REST is uploading or has result, it's being used
            if (chunkedRestUpload && (chunkedRestIsUploading || chunkedRestResult)) {
                return "chunked-rest";
            }

            // If multipart is uploading or has result, it's being used
            if (multipartUpload && (multipartIsUploading || multipartResult)) {
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
        },
    );

    // Create derived stores for reactive values
    const error = derived(
        [
            currentMethod,
            tusUpload?.error ?? { subscribe: () => () => {} },
            chunkedRestUpload?.error ?? { subscribe: () => () => {} },
            multipartUpload?.error ?? { subscribe: () => () => {} },
        ],
        ([current, tusError, chunkedRestError, multipartError]) =>
            (current === "tus" ? tusError : current === "chunked-rest" ? chunkedRestError : (multipartError ?? null)),
    );
    const isPaused = derived(
        [currentMethod, tusUpload?.isPaused ?? { subscribe: () => () => {} }, chunkedRestUpload?.isPaused ?? { subscribe: () => () => {} }],
        ([current, tusPaused, chunkedRestPaused]) => current === "tus" ? tusPaused : current === "chunked-rest" ? chunkedRestPaused : undefined,
    );
    const isUploading = derived(
        [
            currentMethod,
            tusUpload?.isUploading ?? { subscribe: () => () => {} },
            chunkedRestUpload?.isUploading ?? { subscribe: () => () => {} },
            multipartUpload?.isUploading ?? { subscribe: () => () => {} },
        ],
        ([current, tusIsUploading, chunkedRestIsUploading, multipartIsUploading]) =>
            (current === "tus" ? (tusIsUploading ?? false) : current === "chunked-rest" ? (chunkedRestIsUploading ?? false) : (multipartIsUploading ?? false)),
    );
    const offset = derived(
        [currentMethod, tusUpload?.offset ?? { subscribe: () => () => {} }, chunkedRestUpload?.offset ?? { subscribe: () => () => {} }],
        ([current, tusOffset, chunkedRestOffset]) => current === "tus" ? tusOffset : current === "chunked-rest" ? chunkedRestOffset : undefined,
    );
    const progress = derived(
        [
            currentMethod,
            tusUpload?.progress ?? { subscribe: () => () => {} },
            chunkedRestUpload?.progress ?? { subscribe: () => () => {} },
            multipartUpload?.progress ?? { subscribe: () => () => {} },
        ],
        ([current, tusProgress, chunkedRestProgress, multipartProgress]) =>
            (current === "tus" ? (tusProgress ?? 0) : current === "chunked-rest" ? (chunkedRestProgress ?? 0) : (multipartProgress ?? 0)),
    );
    const result = derived(
        [
            currentMethod,
            tusUpload?.result ?? { subscribe: () => () => {} },
            chunkedRestUpload?.result ?? { subscribe: () => () => {} },
            multipartUpload?.result ?? { subscribe: () => () => {} },
        ],
        ([current, tusRes, chunkedRestRes, multipartRes]) =>
            (current === "tus" ? (tusRes ?? null) : current === "chunked-rest" ? (chunkedRestRes ?? null) : (multipartRes ?? null)),
    );

    // Create derived stores for functions (they return functions based on current method)
    const pause: Readable<(() => void) | undefined> = derived(
        [currentMethod],
        ([current]) => (current === "tus" ? tusUpload?.pause : current === "chunked-rest" ? chunkedRestUpload?.pause : undefined) as (() => void) | undefined,
    );
    const resume: Readable<(() => Promise<void>) | undefined> = derived(
        [currentMethod],
        ([current]) =>
            (current === "tus" ? tusUpload?.resume : current === "chunked-rest" ? chunkedRestUpload?.resume : undefined) as (() => Promise<void>) | undefined,
    );

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
