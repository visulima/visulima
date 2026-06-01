import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FingerprintFunction } from "../core/fingerprint";
import { createTusAdapter } from "../core/tus-adapter";
import type { UploadControl } from "../core/upload-control";
import type { UrlStorage } from "../core/url-storage";
import type { UploadResult } from "./types";

export interface UseTusUploadOptions {
    /** Chunk size for TUS uploads (default: 1MB) */
    chunkSize?: number;

    /**
     * Unified control handle. Pass an empty `new UploadControl()` to drive the
     * upload, or `UploadControl.from(token)` to resume an upload that was
     * started in another process / tab.
     */
    control?: UploadControl;
    /** TUS upload endpoint URL */
    endpoint: string;
    /** Customise the resume fingerprint. Defaults to `defaultFingerprint`. */
    fingerprint?: FingerprintFunction;
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
    /** Enable automatic retry on failure */
    retry?: boolean;
    /** Persistent storage for resume URLs (e.g. `defaultUrlStorage()` in the browser). */
    urlStorage?: UrlStorage;
}

export interface UseTusUploadReturn {
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
    /** Upload a file using TUS protocol */
    upload: (file: File) => Promise<UploadResult>;
}

/**
 * React hook for TUS resumable file uploads.
 * @param options Upload configuration options
 * @returns Upload functions and state
 */
export const useTusUpload = (options: UseTusUploadOptions): UseTusUploadReturn => {
    const { chunkSize, control, endpoint, fingerprint, maxRetries, metadata, onError, onPause, onProgress, onResume, onStart, onSuccess, retry, urlStorage } =
        options;

    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [result, setResult] = useState<UploadResult | undefined>(undefined);
    const [offset, setOffset] = useState(0);

    // Create adapter instance (memoized)
    const adapterInstance = useMemo(
        () =>
            createTusAdapter({
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
    const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const isMountedRef = useRef(true);

    // Update callbacks ref when they change
    useEffect(() => {
        callbacksRef.current = { onError, onPause, onProgress, onResume, onStart, onSuccess };
    }, [onError, onProgress, onPause, onResume, onStart, onSuccess]);

    // Set up adapter callbacks
    useEffect(() => {
        isMountedRef.current = true;

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
            callbacksRef.current.onProgress?.(progressValue);
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

        // Sync state with adapter periodically
        intervalRef.current = setInterval(() => {
            // Only update state if component is still mounted, interval is
            // active, and the DOM is still available. The `window` check guards
            // against happy-dom / jsdom tearing down between an interval tick
            // being scheduled and fired — React's scheduler reads `window` to
            // resolve update priority and throws `ReferenceError: window is
            // not defined` if the environment is already gone.
            if (isMountedRef.current && intervalRef.current && "window" in globalThis) {
                setOffset(adapterInstance.getOffset());
                setIsPaused(adapterInstance.isPaused());
            }
        }, 100);

        return () => {
            isMountedRef.current = false;

            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = undefined;
            }

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
                const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));

                setError(uploadError);
                callbacksRef.current.onError?.(uploadError);
                throw uploadError;
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
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));

            setError(uploadError);
            setIsUploading(false);
            callbacksRef.current.onError?.(uploadError);
            throw uploadError;
        }
    }, [adapterInstance]);

    const abort = useCallback((): void => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
        }

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
