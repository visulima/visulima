import { onDestroy, onMount } from "svelte";
import type { Readable } from "svelte/store";
import { writable } from "svelte/store";

import type { FingerprintFunction } from "../core/fingerprint";
import { createTusAdapter } from "../core/tus-adapter";
import type { UploadControl } from "../core/upload-control";
import type { UrlStorage } from "../core/url-storage";
import type { HeadersResolver, UploadRestrictions, UploadResult } from "../react/types";

export interface CreateTusUploadOptions {
    /** Chunk size for TUS uploads (default: 1MB) */
    chunkSize?: number;
    /** Unified control handle. See `UploadControl`. */
    control?: UploadControl;
    /** TUS upload endpoint URL */
    endpoint: string;
    /** Customise the resume fingerprint. */
    fingerprint?: FingerprintFunction;

    /**
     * Static or dynamically-resolved headers attached to every request — e.g. an
     * `Authorization` token for an authenticated endpoint.
     */
    headers?: HeadersResolver;
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Callback when upload fails */
    onError?: (error: Error) => void;
    /** Callback when upload is paused */
    onPause?: () => void;
    /** Callback when upload progress updates */
    onProgress?: (progress: number) => void;
    /** Callback when upload is resumed */
    onResume?: () => void;
    /** Callback when upload starts */
    onStart?: () => void;
    /** Callback when upload completes successfully */
    onSuccess?: (file: UploadResult) => void;
    /** Client-side upload restrictions, validated before any network request. */
    restrictions?: UploadRestrictions;
    /** Enable automatic retry on failure */
    retry?: boolean;
    /** Persistent storage for resume URLs. */
    urlStorage?: UrlStorage;
}

export interface CreateTusUploadReturn {
    /** Abort the current upload */
    abort: () => void;
    /** Last upload error, if any */
    error: Readable<Error | undefined>;
    /** Whether the upload is paused */
    isPaused: Readable<boolean>;
    /** Whether an upload is currently in progress */
    isUploading: Readable<boolean>;
    /** Current upload offset (bytes uploaded) */
    offset: Readable<number>;
    /** Pause the current upload */
    pause: () => void;
    /** Current upload progress (0-100) */
    progress: Readable<number>;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: Readable<UploadResult | undefined>;
    /** Resume a paused upload */
    resume: () => Promise<void>;
    /** Upload a file using TUS protocol */
    upload: (file: File) => Promise<UploadResult>;
}

/**
 * Svelte store-based utility for TUS resumable file uploads.
 * @param options Upload configuration options
 * @returns Upload functions and state stores
 */
export const createTusUpload = (options: CreateTusUploadOptions): CreateTusUploadReturn => {
    const {
        chunkSize,
        control,
        endpoint,
        fingerprint,
        headers,
        maxRetries,
        metadata,
        onError,
        onPause,
        onProgress,
        onResume,
        onStart,
        onSuccess,
        restrictions,
        retry,
        urlStorage,
    } = options;

    const progress = writable(0);
    const isUploading = writable(false);
    const isPaused = writable(false);
    const error = writable<Error | undefined>();
    const result = writable<UploadResult | undefined>();
    const offset = writable(0);

    // Create adapter instance (create once, reuse)
    const adapterInstance = createTusAdapter({
        chunkSize,
        control,
        endpoint,
        fingerprint,
        headers,
        maxRetries,
        metadata,
        restrictions,
        retry,
        urlStorage,
    });

    // Set up adapter callbacks
    onMount(() => {
        adapterInstance.setOnStart(() => {
            isUploading.set(true);
            isPaused.set(false);
            progress.set(0);
            error.set(undefined);
            offset.set(0);
            onStart?.();
        });

        adapterInstance.setOnProgress((progressValue, offsetValue) => {
            progress.set(progressValue);
            offset.set(offsetValue);
            onProgress?.(progressValue);
        });

        adapterInstance.setOnFinish((uploadResult) => {
            progress.set(100);
            result.set(uploadResult);
            isUploading.set(false);
            isPaused.set(false);
            onSuccess?.(uploadResult);
        });

        adapterInstance.setOnError((uploadError) => {
            error.set(uploadError);
            isUploading.set(false);
            onError?.(uploadError);
        });

        // Sync state with adapter periodically
        const checkInterval = setInterval(() => {
            offset.set(adapterInstance.getOffset());
            isPaused.set(adapterInstance.isPaused());
        }, 100);

        // Cleanup on destroy
        onDestroy(() => {
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

            error.set(uploadError);
            onError?.(uploadError);
            throw uploadError;
        }
    };

    const pause = (): void => {
        adapterInstance.pause();
        isPaused.set(true);
        onPause?.();
    };

    const resume = async (): Promise<void> => {
        isPaused.set(false);
        isUploading.set(true);
        onResume?.();

        try {
            await adapterInstance.resume();
        } catch (error_) {
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));

            error.set(uploadError);
            isUploading.set(false);
            onError?.(uploadError);
            throw uploadError;
        }
    };

    const abort = (): void => {
        adapterInstance.abort();
        isUploading.set(false);
        isPaused.set(false);
    };

    const reset = (): void => {
        adapterInstance.clear();
        progress.set(0);
        isUploading.set(false);
        isPaused.set(false);
        error.set(undefined);
        result.set(undefined);
        offset.set(0);
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
