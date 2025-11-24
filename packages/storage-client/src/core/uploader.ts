import type { FileMeta } from "../react/types";

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
    /** Batch ID */
    id: string;
    /** Item IDs in this batch */
    itemIds: string[];
    /** Number of completed items */
    completedCount: number;
    /** Number of failed items */
    errorCount: number;
    /** Total number of items */
    totalCount: number;
    /** Aggregate progress (0-100) */
    progress: number;
    /** Batch status */
    status: "pending" | "uploading" | "completed" | "error" | "cancelled";
}

/**
 * Uploader event types
 */
export type UploaderEventType =
    | "ITEM_START"
    | "ITEM_PROGRESS"
    | "ITEM_FINISH"
    | "ITEM_ERROR"
    | "ITEM_ABORT"
    | "BATCH_START"
    | "BATCH_PROGRESS"
    | "BATCH_FINISH"
    | "BATCH_ERROR"
    | "BATCH_CANCELLED"
    | "BATCH_FINALIZE"
    | "BATCH_COMPLETE";

/**
 * Event handler function type
 */
export type UploaderEventHandler<T = UploadItem | BatchState> = (item: T) => void;

/**
 * Configuration options for the uploader.
 */
export interface UploaderOptions {
    /** Upload endpoint URL */
    endpoint: string;
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Additional metadata to include with the upload */
    metadata?: Record<string, string>;
    /** Enable automatic retry on failure */
    retry?: boolean;
}

/**
 * Uploader class - event-driven file uploader inspired by rpldy design
 */
export class Uploader {
    private items = new Map<string, UploadItem>();

    private batches = new Map<string, BatchState>();

    private eventHandlers = new Map<UploaderEventType, Set<UploaderEventHandler>>();

    private activeUploads = new Map<string, XMLHttpRequest>();

    private itemIdCounter = 0;

    private batchIdCounter = 0;

    constructor(private options: UploaderOptions) {}

    /**
     * Generates a unique item ID.
     */
    private generateItemId(): string {
        this.itemIdCounter += 1;

        return `item-${Date.now()}-${this.itemIdCounter}`;
    }

    /**
     * Generates a unique batch ID.
     */
    private generateBatchId(): string {
        this.batchIdCounter += 1;

        return `batch-${Date.now()}-${this.batchIdCounter}`;
    }

    /**
     * Calculates aggregate progress for a batch.
     */
    private calculateBatchProgress(batch: BatchState): number {
        const items = batch.itemIds.map((id) => this.items.get(id)).filter(Boolean) as UploadItem[];

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

        const items = batch.itemIds.map((id) => this.items.get(id)).filter(Boolean) as UploadItem[];

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
                    console.error(`[Uploader] Error in ${event} handler:`, error);
                }
            });
        }
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
     * Emits an event to all registered handlers.
     */
    private emit(event: UploaderEventType, item: UploadItem): void {
        const handlers = this.eventHandlers.get(event);

        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(item);
                } catch (error) {
                    console.error(`[Uploader] Error in ${event} handler:`, error);
                }
            });
        }
    }

    /**
     * Creates FormData for visulima multipart handler.
     */
    private createFormData(file: File, metadata?: Record<string, string>): FormData {
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
    private parseResponse(responseText: string, response: Response | XMLHttpRequest): Partial<FileMeta> {
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

    /**
     * Uploads a single file.
     */
    private async uploadFile(item: UploadItem): Promise<void> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = this.createFormData(item.file, this.options.metadata);

            // Store XHR for potential abort
            this.activeUploads.set(item.id, xhr);

            // Update item status
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
                    item.loaded = loaded;
                    item.completed = completed;
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
                    const responseText = xhr.responseText || xhr.response;
                    const fileMeta = this.parseResponse(responseText, xhr);

                    // Update item with response
                    item.status = "completed";
                    item.uploadResponse = {
                        data: fileMeta,
                        response: responseText,
                    };
                    item.url = fileMeta.url || xhr.getResponseHeader("Location") || undefined;

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
                    const error = new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`);

                    item.status = "error";
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

                item.status = "error";
                item.error = error.message;
                this.items.set(item.id, item);

                this.emit("ITEM_ERROR", item);

                // Update batch if item belongs to one
                if (item.batchId) {
                    this.updateBatchProgress(item.batchId);
                }

                reject(error);
            });

            // Handle abort
            xhr.addEventListener("abort", () => {
                this.activeUploads.delete(item.id);

                item.status = "aborted";
                this.items.set(item.id, item);

                // Emit abort event
                this.emit("ITEM_ABORT", item);

                // Update batch if item belongs to one
                if (item.batchId) {
                    const batch = this.batches.get(item.batchId);

                    if (batch) {
                        batch.status = "cancelled";
                        this.batches.set(item.batchId, batch);
                        this.emitBatch("BATCH_CANCELLED", batch);
                    }
                }

                reject(new Error("Upload aborted"));
            });

            // Open and send request
            xhr.open("POST", this.options.endpoint, true);

            // Set headers if metadata is provided
            if (this.options.metadata) {
                xhr.setRequestHeader("X-File-Metadata", JSON.stringify(this.options.metadata));
            }

            xhr.send(formData);
        });
    }

    /**
     * Adds a file to the upload queue.
     */
    public add(file: File, batchId?: string): string {
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

        // Start upload immediately
        this.uploadFile(item).catch((error) => {
            console.error(`[Uploader] Upload failed for item ${id}:`, error);
        });

        return id;
    }

    /**
     * Adds multiple files to the upload queue as a batch.
     */
    public addBatch(files: File[]): string[] {
        if (files.length === 0) {
            return [];
        }

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
        const xhr = this.activeUploads.get(id);

        if (xhr) {
            xhr.abort();
            this.activeUploads.delete(id);
        }

        const item = this.items.get(id);

        if (item) {
            item.status = "aborted";
            this.items.set(id, item);

            // Emit abort event
            this.emit("ITEM_ABORT", item);

            // Update batch if item belongs to one
            if (item.batchId) {
                const batch = this.batches.get(item.batchId);

                if (batch) {
                    batch.status = "cancelled";
                    this.batches.set(item.batchId, batch);
                    this.emitBatch("BATCH_CANCELLED", batch);
                }
            }
        }
    }

    /**
     * Aborts all uploads in a batch.
     */
    public abortBatch(batchId: string): void {
        const batch = this.batches.get(batchId);

        if (!batch) {
            return;
        }

        // Abort all items in the batch
        for (const itemId of batch.itemIds) {
            this.abortItem(itemId);
        }

        batch.status = "cancelled";
        this.batches.set(batchId, batch);
        this.emitBatch("BATCH_CANCELLED", batch);
    }

    /**
     * Aborts all uploads.
     */
    public abort(): void {
        this.activeUploads.forEach((xhr, id) => {
            xhr.abort();
            this.abortItem(id);
        });

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

        return batch.itemIds.map((id) => this.items.get(id)).filter(Boolean) as UploadItem[];
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

        // Start upload again
        this.uploadFile(item).catch((error) => {
            console.error(`[Uploader] Retry failed for item ${id}:`, error);
        });
    }

    /**
     * Retries all failed items in a batch.
     */
    public retryBatch(batchId: string): void {
        const batch = this.batches.get(batchId);

        if (!batch) {
            return;
        }

        const failedItems = batch.itemIds
            .map((id) => this.items.get(id))
            .filter((item): item is UploadItem => item !== undefined && item.status === "error");

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
}

/**
 * Creates a new uploader instance.
 */
export const createUploader = (options: UploaderOptions): Uploader => new Uploader(options);
