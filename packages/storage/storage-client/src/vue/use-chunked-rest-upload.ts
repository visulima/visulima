import type { Ref } from "vue";
import { onBeforeUnmount, onMounted, ref } from "vue";

import { createChunkedRestAdapter } from "../core/chunked-rest-adapter";
import type { FingerprintFn } from "../core/fingerprint";
import type { UploadControl } from "../core/upload-control";
import type { UrlStorage } from "../core/url-storage";
import type { UploadResult } from "../react/types";

export interface UseChunkedRestUploadOptions {
    /** Chunk size for chunked REST uploads (default: 5MB) */
    chunkSize?: number;
    /** Unified control handle. See `UploadControl`. */
    control?: UploadControl;
    /** Chunked REST upload endpoint URL */
    endpoint: string;
    /** Customise the resume fingerprint. */
    fingerprint?: FingerprintFn;
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when upload fails */
    onError?: (error: Error) => void;
    /** Callback when upload is paused */
    onPause?: () => void;
    /** Callback when upload progress updates */
    onProgress?: (progress: number, offset: number) => void;
    /** Callback when upload is resumed */
    onResume?: () => void;
    /** Callback when upload starts */
    onStart?: () => void;
    /** Callback when upload completes successfully */
    onSuccess?: (file: UploadResult) => void;
    /** Enable automatic retry on failure */
    retry?: boolean;
    /** Persistent storage for resume identifiers. */
    urlStorage?: UrlStorage;
}

export interface UseChunkedRestUploadReturn {
    /** Abort the current upload */
    abort: () => void;
    /** Last upload error, if any */
    error: Ref<Error | undefined>;
    /** Whether the upload is paused */
    isPaused: Ref<boolean>;
    /** Whether an upload is currently in progress */
    isUploading: Ref<boolean>;
    /** Current upload offset (bytes uploaded) */
    offset: Ref<number>;
    /** Pause the current upload */
    pause: () => void;
    /** Current upload progress (0-100) */
    progress: Ref<number>;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: Ref<UploadResult | undefined>;
    /** Resume a paused upload */
    resume: () => Promise<void>;
    /** Upload a file using chunked REST protocol */
    upload: (file: File) => Promise<UploadResult>;
}

/**
 * Vue composable for chunked REST file uploads.
 * @param options Upload configuration options
 * @returns Upload functions and state
 */
export const useChunkedRestUpload = (options: UseChunkedRestUploadOptions): UseChunkedRestUploadReturn => {
    const { chunkSize, control, endpoint, fingerprint, maxRetries, metadata, onError, onPause, onProgress, onResume, onStart, onSuccess, retry, urlStorage } = options;

    const progress = ref(0);
    const isUploading = ref(false);
    const isPaused = ref(false);
    const error = ref<Error | undefined>(undefined);
    const result = ref<UploadResult | undefined>(undefined);
    const offset = ref(0);

    // Create adapter instance (create once, reuse)
    const adapterInstance = createChunkedRestAdapter({
        chunkSize,
        control,
        endpoint,
        fingerprint,
        maxRetries,
        metadata,
        retry,
        urlStorage,
    });

    // Set up adapter callbacks
    onMounted(() => {
        adapterInstance.setOnStart(() => {
            isUploading.value = true;
            isPaused.value = false;
            progress.value = 0;
            error.value = undefined;
            offset.value = 0;
            onStart?.();
        });

        adapterInstance.setOnProgress((progressValue, offsetValue) => {
            progress.value = progressValue;
            offset.value = offsetValue;
            onProgress?.(progressValue, offsetValue);
        });

        adapterInstance.setOnFinish((uploadResult) => {
            progress.value = 100;
            result.value = uploadResult;
            isUploading.value = false;
            isPaused.value = false;
            onSuccess?.(uploadResult);
        });

        adapterInstance.setOnError((uploadError) => {
            error.value = uploadError;
            isUploading.value = false;
            onError?.(uploadError);
        });

        // Sync state with adapter periodically
        const checkInterval = setInterval(() => {
            adapterInstance
                .getOffset()
                .then((value) => {
                    offset.value = value;

                    return value;
                })
                .catch(() => {});
            isPaused.value = adapterInstance.isPaused();
        }, 100);

        // Cleanup on unmount
        onBeforeUnmount(() => {
            clearInterval(checkInterval);
            adapterInstance.setOnStart(undefined);
            adapterInstance.setOnProgress(undefined);
            adapterInstance.setOnFinish(undefined);
            adapterInstance.setOnError(undefined);
        });
    });

    const upload = async (file: File): Promise<UploadResult> => {
        try {
            return await adapterInstance.upload(file);
        } catch (error_) {
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));

            error.value = uploadError;
            onError?.(uploadError);
            throw uploadError;
        }
    };

    const pause = (): void => {
        adapterInstance.pause();
        isPaused.value = true;
        onPause?.();
    };

    const resume = async (): Promise<void> => {
        isPaused.value = false;
        isUploading.value = true;
        onResume?.();

        try {
            await adapterInstance.resume();
        } catch (error_) {
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));

            error.value = uploadError;
            isUploading.value = false;
            onError?.(uploadError);
            throw uploadError;
        }
    };

    const abort = (): void => {
        adapterInstance.abort();
        isUploading.value = false;
        isPaused.value = false;
    };

    const reset = (): void => {
        adapterInstance.clear();
        progress.value = 0;
        isUploading.value = false;
        isPaused.value = false;
        error.value = undefined;
        result.value = undefined;
        offset.value = 0;
    };

    return {
        abort,
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
