import { resolveRequestHeaders } from "./query-client";
import { validateFile, validateFiles } from "./restrictions";
import type { FileMeta, HeadersResolver, OnBeforeRequest, UploadRestrictions } from "./types";

/**
 * Upload item state
 */
export interface UploadItem {
    /** Batch ID this item belongs to (if part of a batch) */
    batchId?: string;
    /** Upload progress percentage (0-100) */
    completed: number;
    /** Error message if upload failed */
    error?: string;
    /** The file being uploaded */
    file: File;
    /** Unique item ID */
    id: string;
    /** Bytes uploaded so far */
    loaded: number;
    /** Number of retry attempts */
    retryCount?: number;
    /** Total file size in bytes */
    size: number;
    /** Upload status */
    status: "pending" | "uploading" | "completed" | "error" | "aborted";
    /** Upload response data */
    uploadResponse?: {
        data?: unknown;
        response?: string;
    };
    /** File URL after upload */
    url?: string;
}

/**
 * Batch state information
 */
export interface BatchState {
    /** Number of completed items */
    completedCount: number;
    /** Number of failed items */
    errorCount: number;
    /** Batch ID */
    id: string;
    /** Item IDs in this batch */
    itemIds: string[];
    /** Aggregate progress (0-100) */
    progress: number;
    /** Batch status */
    status: "pending" | "uploading" | "completed" | "error" | "cancelled";
    /** Total number of items */
    totalCount: number;
}

/**
 * Uploader event types
 */
export type UploaderEventType =
    | "BATCH_CANCELLED"
    | "BATCH_COMPLETE"
    | "BATCH_ERROR"
    | "BATCH_FINALIZE"
    | "BATCH_FINISH"
    | "BATCH_PROGRESS"
    | "BATCH_START"
    | "ITEM_ABORT"
    | "ITEM_ERROR"
    | "ITEM_FINISH"
    | "ITEM_PROGRESS"
    | "ITEM_START";

/**
 * Event handler function type
 */
export type UploaderEventHandler<T = UploadItem | BatchState> = (item: T) => void;

/**
 * Configuration options for the uploader.
 */
export interface UploaderOptions {
    /**
     * Maximum number of concurrent uploads. Excess files queue and start as slots
     * free up, so a large drop doesn't open hundreds of parallel requests
     * (cf. Uppy `limit`). Defaults to 5. Use `Infinity` for the previous
     * fire-everything-at-once behaviour.
     */
    concurrency?: number;
    /** Upload endpoint URL */
    endpoint: string;

    /**
     * Static or dynamically-resolved headers attached to every upload request.
     * Use this to attach an `Authorization` token to all requests.
     */
    headers?: HeadersResolver;
    /** Maximum number of retry attempts (only used when `retry` is true). Defaults to 3. */
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

    /**
     * Enable automatic retry on failure with exponential backoff. Off by default;
     * when off, only the manual `retryItem()` / `retryBatch()` paths apply.
     */
    retry?: boolean;
}

/**
 * Uploader class - event-driven file uploader inspired by rpldy design
 */
export class Uploader {
    /**
     * Creates FormData for visulima multipart handler.
     */
    private static createFormData(file: File, metadata?: Record<string, string>): FormData {
        const formData = new FormData();

        formData.append("file", file);

        if (metadata && Object.keys(metadata).length > 0) {
            formData.append("metadata", JSON.stringify(metadata));
        }

        return formData;
    }

    /**
     * Parses response as FileMeta.
     */
    private static parseResponse(responseText: string, response: Response | XMLHttpRequest): Partial<FileMeta> {
        try {
            // Try to parse as JSON
            const parsed = JSON.parse(responseText) as Partial<FileMeta>;

            return parsed;
        } catch {
            // If parsing fails, try to extract from response headers or use fallbacks
            const contentType = response instanceof XMLHttpRequest ? response.getResponseHeader("Content-Type") : response.headers.get("Content-Type");

            if (contentType?.includes("application/json")) {
                // Try again with error handling
                try {
                    return JSON.parse(responseText) as Partial<FileMeta>;
                } catch {
                    // Return empty object if parsing fails
                }
            }

            return {};
        }
    }

    private items = new Map<string, UploadItem>();

    private batches = new Map<string, BatchState>();

    private eventHandlers = new Map<UploaderEventType, Set<UploaderEventHandler>>();

    private activeUploads = new Map<string, XMLHttpRequest>();

    private itemIdCounter = 0;

    private batchIdCounter = 0;

    /** FIFO queue of item IDs waiting for a concurrency slot. */
    private queue: string[] = [];

    /** Number of uploads currently in flight (counts toward the concurrency cap). */
    private inFlight = 0;

    private readonly concurrency: number;

    private readonly maxRetries: number;

    public constructor(private readonly options: UploaderOptions) {
        this.concurrency = options.concurrency ?? 5;
        this.maxRetries = options.maxRetries ?? 3;
    }

    /**
     * Subscribes to uploader events.
     */
    public on(event: UploaderEventType, handler: UploaderEventHandler): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }

        this.eventHandlers.get(event)?.add(handler);
    }

    /**
     * Unsubscribes from uploader events.
     */
    public off(event: UploaderEventType, handler: UploaderEventHandler): void {
        this.eventHandlers.get(event)?.delete(handler);
    }

    /**
     * Adds a file to the upload queue.
     */
    public add(file: File, batchId?: string): string {
        // Reject files that violate the configured restrictions before queuing.
        validateFile(file, this.options.restrictions);

        const id = this.generateItemId();
        const item: UploadItem = {
            batchId,
            completed: 0,
            file,
            id,
            loaded: 0,
            retryCount: 0,
            size: file.size,
            status: "pending",
        };

        this.items.set(id, item);

        // Enqueue rather than firing immediately, so a large batch respects the
        // concurrency cap instead of opening one request per file at once.
        this.queue.push(id);
        this.pump();

        return id;
    }

    /**
     * Adds multiple files to the upload queue as a batch.
     */
    public addBatch(files: File[]): string[] {
        if (files.length === 0) {
            return [];
        }

        // Validate count + per-file restrictions up-front (throws RestrictionError).
        validateFiles(files, this.options.restrictions);

        const batchId = this.generateBatchId();
        const itemIds: string[] = [];

        // Create batch state
        const batch: BatchState = {
            completedCount: 0,
            errorCount: 0,
            id: batchId,
            itemIds: [],
            progress: 0,
            status: "pending",
            totalCount: files.length,
        };

        this.batches.set(batchId, batch);

        // Add all files to the batch
        for (const file of files) {
            const itemId = this.add(file, batchId);

            itemIds.push(itemId);
            batch.itemIds.push(itemId);
        }

        this.batches.set(batchId, batch);

        // Emit batch start event
        batch.status = "uploading";
        this.emitBatch("BATCH_START", batch);

        return itemIds;
    }

    /**
     * Gets an item by ID.
     */
    public getItem(id: string): UploadItem | undefined {
        return this.items.get(id);
    }

    /**
     * Aborts a specific upload.
     */
    public abortItem(id: string): void {
        this.abortItemInternal(id, false);
    }

    /**
     * Aborts all uploads in a batch.
     */
    public abortBatch(batchId: string): void {
        const batch = this.batches.get(batchId);

        if (!batch) {
            return;
        }

        // Abort all items in the batch, deferring the batch event to the single
        // emit below so listeners fire once instead of once per item.
        for (const itemId of batch.itemIds) {
            this.abortItemInternal(itemId, true);
        }

        // Derive the final batch status from item states rather than hard-coding
        // "cancelled", so a batch with already-completed items isn't reported as
        // fully cancelled (losing the completed/error counts).
        const items = batch.itemIds.map((id) => this.items.get(id)).filter(Boolean);
        const hasCompleted = items.some((item) => item.status === "completed");

        batch.completedCount = items.filter((item) => item.status === "completed").length;
        batch.errorCount = items.filter((item) => item.status === "error").length;

        if (hasCompleted) {
            batch.status = "error";
            this.batches.set(batchId, batch);
            this.emitBatch("BATCH_ERROR", batch);
        } else {
            batch.status = "cancelled";
            this.batches.set(batchId, batch);
            this.emitBatch("BATCH_CANCELLED", batch);
        }
    }

    /**
     * Aborts all uploads.
     */
    public abort(): void {
        // Drain queued-but-not-started items first so the concurrency pump can't
        // restart them once the in-flight uploads settle.
        const queuedIds = [...this.queue];

        this.queue = [];

        for (const id of queuedIds) {
            this.abortItemInternal(id, false);
        }

        const activeIds = [...this.activeUploads.keys()];

        for (const id of activeIds) {
            this.abortItemInternal(id, false);
        }

        this.activeUploads.clear();
    }

    /**
     * Clears all items and aborts active uploads.
     */
    public clear(): void {
        this.abort();
        this.items.clear();
    }

    /**
     * Gets all items.
     */
    public getItems(): UploadItem[] {
        return [...this.items.values()];
    }

    /**
     * Gets all items in a batch.
     */
    public getBatchItems(batchId: string): UploadItem[] {
        const batch = this.batches.get(batchId);

        if (!batch) {
            return [];
        }

        return batch.itemIds.map((id) => this.items.get(id)).filter(Boolean);
    }

    /**
     * Gets batch state by batch ID.
     */
    public getBatch(batchId: string): BatchState | undefined {
        return this.batches.get(batchId);
    }

    /**
     * Gets all batches.
     */
    public getBatches(): BatchState[] {
        return [...this.batches.values()];
    }

    /**
     * Retries a failed upload item.
     */
    public retryItem(id: string): void {
        const item = this.items.get(id);

        if (!item) {
            return;
        }

        if (item.status !== "error") {
            return;
        }

        // Increment retry count
        item.retryCount = (item.retryCount ?? 0) + 1;
        item.status = "pending";
        item.error = undefined;
        item.completed = 0;
        item.loaded = 0;

        this.items.set(id, item);

        // Re-queue through the concurrency pump instead of firing immediately, so
        // retrying a large failed batch respects the concurrency cap.
        this.queue.push(id);
        this.pump();
    }

    /**
     * Retries all failed items in a batch.
     */
    public retryBatch(batchId: string): void {
        const batch = this.batches.get(batchId);

        if (!batch) {
            return;
        }

        const failedItems = batch.itemIds.map((id) => this.items.get(id)).filter((item): item is UploadItem => item?.status === "error");

        for (const item of failedItems) {
            this.retryItem(item.id);
        }

        // Reset batch state
        batch.status = "uploading";
        batch.completedCount = 0;
        batch.errorCount = 0;
        batch.progress = 0;
        this.batches.set(batchId, batch);
        this.emitBatch("BATCH_START", batch);
    }

    /**
     * Aborts a single item. `suppressBatchEmit` avoids per-item batch events when
     * the abort is driven by `abortBatch`/`abort`, which emit once at the end.
     */
    private abortItemInternal(id: string, suppressBatchEmit: boolean): void {
        // Drop the item from the pending queue so `pump()` never starts it.
        const queueIndex = this.queue.indexOf(id);

        if (queueIndex !== -1) {
            this.queue.splice(queueIndex, 1);
        }

        const xhr = this.activeUploads.get(id);

        if (xhr) {
            this.activeUploads.delete(id);
            xhr.abort();
        }

        const item = this.items.get(id);

        // Only transition items that haven't reached a terminal state.
        if (item && item.status !== "completed" && item.status !== "error" && item.status !== "aborted") {
            item.status = "aborted";
            this.items.set(id, item);

            // Emit abort event
            this.emit("ITEM_ABORT", item);

            // Update batch if item belongs to one
            if (item.batchId) {
                this.updateBatchAfterAbort(item.batchId, suppressBatchEmit);
            }
        }
    }

    /**
     * Recomputes a batch's status after one of its items was aborted. The batch is
     * only reported cancelled/errored once no sibling item is still active, so
     * aborting one file out of many does not flip the whole batch prematurely.
     */
    private updateBatchAfterAbort(batchId: string, suppressEmit: boolean): void {
        const batch = this.batches.get(batchId);

        if (!batch) {
            return;
        }

        const items = batch.itemIds.map((id) => this.items.get(id)).filter(Boolean);

        batch.completedCount = items.filter((item) => item.status === "completed").length;
        batch.errorCount = items.filter((item) => item.status === "error").length;

        // Leave the status untouched while any sibling item is still in flight.
        if (items.some((item) => item.status === "pending" || item.status === "uploading")) {
            this.batches.set(batchId, batch);

            return;
        }

        batch.status = batch.completedCount > 0 ? "error" : "cancelled";
        this.batches.set(batchId, batch);

        if (!suppressEmit) {
            this.emitBatch(batch.status === "error" ? "BATCH_ERROR" : "BATCH_CANCELLED", batch);
        }
    }

    /**
     * Starts queued uploads up to the concurrency limit.
     */
    private pump(): void {
        while (this.inFlight < this.concurrency && this.queue.length > 0) {
            const id = this.queue.shift();

            if (id === undefined) {
                break;
            }

            const item = this.items.get(id);

            // Skip items that were aborted/removed while queued.
            if (item?.status !== "pending") {
                continue;
            }

            this.inFlight += 1;

            // eslint-disable-next-line promise/catch-or-return -- Fire-and-forget worker; errors are handled in .catch(), .finally() re-pumps the queue
            this.uploadFile(item)
                .catch((error: unknown) => {
                    // eslint-disable-next-line no-console -- Error logging for debugging
                    console.error(`[Uploader] Upload failed for item ${id}:`, error);
                })
                .finally(() => {
                    this.inFlight -= 1;
                    this.pump();
                });
        }
    }

    /**
     * Generates a unique item ID.
     */
    private generateItemId(): string {
        this.itemIdCounter += 1;

        return `item-${String(Date.now())}-${String(this.itemIdCounter)}`;
    }

    /**
     * Generates a unique batch ID.
     */
    private generateBatchId(): string {
        this.batchIdCounter += 1;

        return `batch-${String(Date.now())}-${String(this.batchIdCounter)}`;
    }

    /**
     * Calculates aggregate progress for a batch.
     */
    private calculateBatchProgress(batch: BatchState): number {
        const items = batch.itemIds.map((id) => this.items.get(id)).filter(Boolean);

        if (items.length === 0) {
            return 0;
        }

        const totalSize = items.reduce((sum, item) => sum + item.size, 0);
        const loadedSize = items.reduce((sum, item) => sum + item.loaded, 0);

        return totalSize > 0 ? Math.round((loadedSize / totalSize) * 100) : 0;
    }

    /**
     * Updates batch state and emits batch progress event.
     */
    private updateBatchProgress(batchId: string): void {
        const batch = this.batches.get(batchId);

        if (!batch) {
            return;
        }

        const items = batch.itemIds.map((id) => this.items.get(id)).filter(Boolean);

        batch.completedCount = items.filter((item) => item.status === "completed").length;
        batch.errorCount = items.filter((item) => item.status === "error").length;
        batch.progress = this.calculateBatchProgress(batch);

        // Update batch status
        if (batch.completedCount + batch.errorCount === batch.totalCount) {
            if (batch.errorCount > 0 && batch.completedCount > 0) {
                batch.status = "error";
            } else if (batch.errorCount === batch.totalCount) {
                batch.status = "error";
            } else {
                batch.status = "completed";
            }
        } else if (batch.completedCount > 0 || batch.errorCount > 0) {
            batch.status = "uploading";
        }

        this.batches.set(batchId, batch);

        // Emit batch progress event
        this.emitBatch("BATCH_PROGRESS", batch);

        // Check if batch is complete
        if (batch.completedCount + batch.errorCount === batch.totalCount) {
            if (batch.status === "completed") {
                this.emitBatch("BATCH_FINISH", batch);
            } else if (batch.status === "error") {
                this.emitBatch("BATCH_ERROR", batch);
            }

            // Emit finalize event after a short delay to allow listeners to process
            setTimeout(() => {
                this.emitBatch("BATCH_FINALIZE", batch);
            }, 0);
        }
    }

    /**
     * Emits a batch event to all registered handlers.
     */
    private emitBatch(event: UploaderEventType, batch: BatchState): void {
        const handlers = this.eventHandlers.get(event);

        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(batch);
                } catch (error) {
                    // eslint-disable-next-line no-console -- Error logging for debugging
                    console.error(`[Uploader] Error in ${event} handler:`, error);
                }
            });
        }
    }

    /**
     * Emits an event to all registered handlers.
     */
    private emit(event: UploaderEventType, item: UploadItem): void {
        const handlers = this.eventHandlers.get(event);

        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(item);
                } catch (error) {
                    // eslint-disable-next-line no-console -- Error logging for debugging
                    console.error(`[Uploader] Error in ${event} handler:`, error);
                }
            });
        }
    }

    /**
     * Uploads a single file.
     */

    /**
     * Schedules an automatic retry of a failed item when `retry` is enabled and
     * the per-item retry budget is not exhausted. Returns true when a retry was
     * scheduled (so the caller should not surface a terminal error).
     */
    private maybeAutoRetry(item: UploadItem): boolean {
        if (!this.options.retry) {
            return false;
        }

        const currentRetries = item.retryCount ?? 0;

        if (currentRetries >= this.maxRetries) {
            return false;
        }

        /* eslint-disable no-param-reassign -- Required to reset item state for the retry attempt */
        item.retryCount = currentRetries + 1;
        item.status = "pending";
        item.error = undefined;
        item.completed = 0;
        item.loaded = 0;
        /* eslint-enable no-param-reassign -- Required to reset item state for the retry attempt */
        this.items.set(item.id, item);

        // Exponential backoff: 1s, 2s, 4s, ...
        const delay = 1000 * 2 ** currentRetries;

        setTimeout(() => {
            const current = this.items.get(item.id);

            // Only re-queue if still pending (not aborted/cleared meanwhile).
            if (current?.status === "pending") {
                this.queue.push(item.id);
                this.pump();
            }
        }, delay);

        return true;
    }

    private uploadFile(item: UploadItem): Promise<void> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = Uploader.createFormData(item.file, this.options.metadata);

            // Store XHR for potential abort
            this.activeUploads.set(item.id, xhr);

            // Update item status
            // eslint-disable-next-line no-param-reassign -- Required to update item state
            item.status = "uploading";
            this.items.set(item.id, item);

            // Emit start event
            this.emit("ITEM_START", item);

            // Track upload progress
            xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                    const { loaded } = event;
                    const { total } = event;
                    const completed = Math.round((loaded / total) * 100);

                    // Update item progress
                    // eslint-disable-next-line no-param-reassign -- Required to update item state
                    item.loaded = loaded;
                    // eslint-disable-next-line no-param-reassign -- Required to update item state
                    item.completed = completed;
                    // eslint-disable-next-line no-param-reassign -- Required to update item state
                    item.size = total;

                    // Update stored item
                    this.items.set(item.id, item);

                    // Emit progress event
                    this.emit("ITEM_PROGRESS", item);

                    // Update batch if item belongs to one
                    if (item.batchId) {
                        this.updateBatchProgress(item.batchId);
                    }
                }
            });

            // Handle completion
            xhr.addEventListener("load", () => {
                this.activeUploads.delete(item.id);

                if (xhr.status >= 200 && xhr.status < 300) {
                    // Parse response
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- xhr.response is typed as `any` by lib.dom
                    const responseText: string = xhr.responseText || xhr.response;
                    const fileMeta = Uploader.parseResponse(responseText, xhr);

                    // Update item with response
                    // eslint-disable-next-line no-param-reassign -- Required to update item state
                    item.status = "completed";
                    // eslint-disable-next-line no-param-reassign -- Required to update item state
                    item.uploadResponse = {
                        data: fileMeta,
                        response: responseText,
                    };
                    // eslint-disable-next-line no-param-reassign -- Required to update item state
                    item.url = xhr.getResponseHeader("Location") ?? undefined;

                    this.items.set(item.id, item);

                    // Emit finish event
                    this.emit("ITEM_FINISH", item);

                    // Update batch if item belongs to one
                    if (item.batchId) {
                        this.updateBatchProgress(item.batchId);
                    }

                    resolve();
                } else {
                    // Handle error response
                    const error = new Error(`Upload failed: ${String(xhr.status)} ${xhr.statusText}`);

                    // Auto-retry (opt-in) before reporting a terminal error.
                    if (this.maybeAutoRetry(item)) {
                        resolve();

                        return;
                    }

                    // eslint-disable-next-line no-param-reassign -- Required to update item state
                    item.status = "error";
                    // eslint-disable-next-line no-param-reassign -- Required to update item state
                    item.error = error.message;
                    this.items.set(item.id, item);

                    this.emit("ITEM_ERROR", item);

                    // Update batch if item belongs to one
                    if (item.batchId) {
                        this.updateBatchProgress(item.batchId);
                    }

                    reject(error);
                }
            });

            // Handle errors
            xhr.addEventListener("error", () => {
                this.activeUploads.delete(item.id);

                const error = new Error("Network error during upload");

                // Auto-retry (opt-in) before reporting a terminal error.
                if (this.maybeAutoRetry(item)) {
                    resolve();

                    return;
                }

                // eslint-disable-next-line no-param-reassign -- Required to update item state
                item.status = "error";
                // eslint-disable-next-line no-param-reassign -- Required to update item state
                item.error = error.message;
                this.items.set(item.id, item);

                this.emit("ITEM_ERROR", item);

                // Update batch if item belongs to one
                if (item.batchId) {
                    this.updateBatchProgress(item.batchId);
                }

                reject(error);
            });

            // Handle abort. The item/batch state transition and events are owned by
            // abortItemInternal (the only caller of xhr.abort()); this listener just
            // settles the upload promise so the concurrency pump can advance.
            xhr.addEventListener("abort", () => {
                this.activeUploads.delete(item.id);

                reject(new Error("Upload aborted"));
            });

            // Open and send request
            xhr.open("POST", this.options.endpoint, true);

            // Set headers if metadata is provided
            if (this.options.metadata) {
                xhr.setRequestHeader("X-File-Metadata", JSON.stringify(this.options.metadata));
            }

            // Resolve and attach custom/auth headers, then send. ITEM_START has
            // already been emitted synchronously above so listeners fire eagerly
            // regardless of whether the header resolver is async.
            resolveRequestHeaders(this.options.endpoint, "POST", this.options.headers, this.options.onBeforeRequest)
                .then((customHeaders) => {
                    for (const [key, value] of Object.entries(customHeaders)) {
                        xhr.setRequestHeader(key, value);
                    }

                    xhr.send(formData);

                    return undefined;
                })
                .catch((error: unknown) => {
                    this.activeUploads.delete(item.id);

                    const resolveError = error instanceof Error ? error : new Error(String(error));

                    // eslint-disable-next-line no-param-reassign -- Required to update item state
                    item.status = "error";
                    // eslint-disable-next-line no-param-reassign -- Required to update item state
                    item.error = resolveError.message;
                    this.items.set(item.id, item);

                    this.emit("ITEM_ERROR", item);

                    if (item.batchId) {
                        this.updateBatchProgress(item.batchId);
                    }

                    reject(resolveError);
                });
        });
    }
}

/**
 * Creates a new uploader instance.
 */
export const createUploader = (options: UploaderOptions): Uploader => new Uploader(options);
