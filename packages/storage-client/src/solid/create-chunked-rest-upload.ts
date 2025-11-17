import type { Accessor } from "solid-js";
import { createSignal, onCleanup, onMount } from "solid-js";

import { createChunkedRestAdapter } from "../core/chunked-rest-adapter";
import type { UploadResult } from "../react/types";

export interface CreateChunkedRestUploadOptions {
    /** Chunk size for chunked REST uploads (default: 5MB) */
    chunkSize?: number;
    /** Chunked REST upload endpoint URL */
    endpoint: string;
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
}

export interface CreateChunkedRestUploadReturn {
    /** Abort the current upload */
    abort: () => void;
    /** Last upload error, if any */
    error: Accessor<Error | null>;
    /** Whether the upload is paused */
    isPaused: Accessor<boolean>;
    /** Whether an upload is currently in progress */
    isUploading: Accessor<boolean>;
    /** Current upload offset (bytes uploaded) */
    offset: Accessor<number>;
    /** Pause the current upload */
    pause: () => void;
    /** Current upload progress (0-100) */
    progress: Accessor<number>;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: Accessor<UploadResult | null>;
    /** Resume a paused upload */
    resume: () => Promise<void>;
    /** Upload a file using chunked REST protocol */
    upload: (file: File) => Promise<UploadResult>;
}

/**
 * Solid.js primitive for chunked REST file uploads
 * @param options Upload configuration options
 * @returns Upload functions and state signals
 */
export const createChunkedRestUpload = (options: CreateChunkedRestUploadOptions): CreateChunkedRestUploadReturn => {
    const { chunkSize, endpoint, maxRetries, metadata, onError, onPause, onProgress, onResume, onStart, onSuccess, retry } = options;

    const [progress, setProgress] = createSignal(0);
    const [isUploading, setIsUploading] = createSignal(false);
    const [isPaused, setIsPaused] = createSignal(false);
    const [error, setError] = createSignal<Error | null>(null);
    const [result, setResult] = createSignal<UploadResult | null>(null);
    const [offset, setOffset] = createSignal(0);

    // Create adapter instance
    const adapterInstance = createChunkedRestAdapter({
        chunkSize,
        endpoint,
        maxRetries,
        metadata,
        retry,
    });

    // Set up adapter callbacks
    onMount(() => {
        adapterInstance.setOnStart(() => {
            setIsUploading(true);
            setIsPaused(false);
            setProgress(0);
            setError(null);
            setOffset(0);
            onStart?.();
        });

        adapterInstance.setOnProgress((progressValue, offsetValue) => {
            setProgress(progressValue);
            setOffset(offsetValue);
            onProgress?.(progressValue, offsetValue);
        });

        adapterInstance.setOnFinish((uploadResult) => {
            setProgress(100);
            setResult(uploadResult);
            setIsUploading(false);
            setIsPaused(false);
            onSuccess?.(uploadResult);
        });

        adapterInstance.setOnError((uploadError) => {
            setError(uploadError);
            setIsUploading(false);
            onError?.(uploadError);
        });

        // Sync state with adapter periodically
        const checkInterval = setInterval(async () => {
            setOffset(await adapterInstance.getOffset());
            setIsPaused(adapterInstance.isPaused());
        }, 100);

        // Cleanup on unmount
        onCleanup(() => {
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

            setError(uploadError);
            onError?.(uploadError);
            throw uploadError;
        }
    };

    const pause = (): void => {
        adapterInstance.pause();
        setIsPaused(true);
        onPause?.();
    };

    const resume = async (): Promise<void> => {
        setIsPaused(false);
        setIsUploading(true);
        onResume?.();

        try {
            await adapterInstance.resume();
        } catch (error_) {
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));

            setError(uploadError);
            setIsUploading(false);
            onError?.(uploadError);
            throw uploadError;
        }
    };

    const abort = (): void => {
        adapterInstance.abort();
        setIsUploading(false);
        setIsPaused(false);
    };

    const reset = (): void => {
        adapterInstance.clear();
        setProgress(0);
        setIsUploading(false);
        setIsPaused(false);
        setError(null);
        setResult(null);
        setOffset(0);
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
