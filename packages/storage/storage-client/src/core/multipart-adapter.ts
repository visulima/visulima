import type { FileMeta, HeadersResolver, OnBeforeRequest, UploadRestrictions, UploadResult } from "./types";
import type { BatchState, Uploader, UploadItem } from "./uploader";
import { createUploader } from "./uploader";

export interface MultipartAdapterOptions {
    /** Maximum number of concurrent uploads (defaults to 5). */
    concurrency?: number;
    /** Upload endpoint URL */
    endpoint: string;

    /**
     * Static or dynamically-resolved headers attached to every upload request.
     * Use this to attach an `Authorization` token to all requests.
     */
    headers?: HeadersResolver;
    /** Maximum number of retry attempts (only used when `retry` is true). */
    maxRetries?: number;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;

    /**
     * Per-request hook returning extra headers, given the outgoing request
     * context (`url`, `method`, already-resolved `headers`). Runs after the
     * `headers` resolver and merges over it.
     */
    onBeforeRequest?: OnBeforeRequest;
    /** Client-side upload restrictions, validated before upload starts. */
    restrictions?: UploadRestrictions;
    /** Enable automatic retry on failure with exponential backoff (off by default). */
    retry?: boolean;

    /**
     * Inactivity timeout in milliseconds. When set, `upload()` rejects if no
     * progress is observed for this long (the timer resets on every progress
     * event). Off by default, so long-running uploads are never force-aborted.
     */
    uploadTimeoutMs?: number;
}

export interface MultipartAdapter {
    /** Abort all uploads */
    abort: () => void;
    /** Abort a batch of uploads */
    abortBatch: (batchId: string) => void;
    /** Abort a specific upload item */
    abortItem: (id: string) => void;
    /** Clear all uploads */
    clear: () => void;
    /** Upload a file and return visulima-compatible result */
    upload: (file: File) => Promise<UploadResult>;
    /** Upload multiple files as a batch and return item IDs */
    uploadBatch: (files: File[]) => string[];
    /** The underlying uploader instance */
    uploader: Uploader;
}

/**
 * Creates a multipart upload adapter.
 * This adapter provides a clean interface for multipart file uploads
 * with proper progress tracking and event handling.
 */
export const createMultipartAdapter = (options: MultipartAdapterOptions): MultipartAdapter => {
    const uploader = createUploader({
        concurrency: options.concurrency,
        endpoint: options.endpoint,
        headers: options.headers,
        maxRetries: options.maxRetries,
        metadata: options.metadata,
        onBeforeRequest: options.onBeforeRequest,
        restrictions: options.restrictions,
        retry: options.retry,
    });

    return {
        /**
         * Aborts all uploads.
         */
        abort: () => {
            uploader.abort();
        },

        /**
         * Aborts a batch of uploads.
         */
        abortBatch: (batchId: string) => {
            uploader.abortBatch(batchId);
        },

        /**
         * Aborts a specific upload item.
         */
        abortItem: (id: string) => {
            uploader.abortItem(id);
        },

        /**
         * Clears all uploads.
         */
        clear: () => {
            uploader.clear();
        },

        /**
         * Uploads a file and returns visulima-compatible result.
         */
        upload: async (file: File): Promise<UploadResult> =>
            new Promise<UploadResult>((resolve, reject) => {
                let resolved = false;
                let timeoutId: ReturnType<typeof setTimeout> | undefined;
                let itemId: string | undefined;

                const parseFileMeta = (item: UploadItem): Partial<FileMeta> => {
                    let fileMeta: Partial<FileMeta> = {};

                    try {
                        if (item.uploadResponse?.data && typeof item.uploadResponse.data === "object") {
                            fileMeta = item.uploadResponse.data;
                        } else if (item.uploadResponse?.response) {
                            fileMeta = JSON.parse(item.uploadResponse.response) as Partial<FileMeta>;
                        }
                    } catch {
                        // Use fallback values if parsing fails
                    }

                    return fileMeta;
                };

                const buildUploadResult = (item: UploadItem, fileMeta: Partial<FileMeta>): UploadResult => {
                    return {
                        bytesWritten: fileMeta.bytesWritten,
                        contentType: fileMeta.contentType ?? item.file.type,
                        createdAt: fileMeta.createdAt,
                        filename: fileMeta.originalName ?? item.file.name,
                        id: fileMeta.id ?? item.id,
                        metadata: fileMeta.metadata,
                        name: fileMeta.name,
                        originalName: fileMeta.originalName ?? item.file.name,
                        size: fileMeta.size ?? item.file.size,
                        status: fileMeta.status ?? "completed",
                        url: item.url,
                    };
                };

                const onItemFinish = (itemOrBatch: UploadItem | BatchState): void => {
                    if ("file" in itemOrBatch && !resolved && itemOrBatch.id === itemId) {
                        const item = itemOrBatch;
                        const fileMeta = parseFileMeta(item);
                        const uploadResult = buildUploadResult(item, fileMeta);

                        resolved = true;
                        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- cleanup is defined later but not invoked until callback runs
                        cleanup();
                        resolve(uploadResult);
                    }
                };

                const onError = (itemOrBatch: UploadItem | BatchState): void => {
                    if ("file" in itemOrBatch && !resolved && itemOrBatch.id === itemId) {
                        const item = itemOrBatch;
                        const error = new Error(item.error ?? "Upload failed");

                        resolved = true;
                        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- cleanup is defined later but not invoked until callback runs
                        cleanup();
                        reject(error);
                    }
                };

                const onAbort = (itemOrBatch: UploadItem | BatchState): void => {
                    if ("file" in itemOrBatch && !resolved && itemOrBatch.id === itemId) {
                        resolved = true;
                        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- cleanup is defined later but not invoked until callback runs
                        cleanup();
                        reject(new Error("Upload aborted"));
                    }
                };

                const onTimeout = (): void => {
                    if (!resolved) {
                        resolved = true;
                        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- cleanup is defined later but not invoked until callback runs
                        cleanup();
                        reject(new Error("Upload timeout"));
                    }
                };

                const armTimeout = (): void => {
                    if (!options.uploadTimeoutMs || options.uploadTimeoutMs <= 0) {
                        return;
                    }

                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }

                    timeoutId = setTimeout(onTimeout, options.uploadTimeoutMs);
                };

                // Reset the inactivity timeout on every progress tick.
                const onProgress = (itemOrBatch: UploadItem | BatchState): void => {
                    if ("file" in itemOrBatch && !resolved && itemOrBatch.id === itemId) {
                        armTimeout();
                    }
                };

                const cleanup = (): void => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = undefined;
                    }

                    uploader.off("ITEM_FINISH", onItemFinish);
                    uploader.off("ITEM_ERROR", onError);
                    uploader.off("ITEM_ABORT", onAbort);
                    uploader.off("ITEM_PROGRESS", onProgress);
                };

                uploader.on("ITEM_FINISH", onItemFinish);
                uploader.on("ITEM_ERROR", onError);
                uploader.on("ITEM_ABORT", onAbort);
                uploader.on("ITEM_PROGRESS", onProgress);

                itemId = uploader.add(file);

                armTimeout();
            }),

        /**
         * Uploads multiple files as a batch and returns item IDs.
         */
        uploadBatch: (files: File[]): string[] => uploader.addBatch(files),
        uploader,
    };
};
