/* eslint-disable no-underscore-dangle -- `control._attach/_detach/_updateOffset` are the intentional @internal cross-module API of UploadControl */
import type { FingerprintFunction } from "./fingerprint";
import { defaultFingerprint } from "./fingerprint";
import { resolveRequestHeaders } from "./query-client";
import { validateFile } from "./restrictions";
import type { FileMeta, HeadersResolver, OnBeforeRequest, UploadRestrictions, UploadResult } from "./types";
import type { UploadControl } from "./upload-control";
import type { UrlStorage, UrlStorageEntry } from "./url-storage";

const TUS_RESUMABLE_VERSION = "1.0.0";
const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
/** Spaces and commas separate Upload-Metadata pairs, so keys must not contain them (or other whitespace). */
const INVALID_METADATA_KEY_PATTERN = /[\s,]/u;
/** A URL with a scheme (`http:`, `https:`, ...) — anything else is resolved relative to the endpoint. */
const ABSOLUTE_URL_PATTERN = /^[a-z][\d+.a-z-]*:/iu;

/**
 * Encodes a UTF-8 string to base64.
 */
const encodeBase64Utf8 = (value: string): string => {
    const bytes = new TextEncoder().encode(value);
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCodePoint(byte);
    }

    return btoa(binary);
};

/**
 * Decodes a base64 string to UTF-8.
 */
const decodeBase64Utf8 = (value: string): string => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.codePointAt(index) ?? 0;
    }

    return new TextDecoder().decode(bytes);
};

/**
 * Validates user-supplied Upload-Metadata keys. Per the TUS spec a key MUST NOT
 * be empty and MUST NOT contain spaces or commas (the header's separators); keys
 * are already unique because they come from an object. Any other whitespace is
 * rejected too since it would equally corrupt the header.
 */
const validateMetadataKeys = (metadata: Record<string, string>): void => {
    for (const key of Object.keys(metadata)) {
        if (key.length === 0) {
            throw new Error("Invalid TUS metadata key: keys must not be empty");
        }

        if (INVALID_METADATA_KEY_PATTERN.test(key)) {
            throw new Error(`Invalid TUS metadata key "${key}": keys must not contain spaces or commas`);
        }
    }
};

/**
 * Encodes metadata for TUS Upload-Metadata header. Empty values are sent as a
 * bare key, as the spec allows.
 */
const encodeMetadata = (metadata: Record<string, string>): string =>
    Object.entries(metadata)
        .map(([key, value]) => {
            if (value === "") {
                return key;
            }

            return `${key} ${encodeBase64Utf8(value)}`;
        })
        .join(",");

/**
 * Thrown when the server reports the upload resource no longer exists
 * (404 / 410, or 403 on HEAD), so the client must not keep PATCHing it.
 */
class TusUploadGoneError extends Error {
    public constructor(status: number) {
        super(`Upload expired or not found (${String(status)})`);
        this.name = "TusUploadGoneError";
    }
}

/**
 * Decodes metadata from TUS Upload-Metadata header.
 */
const decodeMetadata = (header: string | undefined): Record<string, string> => {
    if (!header) {
        return {};
    }

    const metadata: Record<string, string> = {};

    header.split(",").forEach((item) => {
        const [key, ...valueParts] = item.trim().split(" ");
        const encoded = valueParts.join(" ");

        if (key && !encoded) {
            // The spec allows a bare key for an empty value.
            metadata[key] = "";
        } else if (key) {
            try {
                metadata[key] = decodeBase64Utf8(encoded);
            } catch {
                // Ignore invalid metadata entries
            }
        }
    });

    return metadata;
};

/**
 * Represents the state of a TUS upload.
 */
interface TusUploadState {
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

    /**
     * Probes a previously-issued TUS upload URL. Returns the current server-side
     * offset, or `undefined` if the server reports the upload no longer exists
     * (404 / 410 / 403) so the caller can fall through to a fresh POST.
     */
    const probeExistingUpload = async (uploadUrl: string, signal?: AbortSignal): Promise<number | undefined> => {
        const probeOnce = async (): Promise<Response | undefined> => {
            try {
                return await fetch(uploadUrl, {
                    headers: await buildHeaders(uploadUrl, "HEAD", { "Tus-Resumable": TUS_RESUMABLE_VERSION }),
                    method: "HEAD",
                    signal,
                });
            } catch {
                return undefined;
            }
        };

        let response = await probeOnce();

        // 423 Locked: another request still holds the upload — back off and re-probe.
        for (let lockedAttempts = 1; response?.status === 423 && retry && lockedAttempts <= maxRetries && !signal?.aborted; lockedAttempts += 1) {
            // eslint-disable-next-line no-await-in-loop, no-promise-executor-return -- Sequential retry delay required; setTimeout return value is intentionally ignored
            await new Promise<void>((resolve) => setTimeout(resolve, 1000 * lockedAttempts));
            // eslint-disable-next-line no-await-in-loop -- Sequential re-probe required while the upload is locked
            response = await probeOnce();
        }

        if (response === undefined) {
            return undefined;
        }

        if (response.status === 404 || response.status === 410 || response.status === 403) {
            return undefined;
        }

        if (!response.ok) {
            throw new Error(`Failed to probe upload: ${String(response.status)} ${response.statusText}`);
        }

        const offsetHeader = response.headers.get("Upload-Offset");
        const parsed = offsetHeader ? Number.parseInt(offsetHeader, 10) : 0;

        return Number.isFinite(parsed) ? parsed : 0;
    };

    const persistUploadEntry = async (entryFingerprint: string, uploadUrl: string, file: File): Promise<void> => {
        if (!urlStorage) {
            return;
        }

        const entry: UrlStorageEntry = {
            createdAt: Date.now(),
            endpoint,
            fingerprint: entryFingerprint,
            lastModified: file.lastModified,
            protocol: "tus",
            size: file.size,
            uploadUrl,
        };

        try {
            await urlStorage.addEntry(entry);
        } catch {
            // Storage failures are non-fatal — the upload still works in-process.
        }
    };

    const removeUploadEntry = async (entryFingerprint: string | undefined): Promise<void> => {
        if (!urlStorage || !entryFingerprint) {
            return;
        }

        try {
            await urlStorage.removeEntry(entryFingerprint);
        } catch {
            // Non-fatal.
        }
    };

    /**
     * TUS Termination extension: a `DELETE` request to the upload URL so the server can free the
     * partial upload, then drop the stored resume URL. Runs at most once per
     * upload URL and never rejects — abort must not throw.
     */
    const terminateUpload = async (state: TusUploadState): Promise<void> => {
        const { fingerprint: entryFingerprint, uploadUrl } = state;

        if (!terminateOnAbort || !uploadUrl || state.terminatedUploadUrl === uploadUrl) {
            return;
        }

        // eslint-disable-next-line no-param-reassign -- Marking shared upload state so termination happens only once
        state.terminatedUploadUrl = uploadUrl;

        try {
            await fetch(uploadUrl, {
                headers: await buildHeaders(uploadUrl, "DELETE", { "Tus-Resumable": TUS_RESUMABLE_VERSION }),
                method: "DELETE",
            });
        } catch {
            // Best effort: the server may not support termination or be unreachable.
        }

        await removeUploadEntry(entryFingerprint);
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

    /**
     * Creates a new TUS upload.
     * According to TUS protocol: POST returns 201 Created (or 200 if Creation With Upload extension is used).
     * Headers: Location (required), Tus-Resumable (required), Upload-Offset (optional, if data was uploaded).
     */
    const createUpload = async (file: File): Promise<{ initialOffset: number; uploadUrl: string }> => {
        const fileMetadata = {
            filename: file.name,
            filetype: file.type,
            ...metadata,
        };

        const response = await fetch(endpoint, {
            headers: await buildHeaders(endpoint, "POST", {
                "Tus-Resumable": TUS_RESUMABLE_VERSION,
                "Upload-Length": file.size.toString(),
                "Upload-Metadata": encodeMetadata(fileMetadata),
            }),
            method: "POST",
        });

        // TUS protocol: POST should return 201 Created, or 200 if Creation With Upload extension is used
        if (response.status !== 201 && response.status !== 200) {
            throw new Error(`Failed to create upload: ${String(response.status)} ${response.statusText}`);
        }

        const location = response.headers.get("Location");

        if (!location) {
            throw new Error("No Location header in response");
        }

        // Handle relative URLs
        let uploadUrl: string;

        if (ABSOLUTE_URL_PATTERN.test(location)) {
            uploadUrl = location;
        } else {
            // If endpoint is absolute, use it as base; otherwise construct absolute URL
            try {
                uploadUrl = new URL(location, endpoint).href;
            } catch {
                // If endpoint is relative, try to construct from location
                // In browser, we can use window.location.origin; in Node, use http://localhost
                const baseUrl = "window" in globalThis ? globalThis.location.origin : "http://localhost";

                uploadUrl = new URL(location, baseUrl + endpoint).href;
            }
        }

        // Check if Upload-Offset header is present (Creation With Upload extension)
        const initialOffsetHeader = response.headers.get("Upload-Offset");
        const initialOffset = initialOffsetHeader ? Number.parseInt(initialOffsetHeader, 10) : 0;

        return { initialOffset, uploadUrl };
    };

    /**
     * Gets current upload offset from server.
     * According to TUS protocol: HEAD returns 200 OK.
     * Headers: Tus-Resumable (required), Upload-Length (required), Upload-Offset (required), Cache-Control: no-store.
     * Can return 404, 410, or 403 if upload doesn't exist — surfaced as `TusUploadGoneError`
     * so the caller re-creates the upload instead of PATCHing a dead URL.
     */
    const getUploadOffset = async (uploadUrl: string, signal?: AbortSignal): Promise<number> => {
        const response = await fetch(uploadUrl, {
            headers: await buildHeaders(uploadUrl, "HEAD", {
                "Tus-Resumable": TUS_RESUMABLE_VERSION,
            }),
            method: "HEAD",
            signal,
        });

        // TUS protocol: HEAD returns 200 OK, or 404/410/403 if upload doesn't exist
        if (!response.ok) {
            if (response.status === 404 || response.status === 410 || response.status === 403) {
                throw new TusUploadGoneError(response.status);
            }

            throw new Error(`Failed to get upload offset: ${String(response.status)} ${response.statusText}`);
        }

        const offsetHeader = response.headers.get("Upload-Offset");
        const parsed = offsetHeader ? Number.parseInt(offsetHeader, 10) : 0;

        return Number.isFinite(parsed) ? parsed : 0;
    };

    /**
     * Uploads a single chunk.
     * According to TUS protocol: PATCH returns 204 No Content (200 tolerated for older servers).
     * Headers: Tus-Resumable (required), Upload-Offset (required), Upload-Expires (optional).
     * Can return 409 Conflict if Upload-Offset doesn't match server's offset.
     */
    const uploadChunk = async (file: File, uploadUrl: string, startOffset: number, signal: AbortSignal): Promise<number> => {
        const endOffset = Math.min(startOffset + chunkSize, file.size);
        const chunk = file.slice(startOffset, endOffset);

        const response = await fetch(uploadUrl, {
            body: chunk,
            headers: await buildHeaders(uploadUrl, "PATCH", {
                "Content-Length": chunk.size.toString(), // Explicitly set Content-Length as required by TUS protocol
                "Content-Type": "application/offset+octet-stream",
                "Tus-Resumable": TUS_RESUMABLE_VERSION,
                "Upload-Offset": startOffset.toString(),
            }),
            method: "PATCH",
            signal,
        });

        // TUS protocol: PATCH must return 204 No Content. Also accept 200, which
        // @visulima/storage <= 2.0.25 sent for the completing chunk (#899).
        if (response.status !== 204 && response.status !== 200) {
            if (response.status === 409) {
                // Offset mismatch (Upload-Offset doesn't match server's offset)
                // Get current offset and retry from that position
                const currentOffset = await getUploadOffset(uploadUrl, signal);

                return currentOffset;
            }

            // The upload resource is gone — the caller re-creates it instead of retrying.
            if (response.status === 404 || response.status === 410) {
                throw new TusUploadGoneError(response.status);
            }

            if (response.status === 415) {
                throw new Error("Content-Type must be application/offset+octet-stream");
            }

            throw new Error(`Failed to upload chunk: ${String(response.status)} ${response.statusText}`);
        }

        // TUS protocol: Response must include Upload-Offset header
        const newOffsetHeader = response.headers.get("Upload-Offset");

        if (!newOffsetHeader) {
            throw new Error("Missing Upload-Offset header in PATCH response");
        }

        const parsed = Number.parseInt(newOffsetHeader, 10);

        if (!Number.isFinite(parsed)) {
            throw new TypeError("Invalid Upload-Offset header in PATCH response");
        }

        return parsed;
    };

    /**
     * Performs the actual upload.
     */
    /* eslint-disable sonarjs/cognitive-complexity -- sequential chunk/retry/restart state machine */
    const performUpload = async (
        file: File,
        uploadUrl: string,
        startOffset: number = 0,
        onUploadUrlChange?: (newUploadUrl: string) => void,
    ): Promise<UploadResult> => {
        // Capture local reference to uploadState at start
        const state = uploadState;

        if (!state) {
            throw new Error("Upload state not initialized");
        }

        const { abortController } = state;
        let currentOffset = startOffset;
        let activeUploadUrl = uploadUrl;
        // Re-sync the offset via HEAD before the next PATCH (set after a failed chunk).
        let syncOffset = false;
        // Re-create the upload via POST before the next PATCH (set when the server reports it gone).
        let restartPending = false;

        /**
         * The server no longer knows the upload (404/410/403): drop the stale
         * resume URL and POST a fresh upload, restarting from its initial offset.
         */
        const restartUpload = async (): Promise<number> => {
            await removeUploadEntry(state.fingerprint);

            const { initialOffset, uploadUrl: newUploadUrl } = await createUpload(file);

            activeUploadUrl = newUploadUrl;
            state.uploadUrl = newUploadUrl;

            if (abortController.signal.aborted) {
                // Aborted while the POST was in flight - don't leave the new upload orphaned.
                terminateUpload(state).catch(() => {});

                throw new Error("Upload aborted");
            }

            if (state.fingerprint !== undefined) {
                await persistUploadEntry(state.fingerprint, newUploadUrl, file);
            }

            onUploadUrlChange?.(newUploadUrl);

            return initialOffset;
        };

        try {
            while (currentOffset < file.size || restartPending) {
                // Check if aborted before proceeding
                if (abortController.signal.aborted) {
                    throw new Error("Upload aborted");
                }

                // Check if paused. Block on a promise that resolves on resume()/abort
                // rather than busy-polling, so resume is instantaneous.
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- aborted may flip between awaits
                if (state.isPaused && !abortController.signal.aborted) {
                    // eslint-disable-next-line no-await-in-loop -- Sequential wait required for pause/resume
                    await new Promise<void>((resolve) => {
                        state.pauseWaiters.push(resolve);
                    });
                }

                // Check if aborted after pause check
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- aborted may flip between awaits
                if (abortController.signal.aborted) {
                    throw new Error("Upload aborted");
                }

                try {
                    if (restartPending) {
                        // eslint-disable-next-line no-await-in-loop -- Sequential re-creation required before the next chunk
                        currentOffset = await restartUpload();
                        restartPending = false;
                        syncOffset = false;
                    } else if (syncOffset) {
                        // eslint-disable-next-line no-await-in-loop -- Sequential offset check required for retry
                        currentOffset = await getUploadOffset(activeUploadUrl, abortController.signal);
                        syncOffset = false;
                    }

                    if (currentOffset < file.size) {
                        // eslint-disable-next-line no-await-in-loop -- Sequential chunk upload required
                        currentOffset = await uploadChunk(file, activeUploadUrl, currentOffset, abortController.signal);
                    }

                    state.offset = currentOffset;
                    control?._updateOffset(currentOffset);

                    const progressPercent = Math.round((currentOffset / file.size) * 100);

                    progressCallback?.(progressPercent, currentOffset);
                } catch (error_) {
                    // Short-circuit retries if aborted
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- aborted may flip during the upload
                    if (abortController.signal.aborted) {
                        // eslint-disable-next-line preserve-caught-error -- abort signal is the originating cause, not an error to chain
                        throw new Error("Upload aborted");
                    }

                    // The upload resource is gone: re-create it once, never PATCH the dead URL again.
                    if (error_ instanceof TusUploadGoneError) {
                        if (state.restartedAfterGone) {
                            throw error_;
                        }

                        state.restartedAfterGone = true;
                        restartPending = true;

                        continue;
                    }

                    // Everything else (network errors, 5xx, 423 Locked, ...) is retried with backoff.
                    if (retry && state.retryCount < maxRetries) {
                        state.retryCount += 1;
                        // Wait before retry (exponential backoff)
                        // eslint-disable-next-line no-await-in-loop, no-promise-executor-return -- Sequential retry delay required; setTimeout return value is intentionally ignored
                        await new Promise<void>((resolve) => setTimeout(resolve, 1000 * state.retryCount));

                        // Check if aborted before retry
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- aborted may flip after the delay
                        if (abortController.signal.aborted) {
                            // eslint-disable-next-line preserve-caught-error -- abort signal is the originating cause, not an error to chain
                            throw new Error("Upload aborted");
                        }

                        // Re-HEAD for the server's offset before retrying (unless a restart is pending).
                        syncOffset = true;

                        continue;
                    }

                    throw error_;
                }

                state.retryCount = 0; // Reset retry count on successful chunk
            }

            // Check if aborted before final HEAD request
            if (abortController.signal.aborted) {
                throw new Error("Upload aborted");
            }

            // Upload complete, get final file info
            const headResponse = await fetch(activeUploadUrl, {
                headers: await buildHeaders(activeUploadUrl, "HEAD", {
                    "Tus-Resumable": TUS_RESUMABLE_VERSION,
                }),
                method: "HEAD",
                signal: abortController.signal,
            });

            const location = headResponse.headers.get("Location") ?? activeUploadUrl;
            const uploadMetadataHeader = headResponse.headers.get("Upload-Metadata");
            const uploadMetadata = decodeMetadata(uploadMetadataHeader ?? undefined);

            // Try to parse response as FileMeta if available
            let fileMeta: Partial<FileMeta> = {};

            try {
                // Some TUS servers return file info in headers or we can construct it
                const contentType = headResponse.headers.get("Content-Type") ?? uploadMetadata.filetype ?? file.type;

                fileMeta = {
                    contentType,
                    id: activeUploadUrl.split("/").pop() ?? "",
                    metadata: uploadMetadata,
                    originalName: uploadMetadata.filename ?? file.name,
                    size: file.size,
                    status: "completed",
                };
            } catch {
                // Use fallback values if parsing fails
            }

            return {
                bytesWritten: currentOffset,
                contentType: fileMeta.contentType ?? file.type,
                createdAt: fileMeta.createdAt,
                filename: fileMeta.originalName ?? file.name,
                id: fileMeta.id ?? activeUploadUrl.split("/").pop() ?? "",
                metadata: fileMeta.metadata ?? uploadMetadata,
                name: fileMeta.name,
                offset: currentOffset,
                originalName: fileMeta.originalName ?? file.name,
                size: fileMeta.size ?? file.size,
                status: fileMeta.status ?? "completed",
                url: location,
            };
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
                    if (candidate === undefined && urlStorage) {
                        try {
                            const stored = await urlStorage.findEntry(fingerprint);

                            if (stored?.protocol === "tus") {
                                candidate = stored.uploadUrl;
                            }
                        } catch {
                            // Treat storage failures as cache miss.
                        }
                    }

                    // 3. Validate any resume URL we found — drop it if the server says it's gone.
                    if (candidate === undefined) {
                        return undefined;
                    }

                    const probedOffset = await probeExistingUpload(candidate, initialState.abortController.signal);

                    if (probedOffset === undefined) {
                        await removeUploadEntry(fingerprint);

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
                    const { initialOffset, uploadUrl: newUploadUrl } = await createUpload(file);

                    uploadUrl = newUploadUrl;
                    initialState.uploadUrl = uploadUrl;
                    initialState.offset = initialOffset;

                    await persistUploadEntry(fingerprint, uploadUrl, file);

                    // Aborted while the POST was in flight — don't leave the new upload orphaned.
                    // (performUpload then bails out with "Upload aborted".)
                    if (initialState.abortController.signal.aborted) {
                        terminateUpload(initialState).catch(() => {});
                    }

                    if (initialOffset > 0) {
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- progressCallback may be reassigned to undefined concurrently (setOnProgress/timeout cleanup) while createUpload is in flight
                        progressCallback?.(Math.round((initialOffset / file.size) * 100), initialOffset);
                    }
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
                return performUpload(file, uploadUrl, initialState.offset, (newUploadUrl) => {
                    control?._attach(controlBinding, { endpoint, fingerprint, protocol: "tus", uploadUrl: newUploadUrl });
                });
            })();

            armTimeout();

            try {
                const result = await uploadPromise;

                await removeUploadEntry(resolvedFingerprint);
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
