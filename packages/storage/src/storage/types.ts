import type { Readable } from "node:stream";

import type { Cache } from "../utils/cache";
import type { RetryConfig } from "../utils/retry";
import type { HttpError, HttpErrorBody, Metrics, UploadResponse, Validation } from "../utils/types";
import type { LocalMetaStorageOptions } from "./local/local-meta-storage";
import type MetaStorage from "./meta-storage";
import type { File, FileInit, FilePart, FileQuery, FileReturn, UploadFile } from "./utils/file";

export interface MetaStorageOptions {
    logger?: Console;
    prefix?: string;
    suffix?: string;
}

export type OnCreate<TFile extends File = File> = (file: TFile) => Promise<void> | void;

export type OnUpdate<TFile extends File = File> = (file: TFile) => Promise<void> | void;

export type OnComplete<TFile extends File = File, TResponse = unknown, TRequest = unknown> = (
    file: TFile,
    response: TResponse,
    request?: TRequest,
) => Promise<void> | void;

export type OnDelete<TFile extends File = File> = (file: TFile) => Promise<void> | void;

export type OnError<TBody = HttpErrorBody> = (error: HttpError<TBody>) => Promise<void> | void;

export interface PurgeList {
    items: UploadFile[];
    maxAgeMs: number;
}

export interface ExpirationOptions {
    /**
     * Age of the upload, after which it is considered expired and can be deleted
     */
    maxAge: number | string;

    /**
     * Auto purging interval for expired upload
     */
    purgeInterval?: number | string;

    /**
     * Auto prolong expiring upload
     */
    rolling?: boolean;
}

export interface BaseStorageOptions<T extends File = File> extends GenericStorageConfig {
    /** Allowed MIME types */
    allowMIME?: string[];
    /** The full path of the folder where the uploaded asset will be stored. */
    assetFolder?: string;

    /** Cache instance to use for caching */
    cache?: Cache;

    /**
     * Automatic cleaning of abandoned and completed upload
     * @example
     * ```ts
     * app.use(
     *   '/upload',
     *   Upload.upload({
     *     directory: 'upload',
     *     expiration: { maxAge: '6h', purgeInterval: '30min' },
     *     onComplete
     *   })
     * );
     * ```
     */
    expiration?: ExpirationOptions;
    /** File naming function */
    filename?: (file: T) => string;

    /**
     * File name validation function.
     * Returns true if the filename is valid, false otherwise.
     * @default Cloud storage platforms: permissive (only blocks path traversal and null bytes)
     * @default DiskStorage: strict (blocks filesystem-incompatible characters)
     * @example
     * ```ts
     * fileNameValidation: (name: string) => {
     *   // Custom validation logic
     *   return name.length > 0 && !name.includes('../');
     * }
     * ```
     */
    fileNameValidation?: (name: string) => boolean;
    /** Logger injection */
    logger?: Console;
    /** Limiting the size of custom metadata */
    maxMetadataSize?: number | string;
    /** File size limit */
    maxUploadSize?: number | string;
    /** Provide custom meta storage  */
    metaStorage?: MetaStorage<T>;
    /** Metrics injection for observability */
    metrics?: Metrics;

    /** Callback function that is called when an upload is completed */
    onComplete?: OnComplete<T>;
    /** Callback function that is called when a new upload is created */
    onCreate?: OnCreate<T>;
    /** Callback function that is called when an upload is cancelled */
    onDelete?: OnDelete<T>;
    /** Customize error response */
    onError?: OnError;
    /** Callback function that is called when an upload is updated */
    onUpdate?: OnUpdate<T>;

    /** Force relative URI in Location header */
    useRelativeLocation?: boolean;

    /** Upload validation options */
    validation?: Validation<T>;
}

export type DiskStorageOptions<T extends File> = BaseStorageOptions<T> & {
    /**
     * Uploads directory.
     */
    directory: string;

    /**
     * Configuring metafile storage on the local disk
     * @example
     * ```ts
     * const storage = new DiskStorage({
     *   directory: 'upload',
     *   metaStorageConfig: { directory: '/tmp/upload-metafiles', prefix: '.' }
     * });
     * ```
     */
    metaStorageConfig?: LocalMetaStorageOptions;
};

export type DiskStorageWithChecksumOptions<T extends File> = DiskStorageOptions<T> & {
    /**
     * Enable/disable file/range checksum calculation
     */
    checksum?: boolean | "md5" | "sha1";
};

/**
 * Unified storage configuration
 */
export interface GenericStorageConfig {
    /** Allow additional properties for specific storage backends */
    [key: string]: unknown;
    /** Base path/prefix for all operations */
    basePath?: string;
    /** Cache TTL */
    cacheTTL?: number;
    /** Supported checksum algorithms */
    checksumTypes?: string[];
    /** Logger instance */
    logger?: Console;
    /** Maximum file size */
    maxFileSize?: number | string;
    /** Metrics instance for observability */
    metrics?: Metrics;
    /** Retry configuration for transient failures */
    retryConfig?: RetryConfig;
}

/**
 * Batch operation result for a single file
 */
export interface BatchOperationResult<T extends File = File> {
    /** Error message if operation failed */
    error?: string;
    /** File that was successfully operated on */
    file?: T;
    /** File ID */
    id: string;
    /** Whether the operation was successful */
    success: boolean;
}

/**
 * Response from batch operations (deleteBatch, copyBatch, moveBatch)
 */
export interface BatchOperationResponse<T extends File = File> {
    /** Failed operations with error details */
    failed: { error: string; id: string }[];
    /** Total number of failed operations */
    failedCount: number;
    /** Successfully processed files */
    successful: T[];
    /** Total number of successful operations */
    successfulCount: number;
}

/**
 * Generic storage operations that all backends should support
 */
export interface GenericStorageOperations<T extends File = File, TReturn extends FileReturn = FileReturn> {
    /** Copy a file */
    copy: (source: string, destination: string, options?: { storageClass?: string }) => Promise<T>;

    /** Copy multiple files */
    copyBatch?: (operations: { destination: string; options?: { storageClass?: string }; source: string }[]) => Promise<BatchOperationResponse<T>>;

    /** Create a new file upload */
    create: (config: FileInit) => Promise<T>;

    /** Delete a file */
    delete: (query: FileQuery) => Promise<T>;

    /** Delete multiple files */
    deleteBatch?: (ids: string[]) => Promise<BatchOperationResponse<T>>;

    /** Check if file exists */
    exists: (query: FileQuery) => Promise<boolean>;

    /** Get file data */
    get: (query: FileQuery) => Promise<TReturn>;

    /** Get file as a readable stream */
    getStream?: (query: FileQuery) => Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }>;

    /** Get signed URL for upload (if supported) */
    getUploadUrl?: (query: FileQuery, expiresIn?: number) => Promise<string>;

    /** Get file URL (if supported) */
    getUrl?: (query: FileQuery, expiresIn?: number) => Promise<string>;

    /** List files */
    list: (limit?: number) => Promise<T[]>;

    /** Move a file */
    move: (source: string, destination: string) => Promise<T>;

    /** Move multiple files */
    moveBatch?: (operations: { destination: string; source: string }[]) => Promise<BatchOperationResponse<T>>;

    /** Update file metadata */
    update: (query: FileQuery, metadata: Partial<T>) => Promise<T>;

    /** Write data to a file */
    write: (part: FilePart | FileQuery) => Promise<T>;
}
