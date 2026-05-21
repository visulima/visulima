import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

/**
 * Object metadata returned by `Bun.S3Client.stat` / `S3File.stat`.
 */
export interface BunS3Stat {
    etag?: string;
    lastModified?: Date;
    size: number;
    type?: string;
}

/**
 * Options accepted by `S3File.presign` / `S3Client.presign`.
 */
export interface BunS3PresignOptions {
    acl?: string;
    contentDisposition?: string;
    expiresIn?: number;
    method?: "DELETE" | "GET" | "HEAD" | "POST" | "PUT";
    type?: string;
}

/**
 * Acceptable upload bodies for `Bun.S3Client.write` / `S3File.write`.
 */
export type BunS3WriteData = ArrayBuffer | Blob | ReadableStream | Response | string | Uint8Array;

/**
 * Structural view of a Bun `S3File` reference. Declared locally so the
 * adapter type-checks under Node (where the `Bun` global is absent) while
 * still binding to the real runtime object.
 */
export interface BunS3FileRef {
    arrayBuffer: () => Promise<ArrayBuffer>;
    delete: () => Promise<void>;
    exists: () => Promise<boolean>;
    presign: (options?: BunS3PresignOptions) => string;
    slice: (start: number, end?: number) => BunS3FileRef;
    stat: () => Promise<BunS3Stat>;
    stream: () => ReadableStream<Uint8Array>;
    write: (data: BunS3WriteData, options?: { type?: string }) => Promise<number>;
}

/**
 * One entry of a `Bun.S3Client.list` response.
 */
export interface BunS3ListEntry {
    eTag?: string;
    key?: string;
    lastModified?: Date | string;
    size?: number;
}

/**
 * Structural view of `Bun.S3Client`. Either pass a real instance via
 * `client`, or run under Bun and let the adapter construct one.
 */
export interface BunS3ClientLike {
    delete: (key: string) => Promise<void>;
    exists: (key: string) => Promise<boolean>;
    file: (key: string) => BunS3FileRef;
    list: (input?: { continuationToken?: string; maxKeys?: number; prefix?: string; startAfter?: string }) => Promise<{
        contents?: BunS3ListEntry[];
        isTruncated?: boolean;
        nextContinuationToken?: string;
    }>;
    presign: (key: string, options?: BunS3PresignOptions) => string;
    stat: (key: string) => Promise<BunS3Stat>;
    write: (key: string, data: BunS3WriteData, options?: { type?: string }) => Promise<number>;
}

export interface BunS3StorageOptions extends BaseStorageOptions {
    /**
     * S3 access key ID. Falls back to Bun's own env resolution
     * (`S3_ACCESS_KEY_ID`, then `AWS_ACCESS_KEY_ID`). Ignored when `client`
     * is supplied.
     */
    accessKeyId?: string;

    /**
     * Canned ACL applied to uploads (e.g. `"public-read"`). Passed through
     * to Bun's S3 client.
     */
    acl?: string;

    /**
     * S3 bucket name. Falls back to Bun's env resolution (`S3_BUCKET`, then
     * `AWS_BUCKET`). Ignored when `client` is supplied.
     */
    bucket?: string;

    /**
     * Pre-built `Bun.S3Client` (or `Bun.s3` singleton). Use this to share an
     * instance or inject a test stub. Mutually exclusive with the inline
     * credential options.
     */
    client?: BunS3ClientLike;

    /**
     * Custom S3-compatible endpoint. Falls back to Bun's env resolution
     * (`S3_ENDPOINT`, then `AWS_ENDPOINT`). Ignored when `client` is
     * supplied.
     */
    endpoint?: string;

    /**
     * Configure metafiles storage for resumable-upload bookkeeping.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * S3 region. Falls back to Bun's env resolution (`S3_REGION`, then
     * `AWS_REGION`). Ignored when `client` is supplied.
     */
    region?: string;

    /**
     * S3 secret access key. Falls back to Bun's env resolution
     * (`S3_SECRET_ACCESS_KEY`, then `AWS_SECRET_ACCESS_KEY`). Ignored when
     * `client` is supplied.
     */
    secretAccessKey?: string;

    /**
     * Temporary session token for STS credentials. Ignored when `client` is
     * supplied.
     */
    sessionToken?: string;

    /**
     * Use virtual-hosted-style addressing (`https://&lt;bucket>.&lt;host>/...`).
     * Ignored when `client` is supplied.
     */
    virtualHostedStyle?: boolean;
}

export interface BunS3Error extends Error {
    code?: string;
    name: string;
}
