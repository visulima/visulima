import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { setInterval } from "node:timers";
import { inspect } from "node:util";

import { parseBytes } from "@visulima/humanizer";
import { normalize } from "@visulima/path";
import typeis from "type-is";

import type { Cache } from "../utils/cache";
import { NoOpCache } from "../utils/cache";
import type { ErrorResponses } from "../utils/errors";
import { ErrorMap, ERRORS, throwErrorCode } from "../utils/errors";
import { normalizeHookResponse, normalizeOnErrorResponse } from "../utils/http";
import Locker from "../utils/locker";
import toMilliseconds from "../utils/primitives/to-milliseconds";
import type { HttpError, Logger, UploadResponse, ValidatorConfig } from "../utils/types";
import { Validator } from "../utils/validator";
import type MetaStorage from "./meta-storage";
import type { BaseStorageOptions, PurgeList, StorageOptimizations } from "./types";
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

    public readonly genericConfig: BaseStorageOptions<TFile>;

    public maxMetadataSize: number;

    public checksumTypes: string[] = [];

    public maxUploadSize: number;

    protected expiration?: { maxAge?: string | number; purgeInterval?: string | number; rolling?: boolean };

    protected readonly optimizations: StorageOptimizations;

    protected locker: Locker;

    protected namingFunction: (file: TFile, request: any) => string;

    protected validation = new Validator<TFile>();

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
        this.optimizations = {
            bulkBatchSize: 100,
            enableCDNHeaders: false,
            enableCompression: false,
            usePrefixes: false,
            useServerSideCopy: true,
            ...this.optimizations,
        };

        if (options.assetFolder !== undefined) {
            this.assetFolder = normalize(options.assetFolder);
        }

        this.locker = new Locker({
            max: 1000,
            ttl: 30_000,
            ttlAutopurge: true,
        });

        this.cache = options.cache ?? new NoOpCache();

        this.logger = options.logger;
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

    public async validate(file: TFile): Promise<any> {
        return this.validation.verify(file);
    }

    /**
     * Check if file exists
     */
    public async exists(query: FileQuery): Promise<boolean> {
        try {
            await this.getMeta(query.id);

            return true;
        } catch {
            return false;
        }
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

        this.cache.set(file.id, file, {
            size: Object.keys(file).length,
        });

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

            this.cache.set(file.id, file, {
                size: Object.keys(file).length,
            });

            return { ...file };
        } catch {
            return throwErrorCode(ERRORS.FILE_NOT_FOUND);
        }
    }

    public async checkIfExpired(file: TFile): Promise<TFile> {
        if (isExpired(file)) {
            // eslint-disable-next-line no-void
            void this.delete(file).catch(() => null);
            // eslint-disable-next-line no-void
            void this.deleteMeta(file.id).catch(() => null);

            return throwErrorCode(ERRORS.GONE);
        }

        return file;
    }

    /**
     * Searches for and purges expired upload
     * @param maxAge remove upload older than a specified age
     */
    public async purge(maxAge?: number | string): Promise<PurgeList> {
        const maxAgeMs = toMilliseconds(maxAge || this.expiration?.maxAge);
        const purged = { items: [], maxAgeMs } as PurgeList;

        if (maxAgeMs) {
            const before = Date.now() - maxAgeMs;
            const list = await this.list();
            const expired = list.filter(
                (item) => Number(new Date((this.expiration?.rolling ? item.modifiedAt || item.createdAt : item.createdAt) as number | string)) < before,
            );

            for await (const { id, ...rest } of expired) {
                const deleted = await this.delete({ id });

                purged.items.push({ ...deleted, ...rest });
            }

            if (purged.items.length > 0) {
                this.logger?.info(`Purge: removed ${purged.items.length} uploads`);
            }
        }

        return purged;
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
            size: file.size,
            stream,
        };
    }

    /**
     * Retrieves a list of upload.
     */
    // eslint-disable-next-line class-methods-use-this
    public async list(_limit = 1000): Promise<TFile[]> {
        throw new Error("Not implemented");
    }

    /**
     * Set user-provided metadata as key-value pairs
     * @experimental
     */
    public async update({ id }: FileQuery, metadata: Partial<File>): Promise<TFile> {
        const file = await this.getMeta(id);

        // Handle TTL option in metadata
        const processedMetadata = { ...metadata };

        if ("ttl" in processedMetadata && processedMetadata.ttl !== undefined) {
            const ttlValue = processedMetadata.ttl;
            const ttlMs = typeof ttlValue === "string" ? toMilliseconds(ttlValue) : ttlValue;

            if (ttlMs !== null) {
                processedMetadata.expiredAt = Date.now() + (ttlMs as number);
            }

            delete (processedMetadata as any).ttl;
        }

        updateMetadata(file as File, processedMetadata);

        await this.saveMeta(file);

        return { ...file, status: "updated" };
    }

    /**
     * Apply storage optimizations to file operations
     */
    protected applyOptimizations(operation: string, ...arguments_: any[]): any[] {
        switch (operation) {
            case "copy": {
                return this.optimizeCopy(arguments_[0], arguments_[1]);
            }
            case "create": {
                return this.optimizeCreate(arguments_[0], arguments_[1]);
            }
            case "get": {
                return this.optimizeGet(arguments_[0]);
            }
            default: {
                return arguments_;
            }
        }
    }

    /**
     * Optimize file creation with storage-specific settings
     */
    protected optimizeCreate(request: IncomingMessage, config: FileInit): [IncomingMessage, FileInit] {
        const { optimizations } = this;

        // Add optimization metadata
        if (optimizations.metadataTags) {
            config.metadata = {
                ...config.metadata,
                ...optimizations.metadataTags,
            };
        }

        // Apply prefix if enabled
        if (optimizations.usePrefixes && optimizations.prefixTemplate) {
            // This would be implemented by subclasses
        }

        return [request, config];
    }

    /**
     * Optimize copy operations
     */
    protected optimizeCopy(source: string, destination: string): [string, string] {
        const { optimizations } = this;

        // Apply prefix to destination if enabled
        if (optimizations.usePrefixes && optimizations.prefixTemplate) {
            const prefix = this.resolvePrefix(source);

            return [source, `${prefix}${destination}`];
        }

        return [source, destination];
    }

    /**
     * Optimize get operations
     */
    protected optimizeGet(query: FileQuery): [FileQuery] {
        const { optimizations } = this;

        // Apply prefix if enabled
        if (optimizations.usePrefixes && optimizations.prefixTemplate) {
            return [{ ...query, id: this.applyPrefix(query.id) }];
        }

        return [query];
    }

    /**
     * Resolve prefix for a file based on optimizations
     */
    protected resolvePrefix(fileId: string): string {
        const { prefixTemplate } = this.optimizations;

        if (!prefixTemplate) {
            return "";
        }

        // Simple template resolution - subclasses can override for complex logic
        return prefixTemplate.replace("{fileId}", fileId);
    }

    /**
     * Apply prefix to file ID
     */
    protected applyPrefix(fileId: string): string {
        const prefix = this.resolvePrefix(fileId);

        return prefix ? `${prefix}${fileId}` : fileId;
    }

    /**
     * Remove prefix from file ID
     */
    protected removePrefix(prefixedId: string): string {
        const { prefixTemplate } = this.optimizations;

        if (!prefixTemplate) {
            return prefixedId;
        }

        // Simple prefix removal - subclasses can override
        const prefix = this.resolvePrefix("");

        return prefixedId.startsWith(prefix) ? prefixedId.slice(prefix.length) : prefixedId;
    }

    /**
     * Prevent upload from being accessed by multiple requests
     */

    protected async lock(key: string): Promise<string> {
        const activeUploads = [...this.locker.keys()];

        if (activeUploads.includes(key)) {
            return throwErrorCode(ERRORS.FILE_LOCKED);
        }

        if (this.config.concurrency && this.config.concurrency < activeUploads.length) {
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
     *  Creates a new upload and saves its metadata
     */
    public abstract create(request: IncomingMessage, file: FileInit): Promise<TFile>;

    /**
     *  Write part and/or return status of an upload
     */
    public abstract write(part: FilePart | FileQuery | TFile): Promise<TFile>;

    /**
     * Deletes an upload and its metadata
     */
    public abstract delete(query: FileQuery): Promise<TFile>;

    /**
     * Copy an upload file to a new location.
     * @param {string} name
     * @param {string} destination
     */
    public abstract copy(name: string, destination: string, options?: { storageClass?: string }): Promise<any>;

    /**
     * Move an upload file to a new location.
     * @param {string} name
     * @param {string} destination
     */
    public abstract move(name: string, destination: string): Promise<any>;
}

export default BaseStorage;
