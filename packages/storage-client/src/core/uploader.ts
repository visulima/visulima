import type { FileMeta } from "../react/types";

/**
 * Upload item state
 */
export interface UploadItem {
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
 * Uploader event types
 */
export type UploaderEventType = "ITEM_START" | "ITEM_PROGRESS" | "ITEM_FINISH" | "ITEM_ERROR" | "BATCH_COMPLETE";

/**
 * Event handler function type
 */
export type UploaderEventHandler<T = UploadItem> = (item: T) => void;

/**
 * Uploader options
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

    private eventHandlers = new Map<UploaderEventType, Set<UploaderEventHandler>>();

    private activeUploads = new Map<string, XMLHttpRequest>();

    private itemIdCounter = 0;

    constructor(private options: UploaderOptions) {}

    /**
     * Generate unique item ID
     */
    private generateItemId(): string {
        this.itemIdCounter += 1;

        return `item-${Date.now()}-${this.itemIdCounter}`;
    }

    /**
     * Subscribe to uploader events
     */
    public on(event: UploaderEventType, handler: UploaderEventHandler): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }

        this.eventHandlers.get(event)?.add(handler);
    }

    /**
     * Unsubscribe from uploader events
     */
    public off(event: UploaderEventType, handler: UploaderEventHandler): void {
        this.eventHandlers.get(event)?.delete(handler);
    }

    /**
     * Emit event to all registered handlers
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
     * Create FormData for visulima multipart handler
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
     * Parse response as FileMeta
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
     * Upload a single file
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

                    resolve();
                } else {
                    // Handle error response
                    const error = new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`);

                    item.status = "error";
                    item.error = error.message;
                    this.items.set(item.id, item);

                    this.emit("ITEM_ERROR", item);
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
                reject(error);
            });

            // Handle abort
            xhr.addEventListener("abort", () => {
                this.activeUploads.delete(item.id);

                item.status = "aborted";
                this.items.set(item.id, item);

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
     * Add file to upload queue
     */
    public add(file: File): string {
        const id = this.generateItemId();
        const item: UploadItem = {
            completed: 0,
            file,
            id,
            loaded: 0,
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
     * Get item by ID
     */
    public getItem(id: string): UploadItem | undefined {
        return this.items.get(id);
    }

    /**
     * Abort specific upload
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
        }
    }

    /**
     * Abort all uploads
     */
    public abort(): void {
        this.activeUploads.forEach((xhr, id) => {
            xhr.abort();
            this.abortItem(id);
        });

        this.activeUploads.clear();
    }

    /**
     * Clear all items and abort active uploads
     */
    public clear(): void {
        this.abort();
        this.items.clear();
    }

    /**
     * Get all items
     */
    public getItems(): UploadItem[] {
        return [...this.items.values()];
    }
}

/**
 * Create a new uploader instance
 */
export const createUploader = (options: UploaderOptions): Uploader => new Uploader(options);
