import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createChunkedRestAdapter } from "../core/chunked-rest-adapter";
import type { FingerprintFn } from "../core/fingerprint";
import type { UploadControl } from "../core/upload-control";
import type { UrlStorage } from "../core/url-storage";
import type { UploadResult } from "./types";

export interface UseChunkedRestUploadOptions {
    /** Chunk size for chunked REST uploads (default: 5MB) */
    chunkSize?: number;
    /** Unified control handle. See `UploadControl`. */
    control?: UploadControl;
    /** Chunked REST upload endpoint URL */
    endpoint: string;
    /** Customise the resume fingerprint. Defaults to `defaultFingerprint`. */
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
    error: Error | undefined;
    /** Whether the upload is paused */
    isPaused: boolean;
    /** Whether an upload is currently in progress */
    isUploading: boolean;
    /** Current upload offset (bytes uploaded) */
    offset: number;
    /** Pause the current upload */
    pause: () => void;
    /** Current upload progress (0-100) */
    progress: number;
    /** Reset upload state */
    reset: () => void;
    /** Last upload result, if any */
    result: UploadResult | undefined;
    /** Resume a paused upload */
    resume: () => Promise<void>;
    /** Upload a file using chunked REST protocol */
    upload: (file: File) => Promise<UploadResult>;
}

/**
 * React hook for chunked REST file uploads.
 * @param options Upload configuration options
 * @returns Upload functions and state
 */
export const useChunkedRestUpload = (options: UseChunkedRestUploadOptions): UseChunkedRestUploadReturn => {
    const { chunkSize, control, endpoint, fingerprint, maxRetries, metadata, onError, onPause, onProgress, onResume, onStart, onSuccess, retry, urlStorage } = options;

    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [result, setResult] = useState<UploadResult | undefined>(undefined);
    const [offset, setOffset] = useState(0);

    // Create adapter instance (memoized)
    const adapterInstance = useMemo(
        () =>
            createChunkedRestAdapter({
                chunkSize,
                control,
                endpoint,
                fingerprint,
                maxRetries,
                metadata,
                retry,
                urlStorage,
            }),
        [chunkSize, control, endpoint, fingerprint, maxRetries, metadata, retry, urlStorage],
    );

    // Store callbacks in refs to avoid re-subscribing on every render
    const callbacksRef = useRef({ onError, onPause, onProgress, onResume, onStart, onSuccess });

    // Update callbacks ref when they change
    useEffect(() => {
        callbacksRef.current = { onError, onPause, onProgress, onResume, onStart, onSuccess };
    }, [onError, onProgress, onPause, onResume, onStart, onSuccess]);

    // Set up adapter callbacks
    useEffect(() => {
        adapterInstance.setOnStart(() => {
            setIsUploading(true);
            setIsPaused(false);
            setProgress(0);
            setError(undefined);
            setOffset(0);
            callbacksRef.current.onStart?.();
        });

        adapterInstance.setOnProgress((progressValue, offsetValue) => {
            setProgress(progressValue);
            setOffset(offsetValue);
            callbacksRef.current.onProgress?.(progressValue, offsetValue);
        });

        adapterInstance.setOnFinish((uploadResult) => {
            setProgress(100);
            setResult(uploadResult);
            setIsUploading(false);
            setIsPaused(false);
            callbacksRef.current.onSuccess?.(uploadResult);
        });

        adapterInstance.setOnError((uploadError) => {
            setError(uploadError);
            setIsUploading(false);
            callbacksRef.current.onError?.(uploadError);
        });

        // Sync state with adapter periodically. We re-check `window in
        // globalThis` after every async hop because happy-dom / jsdom can
        // tear down between scheduling and the React scheduler firing —
        // setState in that window throws `ReferenceError: window is not
        // defined` from React's internals.
        let mounted = true;
        const checkInterval = setInterval(() => {
            if (!mounted || !("window" in globalThis)) {
                return;
            }

            adapterInstance
                .getOffset()
                .then((value) => {
                    if (!mounted || !("window" in globalThis)) {
                        return value;
                    }

                    setOffset(value);

                    return value;
                })
                .catch(() => {});

            if (!mounted || !("window" in globalThis)) {
                return;
            }

            setIsPaused(adapterInstance.isPaused());
        }, 100);

        return () => {
            mounted = false;
            clearInterval(checkInterval);
            // Cleanup callbacks
            adapterInstance.setOnStart(undefined);
            adapterInstance.setOnProgress(undefined);
            adapterInstance.setOnFinish(undefined);
            adapterInstance.setOnError(undefined);
        };
    }, [adapterInstance]);

    const upload = useCallback(
        async (file: File): Promise<UploadResult> => {
            try {
                return await adapterInstance.upload(file);
            } catch (error_) {
                // Adapter's onError already updated state and invoked callbacks
                throw error_ instanceof Error ? error_ : new Error(String(error_));
            }
        },
        [adapterInstance],
    );

    const pause = useCallback((): void => {
        adapterInstance.pause();
        setIsPaused(true);
        callbacksRef.current.onPause?.();
    }, [adapterInstance]);

    const resume = useCallback(async (): Promise<void> => {
        setIsPaused(false);
        setIsUploading(true);
        callbacksRef.current.onResume?.();

        try {
            await adapterInstance.resume();
        } catch (error_) {
            // Adapter's onError already updated state and invoked callbacks
            setIsUploading(false);
            throw error_ instanceof Error ? error_ : new Error(String(error_));
        }
    }, [adapterInstance]);

    const abort = useCallback((): void => {
        adapterInstance.abort();
        setIsUploading(false);
        setIsPaused(false);
    }, [adapterInstance]);

    const reset = useCallback((): void => {
        adapterInstance.clear();
        setProgress(0);
        setIsUploading(false);
        setIsPaused(false);
        setError(undefined);
        setResult(undefined);
        setOffset(0);
    }, [adapterInstance]);

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
