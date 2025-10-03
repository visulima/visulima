import type { HttpError, HttpErrorBody, Logger, Validation } from "../utils";
import type { LocalMetaStorageOptions } from "./local/local-meta-storage";
import type MetaStorage from "./meta-storage";
import type { File, UploadFile } from "./utils/file";

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

export interface BaseStorageOptions<T extends File = File> {
    /** Allowed MIME types */
    allowMIME?: string[];
    /** The full path of the folder where the uploaded asset will be stored. */
    assetFolder?: string;

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
