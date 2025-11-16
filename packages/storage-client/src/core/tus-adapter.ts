import type { FileMeta, UploadResult } from "../react/types";

const TUS_RESUMABLE_VERSION = "1.0.0";
const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB

/**
 * Encode metadata for TUS Upload-Metadata header
 */
const encodeMetadata = (metadata: Record<string, string>): string =>
    Object.entries(metadata)
        .map(([key, value]) => {
            const encoded = btoa(unescape(encodeURIComponent(value)));

            return `${key} ${encoded}`;
        })
        .join(",");

/**
 * Decode metadata from TUS Upload-Metadata header
 */
const decodeMetadata = (header: string | null): Record<string, string> => {
    if (!header) {
        return {};
    }

    const metadata: Record<string, string> = {};

    header.split(",").forEach((item) => {
        const [key, ...valueParts] = item.trim().split(" ");
        const encoded = valueParts.join(" ");

        if (key && encoded) {
            try {
                metadata[key] = decodeURIComponent(escape(atob(encoded)));
            } catch {
                // Ignore invalid metadata entries
            }
        }
    });

    return metadata;
};

export interface TusAdapterOptions {
    /** Chunk size for TUS uploads (default: 1MB) */
    chunkSize?: number;
    /** TUS upload endpoint URL */
    endpoint: string;
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Enable automatic retry on failure */
    retry?: boolean;
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
 * TUS upload state
 */
interface TusUploadState {
    /** Abort controller for canceling requests */
    abortController: AbortController;
    /** Current file being uploaded */
    file: File;
    /** Whether upload is paused */
    isPaused: boolean;
    /** Current upload offset */
    offset: number;
    /** Retry count */
    retryCount: number;
    /** Upload URL from server */
    uploadUrl: string | null;
}

/**
 * Create a TUS upload adapter
 * This adapter provides a clean interface for TUS resumable file uploads
 * with proper progress tracking, pause/resume, and event handling
 */
export const createTusAdapter = (options: TusAdapterOptions): TusAdapter => {
    const { chunkSize = DEFAULT_CHUNK_SIZE, endpoint, maxRetries = 3, metadata = {}, retry = true } = options;

    let uploadState: TusUploadState | null = null;
    let progressCallback: ((progress: number, offset: number) => void) | undefined;
    let startCallback: (() => void) | undefined;
    let finishCallback: ((result: UploadResult) => void) | undefined;
    let errorCallback: ((error: Error) => void) | undefined;

    /**
     * Create a new TUS upload
     * According to TUS protocol: POST returns 201 Created (or 200 if Creation With Upload extension is used)
     * Headers: Location (required), Tus-Resumable (required), Upload-Offset (optional, if data was uploaded)
     */
    const createUpload = async (file: File): Promise<{ initialOffset: number; uploadUrl: string }> => {
        const fileMetadata = {
            filename: file.name,
            filetype: file.type,
            ...metadata,
        };

        const response = await fetch(endpoint, {
            headers: {
                "Tus-Resumable": TUS_RESUMABLE_VERSION,
                "Upload-Length": file.size.toString(),
                "Upload-Metadata": encodeMetadata(fileMetadata),
            },
            method: "POST",
        });

        // TUS protocol: POST should return 201 Created, or 200 if Creation With Upload extension is used
        if (response.status !== 201 && response.status !== 200) {
            throw new Error(`Failed to create upload: ${response.status} ${response.statusText}`);
        }

        const location = response.headers.get("Location");

        if (!location) {
            throw new Error("No Location header in response");
        }

        // Handle relative URLs
        const uploadUrl = location.startsWith("http") ? location : new URL(location, endpoint).href;

        // Check if Upload-Offset header is present (Creation With Upload extension)
        const initialOffsetHeader = response.headers.get("Upload-Offset");
        const initialOffset = initialOffsetHeader ? Number.parseInt(initialOffsetHeader, 10) : 0;

        return { initialOffset, uploadUrl };
    };

    /**
     * Get current upload offset from server
     * According to TUS protocol: HEAD returns 200 OK
     * Headers: Tus-Resumable (required), Upload-Length (required), Upload-Offset (required), Cache-Control: no-store
     * Can return 404, 410, or 403 if upload doesn't exist
     */
    const getUploadOffset = async (uploadUrl: string): Promise<number> => {
        const response = await fetch(uploadUrl, {
            headers: {
                "Tus-Resumable": TUS_RESUMABLE_VERSION,
            },
            method: "HEAD",
        });

        // TUS protocol: HEAD returns 200 OK, or 404/410/403 if upload doesn't exist
        if (!response.ok) {
            if (response.status === 404 || response.status === 410 || response.status === 403) {
                return 0; // Upload doesn't exist yet, start from beginning
            }

            throw new Error(`Failed to get upload offset: ${response.status} ${response.statusText}`);
        }

        const offsetHeader = response.headers.get("Upload-Offset");

        return offsetHeader ? Number.parseInt(offsetHeader, 10) : 0;
    };

    /**
     * Upload a single chunk
     * According to TUS protocol: PATCH returns 204 No Content
     * Headers: Tus-Resumable (required), Upload-Offset (required), Upload-Expires (optional)
     * Can return 409 Conflict if Upload-Offset doesn't match server's offset
     */
    const uploadChunk = async (file: File, uploadUrl: string, startOffset: number, signal: AbortSignal): Promise<number> => {
        const endOffset = Math.min(startOffset + chunkSize, file.size);
        const chunk = file.slice(startOffset, endOffset);

        const response = await fetch(uploadUrl, {
            body: chunk,
            headers: {
                "Content-Length": chunk.size.toString(), // Explicitly set Content-Length as required by TUS protocol
                "Content-Type": "application/offset+octet-stream",
                "Tus-Resumable": TUS_RESUMABLE_VERSION,
                "Upload-Offset": startOffset.toString(),
            },
            method: "PATCH",
            signal,
        });

        // TUS protocol: PATCH should return 204 No Content
        if (response.status !== 204) {
            if (response.status === 409) {
                // Offset mismatch (Upload-Offset doesn't match server's offset)
                // Get current offset and retry from that position
                const currentOffset = await getUploadOffset(uploadUrl);

                return currentOffset;
            }

            // Handle other error status codes
            if (response.status === 404 || response.status === 410) {
                throw new Error("Upload expired or not found");
            }

            if (response.status === 415) {
                throw new Error("Content-Type must be application/offset+octet-stream");
            }

            throw new Error(`Failed to upload chunk: ${response.status} ${response.statusText}`);
        }

        // TUS protocol: Response must include Upload-Offset header
        const newOffsetHeader = response.headers.get("Upload-Offset");

        if (!newOffsetHeader) {
            throw new Error("Missing Upload-Offset header in PATCH response");
        }

        return Number.parseInt(newOffsetHeader, 10);
    };

    /**
     * Perform the actual upload
     */
    const performUpload = async (file: File, uploadUrl: string, startOffset: number = 0): Promise<UploadResult> => {
        if (!uploadState) {
            throw new Error("Upload state not initialized");
        }

        let currentOffset = startOffset;

        while (currentOffset < file.size) {
            // Check if paused
            if (uploadState.isPaused) {
                await new Promise<void>((resolve) => {
                    const checkPause = (): void => {
                        if (uploadState?.isPaused) {
                            setTimeout(checkPause, 100);
                        } else {
                            resolve();
                        }
                    };

                    checkPause();
                });
            }

            // Check if aborted
            if (uploadState.abortController.signal.aborted) {
                throw new Error("Upload aborted");
            }

            try {
                currentOffset = await uploadChunk(file, uploadUrl, currentOffset, uploadState.abortController.signal);
                uploadState.offset = currentOffset;

                const progressPercent = Math.round((currentOffset / file.size) * 100);

                progressCallback?.(progressPercent, currentOffset);
            } catch (error_) {
                if (retry && uploadState.retryCount < maxRetries) {
                    uploadState.retryCount += 1;
                    // Wait before retry (exponential backoff)
                    await new Promise<void>((resolve) => setTimeout(resolve, 1000 * uploadState.retryCount));
                    // Get current offset and retry
                    currentOffset = await getUploadOffset(uploadUrl);

                    continue;
                }

                throw error_;
            }

            uploadState.retryCount = 0; // Reset retry count on successful chunk
        }

        // Upload complete, get final file info
        const headResponse = await fetch(uploadUrl, {
            headers: {
                "Tus-Resumable": TUS_RESUMABLE_VERSION,
            },
            method: "HEAD",
        });

        const location = headResponse.headers.get("Location") || uploadUrl;
        const uploadMetadata = decodeMetadata(headResponse.headers.get("Upload-Metadata"));

        // Try to parse response as FileMeta if available
        let fileMeta: Partial<FileMeta> = {};

        try {
            // Some TUS servers return file info in headers or we can construct it
            const contentType = headResponse.headers.get("Content-Type") || uploadMetadata.filetype || file.type;

            fileMeta = {
                contentType,
                id: uploadUrl.split("/").pop() || "",
                metadata: uploadMetadata,
                originalName: uploadMetadata.filename || file.name,
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
            id: fileMeta.id ?? uploadUrl.split("/").pop() ?? "",
            metadata: fileMeta.metadata ?? uploadMetadata,
            name: fileMeta.name,
            offset: currentOffset,
            originalName: fileMeta.originalName ?? file.name,
            size: fileMeta.size ?? file.size,
            status: (fileMeta.status as UploadResult["status"]) ?? "completed",
            url: location,
        };
    };

    return {
        /**
         * Abort the current upload
         */
        abort: () => {
            if (uploadState) {
                uploadState.abortController.abort();
                uploadState = null;
            }
        },

        /**
         * Clear all uploads
         */
        clear: () => {
            if (uploadState) {
                uploadState.abortController.abort();
                uploadState = null;
            }
        },

        /**
         * Get current upload offset
         */
        getOffset: () => uploadState?.offset ?? 0,

        /**
         * Whether upload is paused
         */
        isPaused: () => uploadState?.isPaused ?? false,

        /**
         * Pause the current upload
         */
        pause: () => {
            if (uploadState) {
                uploadState.isPaused = true;
            }
        },

        /**
         * Resume a paused upload
         */
        resume: async (): Promise<void> => {
            if (!uploadState || !uploadState.uploadUrl) {
                throw new Error("No upload to resume");
            }

            uploadState.isPaused = false;

            try {
                const currentOffset = await getUploadOffset(uploadState.uploadUrl);

                uploadState.offset = currentOffset;
                progressCallback?.(Math.round((currentOffset / uploadState.file.size) * 100), currentOffset);

                const uploadResult = await performUpload(uploadState.file, uploadState.uploadUrl, currentOffset);

                finishCallback?.(uploadResult);
            } catch (error_) {
                const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));

                errorCallback?.(uploadError);
                throw uploadError;
            }
        },

        /**
         * Set error callback
         */
        setOnError: (callback: ((error: Error) => void) | undefined) => {
            errorCallback = callback;
        },

        /**
         * Set finish callback
         */
        setOnFinish: (callback: ((result: UploadResult) => void) | undefined) => {
            finishCallback = callback;
        },

        /**
         * Set progress callback
         */
        setOnProgress: (callback: ((progress: number, offset: number) => void) | undefined) => {
            progressCallback = callback;
        },

        /**
         * Set start callback
         */
        setOnStart: (callback: (() => void) | undefined) => {
            startCallback = callback;
        },

        /**
         * Upload a file and return visulima-compatible result
         */
        upload: async (file: File): Promise<UploadResult> => new Promise((resolve, reject) => {
            let resolved = false;

            // Store original callbacks before overriding
            const originalFinishCallback = finishCallback;
            const originalErrorCallback = errorCallback;

            // Safety timeout - store timeout ID so we can clear it
            let timeoutId: NodeJS.Timeout | undefined;

            // Cleanup function to clear timeout and restore callbacks
            const cleanupTimeout = (): void => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = undefined;
                }
                // Restore original callbacks
                finishCallback = originalFinishCallback;
                errorCallback = originalErrorCallback;
            };

            // Set up internal callbacks for this upload
            const internalFinishCallback = (result: UploadResult) => {
                if (!resolved) {
                    resolved = true;
                    cleanupTimeout();
                    // Call original callback if set
                    originalFinishCallback?.(result);
                    uploadState = null;
                    resolve(result);
                }
            };

            const internalErrorCallback = (error: Error) => {
                if (!resolved) {
                    resolved = true;
                    cleanupTimeout();
                    // Call original callback if set
                    originalErrorCallback?.(error);

                    // Don't clear upload state on error if we want to resume
                    if (!retry || (uploadState && uploadState.retryCount >= maxRetries)) {
                        uploadState = null;
                    }

                    reject(error);
                }
            };

            // Temporarily override callbacks for this upload
            finishCallback = internalFinishCallback;
            errorCallback = internalErrorCallback;

            // Initialize upload state
            uploadState = {
                abortController: new AbortController(),
                file,
                isPaused: false,
                offset: 0,
                retryCount: 0,
                uploadUrl: null,
            };

            // Start upload process
            (async () => {
                try {
                    startCallback?.();

                    // Create upload or get existing upload URL
                    let uploadUrl = uploadState?.uploadUrl;

                    if (uploadUrl) {
                        // Check current offset for resuming
                        const currentOffset = await getUploadOffset(uploadUrl);

                        if (currentOffset > 0 && uploadState) {
                            uploadState.offset = currentOffset;
                            progressCallback?.(Math.round((currentOffset / file.size) * 100), currentOffset);
                        }
                    } else {
                        const { initialOffset, uploadUrl: newUploadUrl } = await createUpload(file);

                        uploadUrl = newUploadUrl;

                        if (uploadState) {
                            uploadState.uploadUrl = uploadUrl;
                            uploadState.offset = initialOffset;

                            // If initial offset > 0 (Creation With Upload extension), update progress
                            if (initialOffset > 0) {
                                progressCallback?.(Math.round((initialOffset / file.size) * 100), initialOffset);
                            }
                        }
                    }

                    if (!uploadState) {
                        throw new Error("Upload state lost");
                    }

                    const uploadResult = await performUpload(file, uploadUrl, uploadState.offset);

                    finishCallback(uploadResult);
                } catch (error_) {
                    errorCallback(error_ instanceof Error ? error_ : new Error(String(error_)));
                }
            })();

            // Set timeout
            timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanupTimeout();
                    uploadState = null;
                    reject(new Error("Upload timeout"));
                }
            }, 300_000); // 5 minutes
        }),
    };
};
