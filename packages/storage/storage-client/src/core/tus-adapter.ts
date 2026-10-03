/* eslint-disable no-underscore-dangle -- `control._attach/_detach/_updateOffset` are the intentional @internal cross-module API of UploadControl */
import type { FingerprintFunction } from "./fingerprint";
import { defaultFingerprint } from "./fingerprint";
import { resolveRequestHeaders } from "./query-client";
import { validateFile } from "./restrictions";
import { TusResponseError, TusUploadGoneError } from "./tus/errors";
import { toUploadResult, validateMetadataKeys } from "./tus/protocol";
import { createTusRequests } from "./tus/requests";
import { createTusResumeStore } from "./tus/resume-store";
import type { TusUploadState } from "./tus/state";
import { requireUploadUrl, sleep, throwIfAborted } from "./tus/state";
import type { HeadersResolver, OnBeforeRequest, UploadRestrictions, UploadResult } from "./types";
import type { UploadControl } from "./upload-control";
import type { UrlStorage } from "./url-storage";

const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB

export interface TusAdapterOptions {
    /** Chunk size for TUS uploads (default: 1MB) */
    chunkSize?: number;

    /**
     * Optional unified control handle. When passed, `pause`/`resume`/`abort`/`toJSON`
     * on the control delegate to this adapter. Pre-loaded controls (see
     * `UploadControl.from`) cause `upload()` to resume the prior session rather
     * than creating a new one.
     */
    control?: UploadControl;
    /** TUS upload endpoint URL */
    endpoint: string;
    /** Customise the resume fingerprint. Defaults to `defaultFingerprint`. */
    fingerprint?: FingerprintFunction;

    /**
     * Static or dynamically-resolved headers attached to every request (creation,
     * HEAD, PATCH). Use this to attach an `Authorization` token to all requests.
     */
    headers?: HeadersResolver;
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;

    /**
     * Per-request hook returning extra headers, given the outgoing request
     * context (`url`, `method`, already-resolved `headers`). Runs after the
     * `headers` resolver and merges over it; TUS protocol headers still win.
     */
    onBeforeRequest?: OnBeforeRequest;
    /** Client-side upload restrictions, validated before any network request. */
    restrictions?: UploadRestrictions;
    /** Enable automatic retry on failure */
    retry?: boolean;

    /**
     * When `true`, `abort()` (and `control.abort()`) also terminates the upload on
     * the server by sending a `DELETE` request to the upload URL (TUS Termination extension) and
     * drops the stored resume URL, so aborted uploads are not left orphaned. The
     * request runs in the background; failures are swallowed and never thrown
     * from `abort()`. Defaults to `false`, which keeps the server-side upload so
     * it can be resumed later.
     */
    terminateOnAbort?: boolean;

    /**
     * Inactivity timeout in milliseconds. When set, `upload()` fails via the
     * error callback if no progress is observed for this long (the timer resets
     * on every progress event and is suspended while paused). Off by default, so
     * long-running or paused uploads are never force-aborted.
     */
    uploadTimeoutMs?: number;

    /**
     * Persistent storage for resume URLs. Defaults to no persistence — pass a
     * `defaultUrlStorage()` (browser) or `MemoryUrlStorage` to opt in.
     */
    urlStorage?: UrlStorage;
}

export interface TusAdapter {
    /** Abort the current upload */
    abort: () => void;
    /** Clear all uploads */
    clear: () => void;
    /** Get current upload offset */
    getOffset: () => number;
    /** Whether upload is paused */
    isPaused: () => boolean;
    /** Pause the current upload */
    pause: () => void;
    /** Resume a paused upload */
    resume: () => Promise<void>;
    /** Set error callback */
    setOnError: (callback: ((error: Error) => void) | undefined) => void;
    /** Set finish callback */
    setOnFinish: (callback: ((result: UploadResult) => void) | undefined) => void;
    /** Set progress callback */
    setOnProgress: (callback: ((progress: number, offset: number) => void) | undefined) => void;
    /** Set start callback */
    setOnStart: (callback: (() => void) | undefined) => void;
    /** Upload a file and return visulima-compatible result */
    upload: (file: File) => Promise<UploadResult>;
}

/**
 * Creates a TUS upload adapter.
 * This adapter provides a clean interface for TUS resumable file uploads
 * with proper progress tracking, pause/resume, and event handling.
 */
export const createTusAdapter = (options: TusAdapterOptions): TusAdapter => {
    const {
        chunkSize = DEFAULT_CHUNK_SIZE,
        control,
        endpoint,
        fingerprint: fingerprintFunction = defaultFingerprint,
        headers: headersResolver,
        maxRetries = 3,
        metadata = {},
        onBeforeRequest,
        restrictions,
        retry = true,
        terminateOnAbort = false,
        uploadTimeoutMs,
        urlStorage,
    } = options;

    let uploadState: TusUploadState | undefined;
    let progressCallback: ((progress: number, offset: number) => void) | undefined;
    let startCallback: (() => void) | undefined;
    let finishCallback: ((result: UploadResult) => void) | undefined;
    let errorCallback: ((error: Error) => void) | undefined;

    /**
     * Merges adapter-level custom headers (and any `onBeforeRequest` hook result)
     * with the per-request TUS headers. Per-request protocol headers win on
     * conflict (the TUS protocol headers are required).
     */
    const buildHeaders = async (url: string, method: string, requestHeaders: Record<string, string>): Promise<Record<string, string>> => {
        const resolved = await resolveRequestHeaders(url, method, headersResolver, onBeforeRequest);

        return { ...resolved, ...requestHeaders };
    };

    /**
     * Wakes every coroutine waiting on a pause. Called from `resume()` and on
     * abort so the upload loop continues immediately instead of polling.
     */
    const flushPauseWaiters = (state: TusUploadState): void => {
        const waiters = state.pauseWaiters;

        // eslint-disable-next-line no-param-reassign -- Resetting shared upload state in place
        state.pauseWaiters = [];

        for (const resolve of waiters) {
            resolve();
        }
    };

    const requests = createTusRequests({ buildHeaders, endpoint });
    const resumeStore = createTusResumeStore(endpoint, urlStorage);

    /**
     * Probes a previously-issued TUS upload URL. Returns the current server-side
     * offset, or `undefined` if the upload is unusable (gone, or the probe could
     * not reach the server) so the caller can fall through to a fresh POST.
     * A 423 Locked answer (another request still holds the upload) is re-probed with backoff.
     */
    const probeExistingUpload = async (uploadUrl: string, signal: AbortSignal): Promise<number | undefined> => {
        for (let lockedAttempts = 0; ; lockedAttempts += 1) {
            try {
                // eslint-disable-next-line no-await-in-loop -- Sequential re-probe required while the upload is locked
                return await requests.getOffset(uploadUrl, signal);
            } catch (error) {
                // Gone, or a network failure: the resume URL is not usable.
                if (!(error instanceof TusResponseError) || error instanceof TusUploadGoneError) {
                    return undefined;
                }

                if (error.status !== 423 || !retry || lockedAttempts >= maxRetries || signal.aborted) {
                    throw error;
                }
            }

            // eslint-disable-next-line no-await-in-loop -- Sequential retry delay required
            await sleep(1000 * (lockedAttempts + 1));
        }
    };

    /**
     * TUS Termination extension: a `DELETE` request to the upload URL so the server can free the
     * partial upload, then drop the stored resume URL. Runs at most once per
     * upload URL and never rejects — abort must not throw.
     */
    const terminateUpload = async (state: TusUploadState, uploadUrl: string | undefined = state.uploadUrl): Promise<void> => {
        if (!terminateOnAbort || !uploadUrl || state.terminatedUploadUrl === uploadUrl) {
            return;
        }

        // eslint-disable-next-line no-param-reassign -- Marking shared upload state so termination happens only once
        state.terminatedUploadUrl = uploadUrl;

        await requests.terminate(uploadUrl);
        await resumeStore.remove(state.fingerprint);
    };

    /**
     * Aborts the in-flight upload and, when `terminateOnAbort` is set, terminates
     * it on the server in the background.
     */
    const abortState = (state: TusUploadState): void => {
        state.abortController.abort();
        // Wake any pause-waiters so the upload loop sees the abort immediately.
        flushPauseWaiters(state);
        // Fire-and-forget: abort() stays synchronous and must never surface a rejection.
        terminateUpload(state).catch(() => {});
    };

    const reportProgress = (state: TusUploadState, offset: number): void => {
        // eslint-disable-next-line no-param-reassign -- Tracking the shared upload offset
        state.offset = offset;
        control?._updateOffset(offset);
        progressCallback?.(Math.round((offset / state.file.size) * 100), offset);
    };

    /**
     * POSTs a new upload and makes it the state's active upload. If the upload was
     * aborted while the POST was in flight, the new upload is terminated (with
     * `terminateOnAbort`) and never persisted. Resolves with the initial offset.
     */
    const startFreshUpload = async (state: TusUploadState, file: File): Promise<number> => {
        const { initialOffset, uploadUrl } = await requests.create(file, metadata);

        if (state.abortController.signal.aborted) {
            // Don't leave the new upload orphaned on the server.
            terminateUpload(state, uploadUrl).catch(() => {});

            throw new Error("Upload aborted");
        }

        // eslint-disable-next-line no-param-reassign -- Switching the shared upload state to the new upload
        state.uploadUrl = uploadUrl;
        // eslint-disable-next-line no-param-reassign -- Tracking the shared upload offset
        state.offset = initialOffset;

        if (state.fingerprint !== undefined) {
            await resumeStore.persist(state.fingerprint, uploadUrl, file);
        }

        if (initialOffset > 0) {
            reportProgress(state, initialOffset);
        }

        return initialOffset;
    };

    /**
     * Performs the actual upload of `uploadState`'s file to `uploadState.uploadUrl`.
     *
     * Each iteration runs one `next` step before PATCHing: `"sync"` re-reads the
     * server offset via HEAD (after a failed chunk), `"restart"` re-creates the
     * upload via POST (after the server reported it gone).
     */
    /* eslint-disable sonarjs/cognitive-complexity -- sequential chunk/retry/restart state machine */
    const performUpload = async (file: File, startOffset: number, onUploadUrlChange?: (newUploadUrl: string) => void): Promise<UploadResult> => {
        // Capture local reference to uploadState at start
        const state = uploadState;

        if (!state) {
            throw new Error("Upload state not initialized");
        }

        const { signal } = state.abortController;
        let currentOffset = startOffset;
        let next: "patch" | "restart" | "sync" = "patch";

        try {
            while (next !== "patch" || currentOffset < file.size) {
                throwIfAborted(signal);

                // Check if paused. Block on a promise that resolves on resume()/abort
                // rather than busy-polling, so resume is instantaneous.
                if (state.isPaused) {
                    // eslint-disable-next-line no-await-in-loop -- Sequential wait required for pause/resume
                    await new Promise<void>((resolve) => {
                        state.pauseWaiters.push(resolve);
                    });

                    throwIfAborted(signal);
                }

                try {
                    if (next === "restart") {
                        // The server no longer knows the upload: drop the stale resume URL and start over.
                        // eslint-disable-next-line no-await-in-loop -- Sequential re-creation required before the next chunk
                        await resumeStore.remove(state.fingerprint);
                        // eslint-disable-next-line no-await-in-loop -- Sequential re-creation required before the next chunk
                        currentOffset = await startFreshUpload(state, file);
                        onUploadUrlChange?.(requireUploadUrl(state));
                    } else if (next === "sync") {
                        // eslint-disable-next-line no-await-in-loop -- Sequential offset check required for retry
                        currentOffset = await requests.getOffset(requireUploadUrl(state), signal);
                    }

                    next = "patch";

                    if (currentOffset < file.size) {
                        // eslint-disable-next-line no-await-in-loop -- Sequential chunk upload required
                        currentOffset = await requests.patch(
                            requireUploadUrl(state),
                            currentOffset,
                            file.slice(currentOffset, currentOffset + chunkSize),
                            signal,
                        );
                    }

                    reportProgress(state, currentOffset);
                } catch (error_) {
                    // Short-circuit retries if aborted
                    throwIfAborted(signal);

                    if (error_ instanceof TusUploadGoneError) {
                        // The upload resource is gone: re-create it once, never PATCH the dead URL again.
                        if (state.restartedAfterGone) {
                            throw error_;
                        }

                        state.restartedAfterGone = true;
                        next = "restart";

                        continue;
                    }

                    // Everything else (network errors, 5xx, 423 Locked, ...) is retried with backoff.
                    if (retry && state.retryCount < maxRetries) {
                        state.retryCount += 1;
                        // eslint-disable-next-line no-await-in-loop -- Sequential retry delay required (exponential backoff)
                        await sleep(1000 * state.retryCount);

                        throwIfAborted(signal);

                        // Re-HEAD for the server's offset before retrying (unless a restart is pending).
                        if (next !== "restart") {
                            next = "sync";
                        }

                        continue;
                    }

                    throw error_;
                }

                state.retryCount = 0; // Reset retry count on successful chunk
            }

            throwIfAborted(signal);

            const uploadUrl = requireUploadUrl(state);
            // Upload complete, get final file info
            const finalHead = await requests.head(uploadUrl, signal);

            return toUploadResult(file, uploadUrl, currentOffset, finalHead.headers);
        } finally {
            // Clear uploadState in the natural completion/finally path
            if (uploadState === state) {
                uploadState = undefined;
            }
        }
    };
    /* eslint-enable sonarjs/cognitive-complexity */

    return {
        /**
         * Aborts the current upload. With `terminateOnAbort`, also terminates it on the server.
         */
        abort: () => {
            if (uploadState) {
                // Don't clear uploadState here - let performUpload handle it in finally
                abortState(uploadState);
            }
        },

        /**
         * Clears all uploads.
         */
        clear: () => {
            if (uploadState) {
                uploadState.abortController.abort();
                flushPauseWaiters(uploadState);
                // Don't clear uploadState here - let performUpload handle it in finally
            }
        },

        /**
         * Gets the current upload offset.
         */
        getOffset: () => uploadState?.offset ?? 0,

        /**
         * Checks whether the upload is paused.
         */
        isPaused: () => uploadState?.isPaused ?? false,

        /**
         * Pauses the current upload.
         */
        pause: () => {
            if (uploadState) {
                uploadState.isPaused = true;
            }
        },

        /**
         * Resumes a paused upload.
         */
        // eslint-disable-next-line @typescript-eslint/require-await -- adapter interface requires Promise<void> for symmetry with TUS-style adapters
        resume: async (): Promise<void> => {
            if (!uploadState?.uploadUrl) {
                throw new Error("No upload to resume");
            }

            uploadState.isPaused = false;
            flushPauseWaiters(uploadState);
        },

        /**
         * Sets the error callback.
         */
        setOnError: (callback: ((error: Error) => void) | undefined) => {
            errorCallback = callback;
        },

        /**
         * Sets the finish callback.
         */
        setOnFinish: (callback: ((result: UploadResult) => void) | undefined) => {
            finishCallback = callback;
        },

        /**
         * Sets the progress callback.
         */
        setOnProgress: (callback: ((progress: number, offset: number) => void) | undefined) => {
            progressCallback = callback;
        },

        /**
         * Sets the start callback.
         */
        setOnStart: (callback: (() => void) | undefined) => {
            startCallback = callback;
        },

        /**
         * Uploads a file and returns a visulima-compatible result.
         */
        upload: async (file: File): Promise<UploadResult> => {
            // Validate before any network request (and before the callbacks are
            // swapped) so consumers get a friendly error instead of a server-side
            // 413 or a malformed Upload-Metadata header.
            validateFile(file, restrictions);
            validateMetadataKeys(metadata);

            let resolved = false;
            const originalFinishCallback = finishCallback;
            const originalErrorCallback = errorCallback;
            const originalProgressCallback = progressCallback;
            let timeoutId: NodeJS.Timeout | undefined;

            const cleanupTimeout = (): void => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = undefined;
                }

                finishCallback = originalFinishCallback;
                errorCallback = originalErrorCallback;
                progressCallback = originalProgressCallback;
            };

            const internalFinishCallback = (result: UploadResult): void => {
                if (!resolved) {
                    resolved = true;
                    cleanupTimeout();
                    originalFinishCallback?.(result);
                }
            };

            const internalErrorCallback = (error: Error): void => {
                if (!resolved) {
                    resolved = true;
                    cleanupTimeout();
                    originalErrorCallback?.(error);

                    if (!uploadState?.uploadUrl) {
                        uploadState = undefined;
                    }
                }
            };

            // Inactivity timeout: rearmed on every progress event, suspended while
            // paused, and routed through the error callback so `setOnError` fires.
            const onTimeout = (): void => {
                if (resolved) {
                    return;
                }

                if (uploadState?.isPaused) {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- armTimeout is defined below; only invoked at runtime
                    armTimeout();

                    return;
                }

                uploadState?.abortController.abort();
                internalErrorCallback(new Error("Upload timeout"));
            };

            const armTimeout = (): void => {
                if (!uploadTimeoutMs || uploadTimeoutMs <= 0) {
                    return;
                }

                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                timeoutId = setTimeout(onTimeout, uploadTimeoutMs);
            };

            finishCallback = internalFinishCallback;
            errorCallback = internalErrorCallback;
            progressCallback = (progress: number, offset: number): void => {
                armTimeout();
                originalProgressCallback?.(progress, offset);
            };

            uploadState = {
                abortController: new AbortController(),
                file,
                fingerprint: undefined,
                isPaused: false,
                offset: 0,
                pauseWaiters: [],
                restartedAfterGone: false,
                retryCount: 0,
                terminatedUploadUrl: undefined,
                uploadUrl: undefined,
            };

            // Hoisted so it survives `performUpload`'s finally clearing `uploadState`.
            let resolvedFingerprint: string | undefined;

            const uploadPromise = (async (): Promise<UploadResult> => {
                startCallback?.();

                const initialState = uploadState;
                const fingerprint = await fingerprintFunction({ endpoint, file, protocol: "tus" });

                resolvedFingerprint = fingerprint;
                initialState.fingerprint = fingerprint;

                // Steps 1–3: locate a reusable resume URL from the snapshot or persistent storage,
                // then validate it against the server. Returns undefined when none is usable.
                const resolveResumeUrl = async (): Promise<string | undefined> => {
                    // 1. Resume from an explicit snapshot on the supplied UploadControl.
                    const snapshot = control?.snapshot;

                    let candidate: string | undefined = snapshot?.protocol === "tus" && snapshot.fingerprint === fingerprint ? snapshot.uploadUrl : undefined;

                    // 2. Fall back to the persistent url storage.
                    candidate ??= await resumeStore.find(fingerprint);

                    // 3. Validate any resume URL we found — drop it if the server says it's gone.
                    if (candidate === undefined) {
                        return undefined;
                    }

                    const probedOffset = await probeExistingUpload(candidate, initialState.abortController.signal);

                    if (probedOffset === undefined) {
                        await resumeStore.remove(fingerprint);

                        return undefined;
                    }

                    initialState.uploadUrl = candidate;
                    initialState.offset = probedOffset;

                    if (probedOffset > 0) {
                        progressCallback?.(Math.round((probedOffset / file.size) * 100), probedOffset);
                    }

                    return candidate;
                };

                let uploadUrl: string | undefined = await resolveResumeUrl();

                // 4. No usable resume URL — POST a fresh upload.
                if (uploadUrl === undefined) {
                    await startFreshUpload(initialState, file);
                    uploadUrl = requireUploadUrl(initialState);
                }

                const controlBinding = {
                    abort: () => {
                        abortState(initialState);
                    },
                    pause: () => {
                        initialState.isPaused = true;
                    },
                    resume: () => {
                        initialState.isPaused = false;
                        flushPauseWaiters(initialState);

                        return Promise.resolve();
                    },
                };

                control?._attach(controlBinding, { endpoint, fingerprint, protocol: "tus", uploadUrl });
                control?._updateOffset(initialState.offset);

                // If the server drops the upload mid-way it is re-created; keep the control's snapshot in sync.
                return performUpload(file, initialState.offset, (newUploadUrl) => {
                    control?._attach(controlBinding, { endpoint, fingerprint, protocol: "tus", uploadUrl: newUploadUrl });
                });
            })();

            armTimeout();

            try {
                const result = await uploadPromise;

                await resumeStore.remove(resolvedFingerprint);
                control?._detach();
                internalFinishCallback(result);

                return result;
            } catch (error_) {
                const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));

                control?._detach();
                internalErrorCallback(uploadError);
                throw uploadError;
            }
        },
    };
};
