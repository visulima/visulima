import { Readable } from "node:stream";
import { setInterval } from "node:timers";
import { inspect } from "node:util";

// eslint-disable-next-line import/no-extraneous-dependencies
import { parseBytes } from "@visulima/humanizer";
// eslint-disable-next-line import/no-extraneous-dependencies
import { normalize } from "@visulima/path";
// eslint-disable-next-line import/no-extraneous-dependencies
import typeis from "type-is";

import { NoOpMetrics } from "../metrics";
import type { Cache } from "../utils/cache";
import { NoOpCache } from "../utils/cache";
import type { ErrorResponses } from "../utils/errors";
import { ErrorMap, ERRORS, throwErrorCode } from "../utils/errors";
import { normalizeHookResponse, normalizeOnErrorResponse } from "../utils/http";
import Locker from "../utils/locker";
import toMilliseconds from "../utils/primitives/to-milliseconds";
import type { HttpError, Logger, Metrics, UploadResponse, ValidatorConfig } from "../utils/types";
import { Validator } from "../utils/validator";
import type MetaStorage from "./meta-storage";
import type { BaseStorageOptions, BatchOperationResponse, PurgeList } from "./types";
import type { File, FileInit, FilePart, FileQuery } from "./utils/file";
import { FileName, isExpired, updateMetadata } from "./utils/file";
import type { FileReturn } from "./utils/file/types";

const defaults: BaseStorageOptions = {
    allowMIME: ["*/*"],
    filename: ({ id }: File): string => id,
    maxMetadataSize: "8MB",
    maxUploadSize: "5TB",
    onComplete: (file: File) => file,
    onCreate: () => "",
    onDelete: () => "",
    onError: ({ body, headers, statusCode }: HttpError) => {
        return { body: { error: body }, headers, statusCode };
    },
    onUpdate: (file: File) => file,
    useRelativeLocation: false,
    validation: {},
};

abstract class BaseStorage<TFile extends File = File, TFileReturn extends FileReturn = FileReturn> {
    public onCreate: (file: TFile) => Promise<UploadResponse>;

    public onUpdate: (file: TFile) => Promise<UploadResponse>;

    public onComplete: (file: TFile) => Promise<UploadResponse>;

    public onDelete: (file: TFile) => Promise<UploadResponse>;

    public onError: (error: HttpError) => UploadResponse;

    public isReady = true;

    public errorResponses = {} as ErrorResponses;

    public cache: Cache<string, TFile>;

    public readonly logger?: Logger;

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

        this.onCreate = normalizeHookResponse(options.onCreate);
        this.onUpdate = normalizeHookResponse(options.onUpdate);
        this.onComplete = normalizeHookResponse(options.onComplete);
        this.onDelete = normalizeHookResponse(options.onDelete);
        this.onError = normalizeOnErrorResponse(options.onError);
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

        const filename: ValidatorConfig<TFile> = {
            isValid(file) {
                return FileName.isValid(file.name);
            },
            response: ErrorMap.InvalidFileName,
        };

        this.validation.add({ filename, mime, size });
        this.validation.add({ ...options.validation });
    }

    public get tusExtension(): string[] {
        const extensions = ["creation", "creation-with-upload", "termination", "checksum", "creation-defer-length"];

        if (this.expiration) {
            extensions.push("expiration");
        }

        return extensions;
    }

    public async validate(file: TFile): Promise<boolean> {
        return this.validation.verify(file);
    }

    /**
     * Check if file exists
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
     * Enhanced error normalization with storage context
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
     * Get configuration
     */
    public get config(): BaseStorageOptions<TFile> {
        return this.genericConfig;
    }

    /**
     * Saves upload metadata
     */
    public async saveMeta(file: TFile): Promise<TFile> {
        this.updateTimestamps(file);

        this.cache.set(file.id, file);

        return this.meta.save(file.id, file);
    }

    /**
     * Deletes an upload metadata
     */
    public async deleteMeta(id: string): Promise<void> {
        this.cache.delete(id);

        return this.meta.delete(id);
    }

    /**
     * Retrieves upload metadata
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
     * Searches for and purges expired upload
     * @param maxAge remove upload older than a specified age
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
     * Get uploaded file.
     * @param {FileQuery} id
     */
    public abstract get({ id }: FileQuery): Promise<TFileReturn>;

    /**
     * Get uploaded file as a stream for efficient large file handling.
     * @param query
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
     * Retrieves a list of upload.
     */

    public async list(_limit = 1000): Promise<TFile[]> {
        return this.instrumentOperation("list", async () => {
            throw new Error("Not implemented");
        });
    }

    /**
     * Set user-provided metadata as key-value pairs
     * @experimental
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

            return { ...file, status: "updated" };
        });
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
     * Helper method to instrument an operation with metrics.
     * Subclasses can use this to wrap their operations.
     * @param operation Operation name (e.g., "create", "write", "delete")
     * @param fn Async function to execute
     * @param attributes Optional attributes to add to metrics
     * @returns Result of the operation
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

    /**
     * Creates a new upload and saves its metadata.
     * @param file - File initialization configuration
     * @returns Promise resolving to the created file object
     */
    public abstract create(file: FileInit): Promise<TFile>;

    /**
     * Write part and/or return status of an upload.
     * @param part File part, query, or full file object to write
     * @returns Promise resolving to the updated file object
     */
    public abstract write(part: FilePart | FileQuery | TFile): Promise<TFile>;

    /**
     * Deletes an upload and its metadata.
     * @param query File query containing the file ID to delete
     * @returns Promise resolving to the deleted file object with status: "deleted"
     * @throws {Error} If the file metadata cannot be found
     */
    public abstract delete(query: FileQuery): Promise<TFile>;

    /**
     * Copy an upload file to a new location.
     * @param name Source file name/ID
     * @param destination Destination file name/ID
     * @param options Optional copy options including storage class
     * @returns Promise resolving to the copied file object
     * @throws {Error} If the source file cannot be found
     */
    public abstract copy(name: string, destination: string, options?: { storageClass?: string }): Promise<TFile>;

    /**
     * Move an upload file to a new location.
     * @param name Source file name/ID
     * @param destination Destination file name/ID
     * @returns Promise resolving to the moved file object
     * @throws {Error} If the source file cannot be found
     */
    public abstract move(name: string, destination: string): Promise<TFile>;

    /**
     * Delete multiple files in a single operation.
     * Default implementation processes deletions in parallel.
     * @param ids Array of file IDs to delete
     * @returns Promise resolving to batch operation response with successful and failed deletions
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
     * Copy multiple files in a single operation.
     * Default implementation processes copies in parallel.
     * @param operations Array of copy operations with source, destination, and optional options
     * @returns Promise resolving to batch operation response with successful and failed copies
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
     * Move multiple files in a single operation.
     * Default implementation processes moves in parallel.
     * @param operations Array of move operations with source and destination
     * @returns Promise resolving to batch operation response with successful and failed moves
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
}

export default BaseStorage;
