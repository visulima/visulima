import type { UploadResult } from "../react/types";

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB default chunk size

export interface ChunkedRestAdapterOptions {
    /** Chunk size in bytes (default: 5MB) */
    chunkSize?: number;
    /** Upload endpoint URL */
    endpoint: string;
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Enable automatic retry on failure */
    retry?: boolean;
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

interface UploadState {
    abortController?: AbortController;
    aborted: boolean;
    file?: File;
    fileId?: string;
    paused: boolean;
    totalSize: number;
    uploadedChunks: Set<number>; // Track uploaded chunk offsets
}

/**
 * Creates a chunked REST upload adapter.
 * This adapter uploads files in chunks using PATCH requests.
 * Supports pause/resume and handles out-of-order chunks.
 */
export const createChunkedRestAdapter = (options: ChunkedRestAdapterOptions): ChunkedRestAdapter => {
    const { chunkSize = DEFAULT_CHUNK_SIZE, endpoint, maxRetries = 3, metadata = {}, retry = true } = options;

    let uploadState: UploadState = {
        aborted: false,
        paused: false,
        totalSize: 0,
        uploadedChunks: new Set(),
    };

    let startCallback: (() => void) | undefined;
    let progressCallback: ((progress: number, offset: number) => void) | undefined;
    let finishCallback: ((result: UploadResult) => void) | undefined;
    let errorCallback: ((error: Error) => void) | undefined;

    /**
     * Retries a fetch request with exponential backoff.
     */
    const fetchWithRetry = async (url: string, init: RequestInit, retriesLeft = maxRetries): Promise<Response> => {
        try {
            const response = await fetch(url, init);

            if (!response.ok && retriesLeft > 0 && retry) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = 1000 * 2 ** (maxRetries - retriesLeft);

                await new Promise((resolve) => setTimeout(resolve, delay));

                return fetchWithRetry(url, init, retriesLeft - 1);
            }

            return response;
        } catch (error) {
            if (retriesLeft > 0 && retry) {
                const delay = 1000 * 2 ** (maxRetries - retriesLeft);

                await new Promise((resolve) => setTimeout(resolve, delay));

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
            headers["Content-Disposition"] = `attachment; filename="${file.name}"`;
        }

        const response = await fetchWithRetry(endpoint, {
            body: new Uint8Array(0), // Empty body for initialization
            headers,
            method: "POST",
        });

        if (!response.ok) {
            throw new Error(`Failed to create upload session: ${response.status} ${response.statusText}`);
        }

        const fileId = response.headers.get("X-Upload-ID") || response.headers.get("Location")?.split("/").pop();

        if (!fileId) {
            throw new Error("Failed to get upload ID from server");
        }

        return fileId;
    };

    /**
     * Gets upload status from server.
     */
    const getUploadStatus = async (fileId: string): Promise<{ chunks: { length: number; offset: number }[]; offset: number }> => {
        const url = endpoint.endsWith("/") ? `${endpoint}${fileId}` : `${endpoint}/${fileId}`;

        const response = await fetchWithRetry(url, {
            method: "HEAD",
        });

        if (!response.ok) {
            throw new Error(`Failed to get upload status: ${response.status} ${response.statusText}`);
        }

        const offset = Number.parseInt(response.headers.get("X-Upload-Offset") || "0", 10);
        const chunksHeader = response.headers.get("X-Received-Chunks");

        let chunks: { length: number; offset: number }[] = [];

        if (chunksHeader) {
            try {
                const parsed = JSON.parse(chunksHeader) as unknown;

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
        const chunkSize = endOffset - startOffset;

        // Skip if already uploaded
        if (uploadState.uploadedChunks.has(startOffset)) {
            return;
        }

        const url = endpoint.endsWith("/") ? `${endpoint}${fileId}` : `${endpoint}/${fileId}`;

        const response = await fetchWithRetry(url, {
            body: chunk,
            headers: {
                "Content-Length": String(chunkSize),
                "Content-Type": "application/octet-stream",
                "X-Chunk-Offset": String(startOffset),
            },
            method: "PATCH",
            signal,
        });

        if (!response.ok) {
            throw new Error(`Failed to upload chunk: ${response.status} ${response.statusText}`);
        }

        // Mark chunk as uploaded
        uploadState.uploadedChunks.add(startOffset);

        // Update progress
        const currentOffset = Number.parseInt(response.headers.get("X-Upload-Offset") || String(endOffset), 10);
        const progress = Math.round((currentOffset / file.size) * 100);

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

        // Upload chunks in parallel (but respect pause/abort)
        const uploadPromises: Promise<void>[] = [];

        for (let i = 0; i < totalChunks; i++) {
            const startOffset = i * chunkSize;
            const endOffset = Math.min(startOffset + chunkSize, file.size);

            // Skip if already uploaded
            if (uploadState.uploadedChunks.has(startOffset)) {
                continue;
            }

            // Skip if paused
            while (uploadState.paused && !uploadState.aborted) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            if (uploadState.aborted) {
                throw new Error("Upload aborted");
            }

            // Upload chunk
            uploadPromises.push(uploadChunk(file, fileId, startOffset, endOffset, signal));
        }

        // Wait for all chunks to upload
        await Promise.all(uploadPromises);

        // Verify upload is complete
        const finalStatus = await getUploadStatus(fileId);

        if (finalStatus.offset < file.size) {
            throw new Error(`Upload incomplete. Expected ${file.size} bytes, got ${finalStatus.offset}`);
        }

        // Parse response as FileMeta
        const url = endpoint.endsWith("/") ? `${endpoint}${fileId}` : `${endpoint}/${fileId}`;

        const response = await fetchWithRetry(url, {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(`Failed to get upload result: ${response.status} ${response.statusText}`);
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
            bytesWritten: fileMeta.bytesWritten || file.size,
            contentType: fileMeta.contentType || file.type,
            createdAt: fileMeta.createdAt,
            filename: fileMeta.originalName || file.name,
            id: fileMeta.id || fileId,
            metadata: fileMeta.metadata,
            name: fileMeta.name,
            originalName: fileMeta.originalName || file.name,
            size: fileMeta.size || file.size,
            status: (fileMeta.status as UploadResult["status"]) || "completed",
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
        },

        /**
         * Clears upload state.
         */
        clear: () => {
            uploadState = {
                abortController: undefined,
                aborted: false,
                paused: false,
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
                return [...uploadState.uploadedChunks].reduce((sum, offset) => {
                    const chunkEnd = Math.min(offset + chunkSize, uploadState.totalSize);

                    return sum + (chunkEnd - offset);
                }, 0);
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

            // Continue upload
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
        upload: async (file: File): Promise<UploadResult> =>
            new Promise((resolve, reject) => {
                let resolved = false;
                const originalFinishCallback = finishCallback;
                const originalErrorCallback = errorCallback;
                let timeoutId: NodeJS.Timeout | undefined;

                const cleanupTimeout = (): void => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = undefined;
                    }

                    finishCallback = originalFinishCallback;
                    errorCallback = originalErrorCallback;
                };

                const internalFinishCallback = (result: UploadResult) => {
                    if (!resolved) {
                        resolved = true;
                        cleanupTimeout();
                        originalFinishCallback?.(result);
                        resolve(result);
                    }
                };

                const internalErrorCallback = (error: Error) => {
                    if (!resolved) {
                        resolved = true;
                        cleanupTimeout();
                        originalErrorCallback?.(error);
                        reject(error);
                    }
                };

                finishCallback = internalFinishCallback;
                errorCallback = internalErrorCallback;

                uploadState = {
                    aborted: false,
                    file,
                    paused: false,
                    totalSize: file.size,
                    uploadedChunks: new Set(),
                };

                startCallback?.();

                (async () => {
                    try {
                        const abortController = new AbortController();

                        uploadState.abortController = abortController;

                        // Create upload session
                        const fileId = await createUpload(file);

                        uploadState.fileId = fileId;

                        // Perform upload
                        const result = await performUpload(file, fileId, abortController.signal);

                        internalFinishCallback(result);
                    } catch (error) {
                        const uploadError = error instanceof Error ? error : new Error(String(error));

                        internalErrorCallback(uploadError);
                    }
                })();

                // Safety timeout (5 minutes)
                timeoutId = setTimeout(() => {
                    if (!resolved) {
                        uploadState.aborted = true;
                        cleanupTimeout();
                        internalErrorCallback(new Error("Upload timeout"));
                    }
                }, 300_000);
            }),
    };
};
