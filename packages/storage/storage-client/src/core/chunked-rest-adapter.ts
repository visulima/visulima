/* eslint-disable no-underscore-dangle -- `control._attach/_detach/_updateOffset` are the intentional @internal cross-module API of UploadControl */
import type { ChecksumAlgorithm } from "./checksum";
import { computeChunkChecksum } from "./checksum";
import type { FingerprintFunction } from "./fingerprint";
import { defaultFingerprint } from "./fingerprint";
import { resolveRequestHeaders } from "./query-client";
import { validateFile } from "./restrictions";
import type { HeadersResolver, OnBeforeRequest, UploadRestrictions, UploadResult } from "./types";
import type { UploadControl } from "./upload-control";
import type { UrlStorage, UrlStorageEntry } from "./url-storage";

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB default chunk size

/**
 * Builds an RFC 5987-compliant `Content-Disposition` header value.
 *
 * A naive `attachment; filename="${name}"` malforms the header when the filename
 * contains a `"` or a non-ASCII character (and `fetch` rejects CR/LF outright).
 * This emits both a sanitised ASCII `filename` (back-compat) and a percent-encoded
 * UTF-8 `filename*` so unicode names survive.
 */
const buildContentDisposition = (name: string): string => {
    // ASCII fallback: strip non-ASCII and escape quotes/backslashes.

    const asciiName = name.replaceAll(/[^\u0020-\u007E]/gu, "_").replaceAll(/["\\]/g, "_");
    // RFC 5987 percent-encoding for the UTF-8 variant.
    const encoded = encodeURIComponent(name);

    return `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
};

interface UploadState {
    abortController?: AbortController;
    aborted: boolean;
    file?: File;
    fileId?: string;
    fingerprint?: string;
    paused: boolean;
    /** Resolvers waiting for `resume()` — invoked when the upload is unpaused. */
    pauseWaiters: (() => void)[];
    totalSize: number;
    uploadedChunks: Set<number>; // Track uploaded chunk offsets
}

export interface ChunkedRestAdapterOptions {
    /**
     * Compute and send a per-chunk integrity checksum (`X-Chunk-Checksum`).
     * Pass `true` for the default `SHA-256`, or an explicit algorithm. Disabled
     * by default; requires the Web Crypto API (browsers / Node >= 20).
     */
    checksum?: ChecksumAlgorithm | boolean;
    /** Chunk size in bytes (default: 5MB) */
    chunkSize?: number;
    /** Unified control handle. See `UploadControl`. */
    control?: UploadControl;
    /** Upload endpoint URL */
    endpoint: string;
    /** Customise the resume fingerprint. Defaults to `defaultFingerprint`. */
    fingerprint?: FingerprintFunction;

    /**
     * Static or dynamically-resolved headers attached to every request. Use this
     * to attach an `Authorization` token to all requests.
     */
    headers?: HeadersResolver;
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;

    /**
     * Per-request hook returning extra headers, given the outgoing request
     * context (`url`, `method`, already-resolved `headers`). Runs after the
     * `headers` resolver and merges over it; protocol headers still win.
     */
    onBeforeRequest?: OnBeforeRequest;
    /** Client-side upload restrictions, validated before any network request. */
    restrictions?: UploadRestrictions;
    /** Enable automatic retry on failure */
    retry?: boolean;

    /**
     * Inactivity timeout in milliseconds. When set, `upload()` fails via the
     * error callback if no progress is observed for this long (the timer resets
     * on every progress event and is suspended while paused). Off by default, so
     * long-running or paused uploads are never force-aborted.
     */
    uploadTimeoutMs?: number;
    /** Persistent storage for resume identifiers. Opt-in. */
    urlStorage?: UrlStorage;
}

export interface ChunkedRestAdapter {
    /** Abort current upload */
    abort: () => void;
    /** Clear upload state */
    clear: () => void;
    /** Get current upload offset */
    getOffset: () => Promise<number>;
    /** Check if upload is paused */
    isPaused: () => boolean;
    /** Pause upload */
    pause: () => void;
    /** Resume upload */
    resume: () => Promise<void>;
    /** Set error callback */
    setOnError: (callback?: (error: Error) => void) => void;
    /** Set finish callback */
    setOnFinish: (callback?: (result: UploadResult) => void) => void;
    /** Set progress callback */
    setOnProgress: (callback?: (progress: number, offset: number) => void) => void;
    /** Set start callback */
    setOnStart: (callback?: () => void) => void;
    /** Upload a file in chunks */
    upload: (file: File) => Promise<UploadResult>;
}

/**
 * Creates a chunked REST upload adapter.
 * This adapter uploads files in chunks using PATCH requests.
 * Supports pause/resume and handles out-of-order chunks.
 */
export const createChunkedRestAdapter = (options: ChunkedRestAdapterOptions): ChunkedRestAdapter => {
    const {
        checksum = false,
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
        uploadTimeoutMs,
        urlStorage,
    } = options;

    let checksumAlgorithm: ChecksumAlgorithm | undefined;

    if (checksum === true) {
        checksumAlgorithm = "SHA-256";
    } else if (checksum !== false) {
        checksumAlgorithm = checksum;
    }

    let uploadState: UploadState = {
        aborted: false,
        paused: false,
        pauseWaiters: [],
        totalSize: 0,
        uploadedChunks: new Set(),
    };

    /** True while an `upload()` call's worker pool is running (possibly parked on a pause). */
    let uploadInFlight = false;

    /**
     * Merges adapter-level custom headers (and any `onBeforeRequest` hook result)
     * with the per-request headers. Per-request protocol headers win on conflict.
     */
    const buildHeaders = async (url: string, method: string, requestHeaders: Record<string, string>): Promise<Record<string, string>> => {
        const resolved = await resolveRequestHeaders(url, method, headersResolver, onBeforeRequest);

        return { ...resolved, ...requestHeaders };
    };

    /**
     * Wakes every coroutine waiting on a pause. Called from `resume()` and on
     * abort so workers continue immediately instead of polling.
     */
    const flushPauseWaiters = (): void => {
        const waiters = uploadState.pauseWaiters;

        uploadState.pauseWaiters = [];

        for (const resolve of waiters) {
            resolve();
        }
    };

    const persistUploadEntry = async (fingerprint: string, fileId: string, file: File): Promise<void> => {
        if (!urlStorage) {
            return;
        }

        const entry: UrlStorageEntry = {
            createdAt: Date.now(),
            endpoint,
            fingerprint,
            lastModified: file.lastModified,
            protocol: "chunked-rest",
            size: file.size,
            uploadUrl: fileId,
        };

        try {
            await urlStorage.addEntry(entry);
        } catch {
            // Non-fatal.
        }
    };

    const removeUploadEntry = async (fingerprint: string | undefined): Promise<void> => {
        if (!urlStorage || !fingerprint) {
            return;
        }

        try {
            await urlStorage.removeEntry(fingerprint);
        } catch {
            // Non-fatal.
        }
    };

    let startCallback: (() => void) | undefined;
    let progressCallback: ((progress: number, offset: number) => void) | undefined;
    let finishCallback: ((result: UploadResult) => void) | undefined;
    let errorCallback: ((error: Error) => void) | undefined;

    /**
     * Creates an abortable delay that checks the signal periodically.
     */
    const abortableDelay = async (ms: number, signal?: AbortSignal): Promise<void> => {
        if (signal?.aborted) {
            throw new Error("Aborted");
        }

        const checkInterval = 100; // Check every 100ms
        const startTime = Date.now();

        while (Date.now() - startTime < ms) {
            if (signal?.aborted) {
                throw new Error("Aborted");
            }

            const remaining = ms - (Date.now() - startTime);
            const waitTime = Math.min(checkInterval, remaining);

            // eslint-disable-next-line no-await-in-loop -- Sequential delay required for abortable delay
            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, waitTime);
            });
        }
    };

    /**
     * Whether an HTTP status is worth retrying. Deterministic 4xx client errors
     * (400/401/403/404/413/422 …) will fail again on replay, so they surface
     * immediately instead of re-sending the chunk body three more times; only
     * transient statuses (408 request timeout, 429 rate limit, 5xx) are retried.
     */
    const isRetryableStatus = (status: number): boolean => status === 408 || status === 429 || status >= 500;

    /**
     * Retries a fetch request with exponential backoff.
     */
    const fetchWithRetry = async (url: string, init: RequestInit, retriesLeft = maxRetries): Promise<Response> => {
        try {
            const response = await fetch(url, init);

            if (!response.ok && retriesLeft > 0 && retry && isRetryableStatus(response.status)) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = 1000 * 2 ** (maxRetries - retriesLeft);

                await abortableDelay(delay, init.signal ?? undefined);

                return fetchWithRetry(url, init, retriesLeft - 1);
            }

            return response;
        } catch (error) {
            // If aborted, don't retry
            if (init.signal?.aborted || (error instanceof Error && error.message === "Aborted")) {
                throw error;
            }

            if (retriesLeft > 0 && retry) {
                const delay = 1000 * 2 ** (maxRetries - retriesLeft);

                await abortableDelay(delay, init.signal ?? undefined);

                return fetchWithRetry(url, init, retriesLeft - 1);
            }

            throw error;
        }
    };

    /**
     * Initializes an upload session.
     */
    const createUpload = async (file: File): Promise<string> => {
        const headers: Record<string, string> = {
            "Content-Type": file.type || "application/octet-stream",
            "X-Chunked-Upload": "true",
            "X-Total-Size": String(file.size),
        };

        if (Object.keys(metadata).length > 0) {
            headers["X-File-Metadata"] = JSON.stringify(metadata);
        }

        if (file.name) {
            headers["Content-Disposition"] = buildContentDisposition(file.name);
        }

        const response = await fetchWithRetry(endpoint, {
            body: new Uint8Array(0), // Empty body for initialization
            headers: await buildHeaders(endpoint, "POST", headers),
            method: "POST",
        });

        if (!response.ok) {
            throw new Error(`Failed to create upload session: ${String(response.status)} ${response.statusText}`);
        }

        const fileId = response.headers.get("X-Upload-ID") ?? response.headers.get("Location")?.split("/").pop();

        if (!fileId) {
            throw new Error("Failed to get upload ID from server");
        }

        return fileId;
    };

    /**
     * Probes an existing upload session. Returns the server-side offset, or
     * `undefined` if the upload no longer exists (404 / 410 / 403) — so the
     * caller can fall through to creating a fresh session.
     */
    const probeExistingUpload = async (fileId: string): Promise<number | undefined> => {
        const url = endpoint.endsWith("/") ? `${endpoint}${fileId}` : `${endpoint}/${fileId}`;

        let response: Response;

        try {
            response = await fetch(url, { headers: await buildHeaders(url, "HEAD", {}), method: "HEAD" });
        } catch {
            return undefined;
        }

        if (response.status === 404 || response.status === 410 || response.status === 403) {
            return undefined;
        }

        if (!response.ok) {
            throw new Error(`Failed to probe upload: ${String(response.status)} ${response.statusText}`);
        }

        return Number.parseInt(response.headers.get("X-Upload-Offset") ?? "0", 10);
    };

    /**
     * Gets upload status from server.
     */
    const getUploadStatus = async (fileId: string): Promise<{ chunks: { length: number; offset: number }[]; offset: number }> => {
        const url = endpoint.endsWith("/") ? `${endpoint}${fileId}` : `${endpoint}/${fileId}`;

        const response = await fetchWithRetry(url, {
            headers: await buildHeaders(url, "HEAD", {}),
            method: "HEAD",
        });

        if (!response.ok) {
            throw new Error(`Failed to get upload status: ${String(response.status)} ${response.statusText}`);
        }

        const offset = Number.parseInt(response.headers.get("X-Upload-Offset") ?? "0", 10);
        const chunksHeader = response.headers.get("X-Received-Chunks");

        let chunks: { length: number; offset: number }[] = [];

        if (chunksHeader) {
            try {
                const parsed = JSON.parse(chunksHeader);

                if (Array.isArray(parsed)) {
                    chunks = parsed as { length: number; offset: number }[];
                }
            } catch {
                // Ignore parse errors
            }
        }

        return { chunks, offset };
    };

    /**
     * Uploads a single chunk.
     */
    const uploadChunk = async (file: File, fileId: string, startOffset: number, endOffset: number, signal: AbortSignal): Promise<void> => {
        const chunk = file.slice(startOffset, endOffset);
        const currentChunkSize = endOffset - startOffset;

        // Skip if already uploaded
        if (uploadState.uploadedChunks.has(startOffset)) {
            return;
        }

        const url = endpoint.endsWith("/") ? `${endpoint}${fileId}` : `${endpoint}/${fileId}`;

        const chunkHeaders: Record<string, string> = {
            "Content-Length": String(currentChunkSize),
            "Content-Type": "application/octet-stream",
            "X-Chunk-Offset": String(startOffset),
        };

        // Opt-in per-chunk integrity verification.
        if (checksumAlgorithm) {
            const digest = await computeChunkChecksum(chunk, checksumAlgorithm);

            if (digest) {
                chunkHeaders["X-Chunk-Checksum"] = digest;
            }
        }

        const response = await fetchWithRetry(url, {
            body: chunk,
            headers: await buildHeaders(url, "PATCH", chunkHeaders),
            method: "PATCH",
            signal,
        });

        if (!response.ok) {
            throw new Error(`Failed to upload chunk: ${String(response.status)} ${response.statusText}`);
        }

        // Mark chunk as uploaded
        uploadState.uploadedChunks.add(startOffset);

        // Update progress
        const currentOffset = Number.parseInt(response.headers.get("X-Upload-Offset") ?? String(endOffset), 10);
        const progress = Math.round((currentOffset / file.size) * 100);

        control?._updateOffset(currentOffset);
        progressCallback?.(progress, currentOffset);
    };

    /**
     * Performs the actual chunked upload.
     */
    const performUpload = async (file: File, fileId: string, signal: AbortSignal): Promise<UploadResult> => {
        const totalChunks = Math.ceil(file.size / chunkSize);

        // Get current status from server (for resumability)
        const { chunks: serverChunks } = await getUploadStatus(fileId);

        // Mark server-reported chunks as uploaded
        for (const chunk of serverChunks) {
            uploadState.uploadedChunks.add(chunk.offset);
        }

        // Collect the chunks that still need uploading.
        const pending: { endOffset: number; startOffset: number }[] = [];

        for (let i = 0; i < totalChunks; i += 1) {
            const startOffset = i * chunkSize;
            const endOffset = Math.min(startOffset + chunkSize, file.size);

            // Skip if already uploaded
            if (uploadState.uploadedChunks.has(startOffset)) {
                continue;
            }

            pending.push({ endOffset, startOffset });
        }

        // Drain the queue with a bounded worker pool so we never fire every PATCH at once.
        const CONCURRENCY = 4;
        let nextIndex = 0;

        const worker = async (): Promise<void> => {
            while (nextIndex < pending.length) {
                // If paused, block on a promise that resolves on resume()/abort
                // rather than busy-polling, so resume is instantaneous.
                if (uploadState.paused && !uploadState.aborted) {
                    // eslint-disable-next-line no-await-in-loop -- Sequential wait required for pause/resume
                    await new Promise<void>((resolve) => {
                        uploadState.pauseWaiters.push(resolve);
                    });
                }

                if (uploadState.aborted) {
                    throw new Error("Upload aborted");
                }

                const index = nextIndex;

                nextIndex += 1;

                const pair = pending[index];

                if (!pair) {
                    break;
                }

                // eslint-disable-next-line no-await-in-loop -- Sequential drain within a single worker bounds concurrency
                await uploadChunk(file, fileId, pair.startOffset, pair.endOffset, signal);
            }
        };

        const workerCount = Math.min(CONCURRENCY, pending.length);

        await Promise.all(Array.from({ length: workerCount }, () => worker()));

        // Verify upload is complete
        const finalStatus = await getUploadStatus(fileId);

        if (finalStatus.offset < file.size) {
            throw new Error(`Upload incomplete. Expected ${String(file.size)} bytes, got ${String(finalStatus.offset)}`);
        }

        // Check if uploadedChunks set has any items
        if (uploadState.uploadedChunks.size <= 0) {
            throw new Error("No chunks were uploaded");
        }

        // Parse response as FileMeta
        const url = endpoint.endsWith("/") ? `${endpoint}${fileId}` : `${endpoint}/${fileId}`;

        const response = await fetchWithRetry(url, {
            headers: await buildHeaders(url, "GET", {}),
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(`Failed to get upload result: ${String(response.status)} ${response.statusText}`);
        }

        const fileMeta = (await response.json()) as {
            bytesWritten?: number;
            contentType?: string;
            createdAt?: string;
            id?: string;
            metadata?: Record<string, unknown>;
            name?: string;
            originalName?: string;
            size?: number;
            status?: string;
            url?: string;
        };

        // Build UploadResult
        return {
            bytesWritten: fileMeta.bytesWritten ?? Math.max(file.size, 0),
            contentType: fileMeta.contentType ?? file.type,
            createdAt: fileMeta.createdAt,
            filename: fileMeta.originalName ?? file.name,
            id: fileMeta.id ?? fileId,
            metadata: fileMeta.metadata,
            name: fileMeta.name,
            originalName: fileMeta.originalName ?? file.name,
            size: fileMeta.size ?? file.size,
            status: (fileMeta.status as UploadResult["status"]) ?? "completed",
            url: fileMeta.url,
        };
    };

    return {
        /**
         * Aborts the current upload.
         */
        abort: () => {
            uploadState.aborted = true;
            uploadState.paused = false;
            uploadState.abortController?.abort();
            // Wake any paused workers so they observe the abort immediately.
            flushPauseWaiters();
        },

        /**
         * Clears upload state.
         */
        clear: () => {
            flushPauseWaiters();
            uploadState = {
                abortController: undefined,
                aborted: false,
                file: undefined,
                fileId: undefined,
                paused: false,
                pauseWaiters: [],
                totalSize: 0,
                uploadedChunks: new Set(),
            };
        },

        /**
         * Gets the current upload offset.
         */
        getOffset: async () => {
            if (!uploadState.fileId) {
                return 0;
            }

            try {
                const status = await getUploadStatus(uploadState.fileId);

                return status.offset;
            } catch {
                let totalOffset = 0;

                for (const offset of uploadState.uploadedChunks) {
                    const chunkEnd = Math.min(offset + chunkSize, uploadState.totalSize);

                    totalOffset += chunkEnd - offset;
                }

                return totalOffset;
            }
        },

        /**
         * Checks if upload is paused.
         */
        isPaused: () => uploadState.paused,

        /**
         * Pauses the upload.
         */
        pause: () => {
            uploadState.paused = true;
        },

        /**
         * Resumes a paused upload.
         */
        resume: async () => {
            if (!uploadState.fileId || !uploadState.file) {
                throw new Error("No upload to resume");
            }

            uploadState.paused = false;
            // Wake any workers blocked on the pause promise (in-flight pause/resume).
            flushPauseWaiters();

            // If an `upload()` call is still running, its workers were merely parked
            // on the pause promise — flushing them above is enough. Re-running
            // performUpload here would spawn a second worker pool that PATCHes the
            // same chunks again.
            if (uploadInFlight) {
                return;
            }

            // Post-error / settled resume: no workers are running, so drive a fresh pass.
            const abortController = new AbortController();

            uploadState.abortController = abortController;

            try {
                const result = await performUpload(uploadState.file, uploadState.fileId, abortController.signal);

                finishCallback?.(result);
            } catch (error) {
                const uploadError = error instanceof Error ? error : new Error(String(error));

                errorCallback?.(uploadError);
                throw uploadError;
            }
        },

        /**
         * Sets the error callback.
         */
        setOnError: (callback?: (error: Error) => void) => {
            errorCallback = callback;
        },

        /**
         * Sets the finish callback.
         */
        setOnFinish: (callback?: (result: UploadResult) => void) => {
            finishCallback = callback;
        },

        /**
         * Sets the progress callback.
         */
        setOnProgress: (callback?: (progress: number, offset: number) => void) => {
            progressCallback = callback;
        },

        /**
         * Sets the start callback.
         */
        setOnStart: (callback?: () => void) => {
            startCallback = callback;
        },

        /**
         * Uploads a file in chunks.
         */
        upload: async (file: File): Promise<UploadResult> => {
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
                }
            };

            // Inactivity timeout: rearmed on every progress event, suspended while
            // paused, and routed through the error callback so `setOnError` fires.
            const onTimeout = (): void => {
                if (resolved) {
                    return;
                }

                if (uploadState.paused) {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- armTimeout is defined below; only invoked at runtime
                    armTimeout();

                    return;
                }

                uploadState.aborted = true;
                uploadState.abortController?.abort();
                flushPauseWaiters();
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

            // Validate restrictions before any network request so consumers get a
            // friendly error instead of a server-side 413.
            validateFile(file, restrictions);

            finishCallback = internalFinishCallback;
            errorCallback = internalErrorCallback;
            progressCallback = (progress: number, offset: number): void => {
                armTimeout();
                originalProgressCallback?.(progress, offset);
            };

            uploadState = {
                aborted: false,
                file,
                paused: false,
                pauseWaiters: [],
                totalSize: file.size,
                uploadedChunks: new Set(),
            };

            startCallback?.();

            const uploadPromise = (async (): Promise<UploadResult> => {
                const abortController = new AbortController();

                uploadState.abortController = abortController;

                const fingerprint = await fingerprintFunction({ endpoint, file, protocol: "chunked-rest" });

                uploadState.fingerprint = fingerprint;

                let fileId: string | undefined;

                // 1. Resume from an explicit snapshot on the supplied UploadControl.
                const snapshot = control?.snapshot;

                if (snapshot?.protocol === "chunked-rest" && snapshot.fingerprint === fingerprint) {
                    fileId = snapshot.uploadUrl;
                }

                // 2. Fall back to persistent storage.
                if (fileId === undefined && urlStorage) {
                    try {
                        const stored = await urlStorage.findEntry(fingerprint);

                        if (stored?.protocol === "chunked-rest") {
                            fileId = stored.uploadUrl;
                        }
                    } catch {
                        // Cache miss.
                    }
                }

                // 3. Validate any resume hint — drop it if the server says the session is gone.
                if (fileId !== undefined) {
                    const probed = await probeExistingUpload(fileId);

                    if (probed === undefined) {
                        await removeUploadEntry(fingerprint);
                        fileId = undefined;
                    } else if (probed > 0) {
                        control?._updateOffset(probed);
                        progressCallback(Math.round((probed / file.size) * 100), probed);
                    }
                }

                // 4. No usable hint — create a new session.
                if (fileId === undefined) {
                    fileId = await createUpload(file);
                    await persistUploadEntry(fingerprint, fileId, file);
                }

                uploadState.fileId = fileId;

                control?._attach(
                    {
                        abort: () => {
                            abortController.abort();
                            flushPauseWaiters();
                        },
                        pause: () => {
                            uploadState.paused = true;
                        },
                        resume: () => {
                            uploadState.paused = false;
                            flushPauseWaiters();

                            return Promise.resolve();
                        },
                    },
                    { endpoint, fingerprint, protocol: "chunked-rest", uploadUrl: fileId },
                );

                // Perform upload
                return performUpload(file, fileId, abortController.signal);
            })();

            uploadInFlight = true;
            armTimeout();

            try {
                const result = await uploadPromise;

                await removeUploadEntry(uploadState.fingerprint);
                control?._detach();
                internalFinishCallback(result);

                return result;
            } catch (error) {
                const uploadError = error instanceof Error ? error : new Error(String(error));

                control?._detach();
                internalErrorCallback(uploadError);
                throw uploadError;
            } finally {
                uploadInFlight = false;
            }
        },
    };
};
