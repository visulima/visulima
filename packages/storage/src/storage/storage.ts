import { Readable } from "node:stream";
import { setInterval } from "node:timers";
import { inspect } from "node:util";

// eslint-disable-next-line import/no-extraneous-dependencies
import { parseBytes } from "@visulima/humanizer";
// eslint-disable-next-line import/no-extraneous-dependencies
import { isAbsolute, normalize } from "@visulima/path";
import typeis from "type-is";

import { NoOpMetrics } from "../metrics";
import type { Cache } from "../utils/cache";
import { NoOpCache } from "../utils/cache";
import type { ErrorResponses } from "../utils/errors";
import { ErrorMap, ERRORS, throwErrorCode } from "../utils/errors";
import Locker from "../utils/locker";
import toMilliseconds from "../utils/primitives/to-milliseconds";
import type { HttpError, Metrics, ValidatorConfig } from "../utils/types";
import { Validator } from "../utils/validator";
import type MetaStorage from "./meta-storage";
import type { BaseStorageOptions, BatchOperationResponse, PurgeList } from "./types";
import type { File, FileInit, FilePart, FileQuery } from "./utils/file";
import { isExpired, updateMetadata } from "./utils/file";
import type { FileReturn } from "./utils/file/types";

const defaults: BaseStorageOptions = {
    allowMIME: ["*/*"],
    filename: ({ id }: File): string => id,
    maxMetadataSize: "8MB",
    maxUploadSize: "5TB",
    onComplete: () => {
        // No return value needed - hook modifies response in place
    },
    onCreate: () => {
        // No return value needed - hook is for side effects only
    },
    onDelete: () => {
        // No return value needed - hook is for side effects only
    },
    onError: () => {
        // No return value needed - hook modifies error in place
    },
    onUpdate: () => {
        // No return value needed - hook is for side effects only
    },
    useRelativeLocation: false,
    validation: {},
};

/**
 * Default filename validation for cloud storage platforms.
 * Permissive validation that only blocks dangerous patterns (path traversal, null bytes).
 * Cloud storage platforms (S3, Azure, GCS) accept most special characters and handle URL encoding automatically.
 */
export const defaultCloudStorageFileNameValidation = (name: string): boolean => {
    if (!name || name.length < 3 || name.length > 255 || isAbsolute(name)) {
        return false;
    }

    const upperCase = name.toUpperCase();

    // Block path traversal and null bytes
    return !(upperCase.includes("../") || name.includes("\0"));
};

/**
 * Default filename validation for local filesystems.
 * Stricter validation that blocks filesystem-incompatible characters.
 */
export const defaultFilesystemFileNameValidation = (name: string): boolean => {
    if (!name || name.length < 3 || name.length > 255 || isAbsolute(name)) {
        return false;
    }

    const upperCase = name.toUpperCase();
    const filesystemInvalidChars = ["\"", "*", ":", "<", ">", "?", "\\", "|", "../", "\0"];

    return !filesystemInvalidChars.some((char) => upperCase.includes(char));
};

/**
 * Abstract base class for all storage backends.
 * @template TFile The file type used by this storage backend.
 * @template TFileReturn The return type for file retrieval operations.
 * @remarks
 * ## Error Handling
 *
 * All storage operations follow consistent error handling patterns:
 * - Operations throw `UploadError` with specific error codes (see ERRORS enum)
 * - Common error codes: FILE_NOT_FOUND, GONE (expired), FILE_LOCKED, STORAGE_BUSY
 * - Errors are normalized with storage class context via `normalizeError()`
 * - Batch operations capture individual failures without stopping the batch
 *
 * ## Retry Behavior
 *
 * Storage implementations handle retries differently:
 *
 * ### Cloud Storage (S3, GCS, Azure, Netlify Blob)
 * - Use configurable retry wrappers via `retryConfig` option
 * - Default retryable status codes: 408, 429, 500, 502, 503, 504
 * - Retry logic handles transient network errors and rate limiting
 * - Custom `shouldRetry` functions can be provided for advanced retry logic
 *
 * ### Local Storage (DiskStorage)
 * - No automatic retries (filesystem operations are typically immediate)
 * - Errors are thrown directly for immediate feedback
 *
 * ## Operation Instrumentation
 *
 * All public operations are automatically instrumented via `instrumentOperation()`:
 * - Metrics are recorded for operation count, duration, and errors
 * - File sizes are tracked for operations that return file objects
 * - Error metrics include error messages for debugging
 *
 * ## Metadata Caching
 *
 * File metadata is automatically cached to reduce storage API calls:
 * - Cache is updated on save, delete, and get operations
 * - Cache is invalidated when metadata is deleted
 * - Implementations can override caching behavior if needed
 */
export abstract class BaseStorage<TFile extends File = File, TFileReturn extends FileReturn = FileReturn> {
    /**
     * Hook called when a new file is created.
     * @param file The newly created file object.
     * @remarks This hook is called after file metadata is saved but before returning the file.
     * Can be used for side effects like logging, notifications, or custom processing.
     */
    public onCreate: (file: TFile) => Promise<void> | void;

    /**
     * Hook called when file metadata is updated.
     * @param file The updated file object.
     * @remarks This hook is called after metadata is updated and saved.
     * Can be used for side effects like logging or custom processing.
     */
    public onUpdate: (file: TFile) => Promise<void> | void;

    /**
     * Hook called when a file upload is completed.
     * @param file The completed file object.
     * @param response The response object that can be modified in place (headers, statusCode, body).
     * @param request Optional request object for additional context.
     * @remarks This hook is called when file status becomes "completed".
     * The response object can be modified directly to add headers or change the status code.
     */
    public onComplete: (file: TFile, response: unknown, request?: unknown) => Promise<void> | void;

    /**
     * Hook called when a file is deleted.
     * @param file The deleted file object.
     * @remarks This hook is called after the file is deleted but before returning.
     * Can be used for side effects like cleanup or logging.
     */
    public onDelete: (file: TFile) => Promise<void> | void;

    /**
     * Hook called when an error occurs during storage operations.
     * @param error The HTTP error object that can be modified in place.
     * @remarks This hook allows customizing error responses by modifying the error object.
     * The error object can be modified to change headers, statusCode, or body properties.
     * Error formatting happens in handlers after this hook is called.
     */
    public onError: (error: HttpError) => Promise<void> | void;

    public isReady = true;

    public errorResponses = {} as ErrorResponses;

    public cache: Cache<string, TFile>;

    public readonly logger?: Console;

    public readonly metrics: Metrics;

    public readonly genericConfig: BaseStorageOptions<TFile>;

    public maxMetadataSize: number;

    public checksumTypes: string[] = [];

    public maxUploadSize: number;

    protected expiration?: { maxAge?: string | number; purgeInterval?: string | number; rolling?: boolean };

    protected locker: Locker;

    protected namingFunction: (file: TFile) => string;

    protected validation: Validator<TFile> = new Validator<TFile>();

    protected abstract meta: MetaStorage<TFile>;

    protected assetFolder: string | undefined = undefined;

    /**
     * Limits the number of concurrent upload requests
     */
    protected concurrency?: number;

    protected constructor(config: BaseStorageOptions<TFile>) {
        const options = { ...defaults, ...config } as Required<BaseStorageOptions<TFile>>;

        this.onCreate = options.onCreate;
        this.onUpdate = options.onUpdate;
        this.onComplete = options.onComplete;
        this.onDelete = options.onDelete;
        this.onError = options.onError;
        this.namingFunction = options.filename;
        this.maxUploadSize = typeof options.maxUploadSize === "string" ? parseBytes(options.maxUploadSize) : options.maxUploadSize;
        this.maxMetadataSize = typeof options.maxMetadataSize === "string" ? parseBytes(options.maxMetadataSize) : options.maxMetadataSize;
        this.expiration = options.expiration;

        // Initialize generic configuration
        this.genericConfig = options;

        if (options.assetFolder !== undefined) {
            this.assetFolder = normalize(options.assetFolder);
        }

        this.locker = new Locker({
            max: 1000,
            ttl: 30_000,
            ttlAutopurge: true,
        });

        this.cache = (options.cache ?? new NoOpCache()) as Cache<string, TFile>;

        this.logger = options.logger;
        this.metrics = options.metrics ?? new NoOpMetrics();
        this.logger?.debug(`${this.constructor.name} config: ${inspect({ ...config, logger: this.logger.constructor })}`);

        const purgeInterval = toMilliseconds(options.expiration?.purgeInterval);

        if (purgeInterval) {
            this.startAutoPurge(purgeInterval);
        }

        const size: Required<ValidatorConfig<TFile>> = {
            isValid(file) {
                // Allow undefined size for creation-defer-length extension
                if (file.size === undefined) {
                    return true;
                }

                return Number(file.size) <= this.value;
            },
            response: ErrorMap.RequestEntityTooLarge as HttpError,
            value: this.maxUploadSize,
        };

        const mime: Required<ValidatorConfig<TFile>> = {
            isValid(file) {
                return !!typeis.is(file.contentType, this.value as string[]);
            },
            // @TODO: add better error handling for mime types
            response: ErrorMap.UnsupportedMediaType,
            value: options.allowMIME,
        };

        // Use provided fileNameValidation or default to cloud storage validation
        const fileNameValidation = options.fileNameValidation ?? defaultCloudStorageFileNameValidation;

        const filename: ValidatorConfig<TFile> = {
            isValid(file) {
                return fileNameValidation(file.name);
            },
            response: ErrorMap.InvalidFileName,
        };

        this.validation.add({ filename, mime, size });
        this.validation.add({ ...options.validation });
    }

    public get tusExtension(): string[] {
        const extensions = ["creation", "creation-with-upload", "termination", "checksum", "creation-defer-length", "concatenation"];

        if (this.expiration) {
            extensions.push("expiration");
        }

        return extensions;
    }

    /**
     * Validates a file against configured validation rules.
     * @param file File object to validate.
     * @returns Promise resolving to undefined if file is valid, throws ValidationError otherwise.
     * @throws {ValidationError} If validation fails
     */
    public async validate(file: TFile): Promise<void> {
        await this.validation.verify(file);
    }

    /**
     * Checks if a file exists by querying its metadata.
     * @param query File query containing the file ID to check.
     * @param query.id File ID to check.
     * @returns Promise resolving to true if file exists, false otherwise.
     * @remarks This method does not throw errors - it returns false if the file is not found.
     */
    public async exists(query: FileQuery): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            try {
                await this.getMeta(query.id);

                return true;
            } catch {
                return false;
            }
        });
    }

    /**
     * Normalizes errors with storage-specific context.
     * @param error The error to normalize.
     * @returns Normalized HTTP error with storage class context added to the message.
     * @remarks Errors are enhanced with the storage class name for better debugging.
     */
    public normalizeError(error: Error): HttpError {
        // Create base error structure
        const baseError: HttpError = {
            code: error.name,
            message: error.message,
            name: error.name,
            statusCode: 500,
        };

        // Add storage class context to errors
        return {
            ...baseError,
            message: `[${this.constructor.name}] ${baseError.message}`,
        };
    }

    /**
     * Gets the storage configuration.
     * @returns The current storage configuration options.
     */
    public get config(): BaseStorageOptions<TFile> {
        return this.genericConfig;
    }

    /**
     * Saves upload metadata to the metadata storage.
     * @param file File object containing metadata to save.
     * @returns Promise resolving to the saved file object.
     * @remarks Updates timestamps and caches the file metadata.
     */
    public async saveMeta(file: TFile): Promise<TFile> {
        this.updateTimestamps(file);

        this.cache.set(file.id, file);

        return this.meta.save(file.id, file);
    }

    /**
     * Deletes upload metadata from the metadata storage.
     * @param id File ID whose metadata should be deleted.
     * @returns Promise resolving when metadata is deleted.
     * @remarks Also removes the file from the cache.
     */
    public async deleteMeta(id: string): Promise<void> {
        this.cache.delete(id);

        return this.meta.delete(id);
    }

    /**
     * Retrieves upload metadata by file ID.
     * @param id File ID to retrieve metadata for.
     * @returns Promise resolving to the file metadata object.
     * @throws {UploadError} If the file metadata cannot be found (ERRORS.FILE_NOT_FOUND).
     * @remarks Caches the retrieved metadata for faster subsequent access.
     */
    public async getMeta(id: string): Promise<TFile> {
        try {
            const file = await this.meta.get(id);

            this.cache.set(file.id, file);

            return { ...file };
        } catch {
            return throwErrorCode(ERRORS.FILE_NOT_FOUND);
        }
    }

    /**
     * Checks if a file has expired and deletes it if so.
     * @param file File object to check for expiration.
     * @returns Promise resolving to the file object if not expired.
     * @throws {UploadError} If the file has expired (ERRORS.GONE).
     * @remarks If the file is expired, it is automatically deleted and the metadata is removed.
     */
    public async checkIfExpired(file: TFile): Promise<TFile> {
        if (isExpired(file)) {
            // eslint-disable-next-line no-void
            void this.delete(file).catch(() => undefined);
            // eslint-disable-next-line no-void
            void this.deleteMeta(file.id).catch(() => undefined);

            return throwErrorCode(ERRORS.GONE);
        }

        return file;
    }

    /**
     * Searches for and purges expired uploads.
     * @param maxAge Maximum age of files to keep (files older than this will be purged).
     * Can be a number (milliseconds) or string (e.g., "1h", "30m", "7d").
     * If not provided, uses the expiration.maxAge from configuration.
     * @returns Promise resolving to a list of purged files.
     * @remarks
     * Errors during individual file deletions are logged but do not stop the purge process.
     * Files with corrupted metadata are skipped with a warning.
     * Uses rolling expiration if configured (based on modifiedAt) or fixed expiration (based on createdAt).
     */
    public async purge(maxAge?: number | string): Promise<PurgeList> {
        return this.instrumentOperation("purge", async () => {
            const maxAgeMs = toMilliseconds(maxAge || this.expiration?.maxAge);
            const purged = { items: [], maxAgeMs } as PurgeList;

            if (maxAgeMs) {
                const before = Date.now() - maxAgeMs;
                const list = await this.list();
                const expired = list.filter(
                    (item) => Number(new Date((this.expiration?.rolling ? item.modifiedAt || item.createdAt : item.createdAt) as number | string)) < before,
                );

                for await (const { id, ...rest } of expired) {
                    try {
                        const deleted = await this.delete({ id });

                        purged.items.push({ ...deleted, ...rest });
                    } catch (error: unknown) {
                        // If delete fails (e.g., corrupted metadata, file already deleted),
                        // log the error but continue purging other files
                        this.logger?.warn(`Failed to delete file ${id} during purge: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }

                if (purged.items.length > 0) {
                    this.logger?.info(`Purge: removed ${purged.items.length} uploads`);
                    // Record purge count as a gauge
                    this.metrics.gauge("storage.operations.purge.items_count", purged.items.length, {
                        storage: this.constructor.name.toLowerCase().replace("storage", ""),
                    });
                }
            }

            return purged;
        });
    }

    /**
     * Gets an uploaded file by ID.
     * @param query File query containing the file ID to retrieve.
     * @param query.id File ID to retrieve.
     * @returns Promise resolving to the file data including content.
     * @throws {UploadError} If the file cannot be found (ERRORS.FILE_NOT_FOUND) or has expired (ERRORS.GONE).
     * @remarks This method loads the entire file content into memory. For large files, use getStream() instead.
     */
    public abstract get({ id }: FileQuery): Promise<TFileReturn>;

    /**
     * Gets an uploaded file as a readable stream for efficient large file handling.
     * @param query File query containing the file ID to stream.
     * @param query.id File ID to stream.
     * @returns Promise resolving to an object containing the stream, headers, and size.
     * @throws {UploadError} If the file cannot be found (ERRORS.FILE_NOT_FOUND) or has expired (ERRORS.GONE).
     * @remarks
     * Default implementation falls back to get() and creates a stream from the buffer.
     * Storage implementations should override this for better streaming performance.
     * Headers include Content-Type, Content-Length, ETag, and Last-Modified.
     */
    public async getStream({ id }: FileQuery): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        return this.instrumentOperation("getStream", async () => {
            // Default implementation falls back to get() and creates a stream from the buffer
            // Storage implementations can override this for better streaming performance
            const file = await this.get({ id });
            const stream = Readable.from(file.content);

            return {
                headers: {
                    "Content-Length": String(file.size),
                    "Content-Type": file.contentType,
                    ...file.ETag && { ETag: file.ETag },
                    ...file.modifiedAt && { "Last-Modified": file.modifiedAt.toString() },
                },
                size: typeof file.size === "number" ? file.size : undefined,
                stream,
            };
        });
    }

    /**
     * Retrieves a list of uploaded files.
     * @param _limit Maximum number of files to return (default: 1000).
     * @returns Promise resolving to an array of file metadata objects.
     * @throws {Error} If not implemented by the storage backend.
     * @remarks Storage implementations must override this method.
     */
    public async list(_limit = 1000): Promise<TFile[]> {
        return this.instrumentOperation("list", async () => {
            throw new Error("Not implemented");
        });
    }

    /**
     * Updates file metadata with user-provided key-value pairs.
     * @param query File query containing the file ID to update.
     * @param query.id File ID to update.
     * @param metadata Partial file object containing fields to update.
     * @returns Promise resolving to the updated file object.
     * @throws {UploadError} If the file cannot be found (ERRORS.FILE_NOT_FOUND).
     * @remarks
     * Supports TTL (time-to-live) option: if metadata contains a 'ttl' field,
     * it will be converted to an 'expiredAt' timestamp.
     * TTL can be a number (milliseconds) or string (e.g., "1h", "30m", "7d").
     */
    public async update({ id }: FileQuery, metadata: Partial<File>): Promise<TFile> {
        return this.instrumentOperation("update", async () => {
            const file = await this.getMeta(id);

            // Handle TTL option in metadata
            const processedMetadata = { ...metadata };

            if ("ttl" in processedMetadata && processedMetadata.ttl !== undefined) {
                const ttlValue = processedMetadata.ttl;
                const ttlMs = typeof ttlValue === "string" ? toMilliseconds(ttlValue) : ttlValue;

                if (ttlMs !== undefined) {
                    processedMetadata.expiredAt = Date.now() + (ttlMs as number);
                }

                delete (processedMetadata as Record<string, unknown>).ttl;
            }

            updateMetadata(file as File, processedMetadata);

            await this.saveMeta(file);

            const updatedFile = { ...file, status: "updated" } as TFile;

            await this.onUpdate(updatedFile);

            return updatedFile;
        });
    }

    /**
     * Creates a new upload and saves its metadata.
     * @param file File initialization configuration.
     * @returns Promise resolving to the created file object.
     */
    public abstract create(file: FileInit): Promise<TFile>;

    /**
     * Writes part and/or returns status of an upload.
     * @param part File part, query, or full file object to write.
     * @returns Promise resolving to the updated file object.
     */
    public abstract write(part: FilePart | FileQuery | TFile): Promise<TFile>;

    /**
     * Deletes an upload and its metadata.
     * @param query File query containing the file ID to delete.
     * @param query.id File ID to delete.
     * @returns Promise resolving to the deleted file object with status: "deleted".
     * @throws {UploadError} If the file metadata cannot be found.
     */
    public abstract delete(query: FileQuery): Promise<TFile>;

    /**
     * Copies an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @param options Optional copy options including storage class.
     * @returns Promise resolving to the copied file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public abstract copy(name: string, destination: string, options?: { storageClass?: string }): Promise<TFile>;

    /**
     * Moves an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the moved file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public abstract move(name: string, destination: string): Promise<TFile>;

    /**
     * Deletes multiple files in a single batch operation.
     * @param ids Array of file IDs to delete.
     * @returns Promise resolving to batch operation response with successful and failed deletions.
     * @remarks
     * Processes all deletions in parallel using Promise.allSettled.
     * Individual failures do not stop the batch operation.
     * Each deletion is wrapped in error handling to capture failures.
     * Metrics are recorded for the batch operation and individual failures.
     * Returns both successful and failed operations with detailed error information.
     */
    public async deleteBatch(ids: string[]): Promise<BatchOperationResponse<TFile>> {
        const startTime = Date.now();
        const storageType = this.constructor.name.toLowerCase().replace("storage", "");

        this.metrics.increment("storage.operations.batch.delete.count", 1, {
            batch_size: ids.length,
            storage: storageType,
        });

        const successful: TFile[] = [];
        const failed: { error: string; id: string }[] = [];

        // Process all deletions in parallel using Promise.allSettled
        const deletePromises = ids.map(async (id) => {
            try {
                const file = await this.delete({ id });

                return { file, id, success: true as const };
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : "Delete failed";

                this.metrics.increment("storage.operations.delete.error.count", 1, {
                    error: errorMessage,
                    storage: storageType,
                });

                return { error: errorMessage, id, success: false as const };
            }
        });

        const results = await Promise.allSettled(deletePromises);

        for (const result of results) {
            if (result.status === "fulfilled") {
                if (result.value.success) {
                    successful.push(result.value.file);
                } else {
                    failed.push({ error: result.value.error, id: result.value.id });
                }
            } else {
                // Promise rejected - shouldn't happen but handle it
                failed.push({ error: result.reason?.message || "Delete failed", id: "" });
            }
        }

        const duration = Date.now() - startTime;

        this.metrics.timing("storage.operations.batch.delete.duration", duration, {
            batch_size: ids.length,
            storage: storageType,
        });

        this.metrics.gauge("storage.operations.batch.delete.success_count", successful.length, {
            storage: storageType,
        });

        this.metrics.gauge("storage.operations.batch.delete.failed_count", failed.length, {
            storage: storageType,
        });

        return {
            failed,
            failedCount: failed.length,
            successful,
            successfulCount: successful.length,
        };
    }

    /**
     * Copies multiple files in a single batch operation.
     * @param operations Array of copy operations, each containing:
     * source: Source file ID.
     * destination: Destination file ID or path.
     * options: Optional copy options including storage class.
     * @returns Promise resolving to batch operation response with successful and failed copies.
     * @remarks
     * Processes all copies in parallel using Promise.allSettled.
     * Individual failures do not stop the batch operation.
     * Each copy operation is wrapped in error handling to capture failures.
     * Metrics are recorded for the batch operation and individual failures.
     * Returns both successful and failed operations with detailed error information.
     */
    public async copyBatch(operations: { destination: string; options?: { storageClass?: string }; source: string }[]): Promise<BatchOperationResponse<TFile>> {
        const startTime = Date.now();
        const storageType = this.constructor.name.toLowerCase().replace("storage", "");

        this.metrics.increment("storage.operations.batch.copy.count", 1, {
            batch_size: operations.length,
            storage: storageType,
        });

        const successful: TFile[] = [];
        const failed: { error: string; id: string }[] = [];

        // Process all copies in parallel using Promise.allSettled
        const copyPromises = operations.map(async ({ destination, options, source }) => {
            try {
                const copiedFile = await this.copy(source, destination, options);

                return { file: copiedFile, id: destination, success: true as const };
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : "Copy failed";

                this.metrics.increment("storage.operations.copy.error.count", 1, {
                    error: errorMessage,
                    storage: storageType,
                });

                return { error: errorMessage, id: destination, success: false as const };
            }
        });

        const results = await Promise.allSettled(copyPromises);

        for (const result of results) {
            if (result.status === "fulfilled") {
                if (result.value.success && result.value.file) {
                    successful.push(result.value.file);
                } else {
                    failed.push({ error: result.value.error || "Copy failed", id: result.value.id });
                }
            } else {
                // Promise rejected - shouldn't happen but handle it
                failed.push({ error: result.reason?.message || "Copy failed", id: "" });
            }
        }

        const duration = Date.now() - startTime;

        this.metrics.timing("storage.operations.batch.copy.duration", duration, {
            batch_size: operations.length,
            storage: storageType,
        });

        this.metrics.gauge("storage.operations.batch.copy.success_count", successful.length, {
            storage: storageType,
        });

        this.metrics.gauge("storage.operations.batch.copy.failed_count", failed.length, {
            storage: storageType,
        });

        return {
            failed,
            failedCount: failed.length,
            successful,
            successfulCount: successful.length,
        };
    }

    /**
     * Moves multiple files in a single batch operation.
     * @param operations Array of move operations, each containing:
     * source: Source file ID.
     * destination: Destination file ID or path.
     * @returns Promise resolving to batch operation response with successful and failed moves.
     * @remarks
     * Processes all moves in parallel using Promise.allSettled.
     * Individual failures do not stop the batch operation.
     * Each move operation is wrapped in error handling to capture failures.
     * Metrics are recorded for the batch operation and individual failures.
     * Returns both successful and failed operations with detailed error information.
     */
    public async moveBatch(operations: { destination: string; source: string }[]): Promise<BatchOperationResponse<TFile>> {
        const startTime = Date.now();
        const storageType = this.constructor.name.toLowerCase().replace("storage", "");

        this.metrics.increment("storage.operations.batch.move.count", 1, {
            batch_size: operations.length,
            storage: storageType,
        });

        const successful: TFile[] = [];
        const failed: { error: string; id: string }[] = [];

        // Process all moves in parallel using Promise.allSettled
        const movePromises = operations.map(async ({ destination, source }) => {
            try {
                // Move the file - move() returns the moved file
                const movedFile = await this.move(source, destination);

                return { file: movedFile, id: destination, success: true as const };
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : "Move failed";

                this.metrics.increment("storage.operations.move.error.count", 1, {
                    error: errorMessage,
                    storage: storageType,
                });

                return { error: errorMessage, id: destination, success: false as const };
            }
        });

        const results = await Promise.allSettled(movePromises);

        for (const result of results) {
            if (result.status === "fulfilled") {
                if (result.value.success && result.value.file) {
                    successful.push(result.value.file);
                } else {
                    failed.push({ error: result.value.error || "Move failed", id: result.value.id });
                }
            } else {
                // Promise rejected - shouldn't happen but handle it
                failed.push({ error: result.reason?.message || "Move failed", id: result.reason?.id || "" });
            }
        }

        const duration = Date.now() - startTime;

        this.metrics.timing("storage.operations.batch.move.duration", duration, {
            batch_size: operations.length,
            storage: storageType,
        });

        this.metrics.gauge("storage.operations.batch.move.success_count", successful.length, {
            storage: storageType,
        });

        this.metrics.gauge("storage.operations.batch.move.failed_count", failed.length, {
            storage: storageType,
        });

        return {
            failed,
            failedCount: failed.length,
            successful,
            successfulCount: successful.length,
        };
    }

    /**
     * Prevent upload from being accessed by multiple requests
     */

    protected async lock(key: string): Promise<string> {
        const activeUploads = [...this.locker.keys()];

        if (activeUploads.includes(key)) {
            return throwErrorCode(ERRORS.FILE_LOCKED);
        }

        if (this.config.concurrency && typeof this.config.concurrency === "number" && this.config.concurrency < activeUploads.length) {
            return throwErrorCode(ERRORS.STORAGE_BUSY);
        }

        this.locker.set(key, key);

        return key;
    }

    protected async unlock(key: string): Promise<void> {
        this.locker.unlock(key);
    }

    protected isUnsupportedChecksum(algorithm = ""): boolean {
        return !!algorithm && !this.checksumTypes.includes(algorithm);
    }

    protected startAutoPurge(purgeInterval: number): void {
        if (purgeInterval >= 2_147_483_647) {
            throw new Error("“purgeInterval” must be less than 2147483647 ms");
        }

        // eslint-disable-next-line no-void
        setInterval(() => void this.purge().catch((error) => this.logger?.error(error)), purgeInterval);
    }

    protected updateTimestamps(file: TFile): TFile {
        // eslint-disable-next-line no-param-reassign
        file.createdAt ??= new Date().toISOString();

        const maxAgeMs = toMilliseconds(this.expiration?.maxAge);

        if (maxAgeMs && !file.expiredAt) {
            // eslint-disable-next-line no-param-reassign
            file.expiredAt = this.expiration?.rolling ? Date.now() + maxAgeMs : +new Date(file.createdAt) + maxAgeMs;
        }

        return file;
    }

    /**
     * Instruments a storage operation with metrics and error tracking.
     * @param operation Operation name (e.g., "create", "delete", "copy").
     * @param function_ The operation function to execute.
     * @param attributes Additional attributes to include in metrics.
     * @returns Promise resolving to the operation result.
     * @throws Re-throws any errors from the operation function.
     * @remarks
     * Records operation count, duration, and error metrics.
     * Tracks file sizes for operations returning file objects.
     * Error metrics include error messages for debugging.
     * All public methods should use this wrapper for consistent instrumentation.
     */
    protected async instrumentOperation<T>(operation: string, function_: () => Promise<T>, attributes?: Record<string, string | number>): Promise<T> {
        const startTime = Date.now();
        const storageType = this.constructor.name.toLowerCase().replace("storage", "");

        const baseAttributes = {
            storage: storageType,
            ...attributes,
        };

        try {
            this.metrics.increment(`storage.operations.${operation}.count`, 1, baseAttributes);

            const result = await function_();

            const duration = Date.now() - startTime;

            this.metrics.timing(`storage.operations.${operation}.duration`, duration, baseAttributes);

            // If result is a file, record file size
            if (result && typeof result === "object" && "size" in result && typeof result.size === "number") {
                this.metrics.gauge("storage.files.size", result.size, {
                    ...baseAttributes,
                    operation,
                });
            }

            return result;
        } catch (error: unknown) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : "Unknown error";

            this.metrics.timing(`storage.operations.${operation}.duration`, duration, {
                ...baseAttributes,
                error: "true",
            });

            this.metrics.increment(`storage.operations.${operation}.error.count`, 1, {
                ...baseAttributes,
                error: errorMessage,
            });

            throw error;
        }
    }
}
