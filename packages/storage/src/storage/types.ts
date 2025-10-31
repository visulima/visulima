import type { IncomingMessage } from "node:http";
import type { Readable } from "node:stream";

import type { Cache } from "../utils/cache";
import type { HttpError, HttpErrorBody, Logger, Validation } from "../utils/types";
import type { LocalMetaStorageOptions } from "./local/local-meta-storage";
import type MetaStorage from "./meta-storage";
import type { File, FileInit, FilePart, FileQuery, FileReturn, UploadFile } from "./utils/file";

export interface MetaStorageOptions {
    logger?: Logger;
    prefix?: string;
    suffix?: string;
}

export type OnCreate<TFile extends File = File, TBody = any> = (file: TFile) => Promise<TBody> | TBody;

export type OnUpdate<TFile extends File = File, TBody = any> = (file: TFile) => Promise<TBody> | TBody;

export type OnComplete<TFile extends File = File, TBody = any> = (file: TFile) => Promise<TBody> | TBody;

export type OnDelete<TFile extends File = File, TBody = any> = (file: TFile) => Promise<TBody> | TBody;

export type OnError<TBody = HttpErrorBody> = (error: HttpError<TBody>) => any;

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
    filename?: (file: T, request: any) => string;
    /** Logger injection */
    logger?: Logger;
    /** Limiting the size of custom metadata */
    maxMetadataSize?: number | string;
    /** File size limit */
    maxUploadSize?: number | string;
    /** Provide custom meta storage  */
    metaStorage?: MetaStorage<T>;

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
 * Storage optimization configuration
 */
export interface StorageOptimizations {
    /** Bulk operation batch size */
    bulkBatchSize?: number;
    /** Storage class for cached/transformed files */
    cacheStorageClass?: string;
    /** TTL for cached/transformed files */
    cacheTTL?: number;
    /** CDN-friendly headers for cached files */
    enableCDNHeaders?: boolean;
    /** Enable compression for cached files */
    enableCompression?: boolean;
    /** Custom metadata for optimized operations */
    metadataTags?: Record<string, string>;
    /** Custom prefix template (e.g., "transforms/{fileId}/") */
    prefixTemplate?: string;
    /** Enable prefix-based file organization */
    usePrefixes?: boolean;
    /** Enable server-side copy when available */
    useServerSideCopy?: boolean;
}

/**
 * Unified storage configuration
 */
export interface GenericStorageConfig {
    /** Allow additional properties for specific storage backends */
    [key: string]: any;
    /** Base path/prefix for all operations */
    basePath?: string;
    /** Cache TTL */
    cacheTTL?: number;
    /** Supported checksum algorithms */
    checksumTypes?: string[];
    /** Logger instance */
    logger?: Logger;
    /** Maximum file size */
    maxFileSize?: number | string;
    /** Storage-specific optimizations */
    optimizations?: StorageOptimizations;
}

/**
 * Generic storage operations that all backends should support
 */
export interface GenericStorageOperations<T extends File = File, TReturn extends FileReturn = FileReturn> {
    /** Copy a file */
    copy: (source: string, destination: string, options?: { storageClass?: string }) => Promise<any>;

    /** Create a new file upload */
    create: (request: IncomingMessage, config: FileInit) => Promise<T>;

    /** Delete a file */
    delete: (query: FileQuery) => Promise<T>;

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
    move: (source: string, destination: string) => Promise<any>;

    /** Update file metadata */
    update: (query: FileQuery, metadata: Partial<T>) => Promise<T>;

    /** Write data to a file */
    write: (part: FilePart | FileQuery) => Promise<T>;
}
