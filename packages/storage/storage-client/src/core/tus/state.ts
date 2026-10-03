/**
 * Resolves after `ms` milliseconds.
 */
export const sleep = async (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

/**
 * Throws the adapter's "Upload aborted" error once `signal` has fired.
 */
export const throwIfAborted = (signal: AbortSignal): void => {
    if (signal.aborted) {
        throw new Error("Upload aborted");
    }
};

/**
 * Represents the state of a TUS upload.
 */
export interface TusUploadState {
    /** Abort controller for canceling requests */
    abortController: AbortController;
    /** Current file being uploaded */
    file: File;
    /** Cross-process resume key. Set once `createUpload` succeeds or a resume token is supplied. */
    fingerprint: string | undefined;
    /** Whether upload is paused */
    isPaused: boolean;
    /** Current upload offset */
    offset: number;
    /** Resolvers waiting for `resume()` — invoked when the upload is unpaused. */
    pauseWaiters: (() => void)[];
    /** Whether the upload was already re-created after the server reported it gone. */
    restartedAfterGone: boolean;
    /** Retry count */
    retryCount: number;
    /** Upload URL a termination (DELETE) was already issued for, so it is sent at most once. */
    terminatedUploadUrl: string | undefined;
    /** Upload URL from server */
    uploadUrl: string | undefined;
}

/**
 * The active upload URL; throws if the upload was not created/resumed yet.
 */
export const requireUploadUrl = (state: TusUploadState): string => {
    if (state.uploadUrl === undefined) {
        throw new Error("Upload URL not initialized");
    }

    return state.uploadUrl;
};
