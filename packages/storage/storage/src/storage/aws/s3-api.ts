import type { Readable } from "node:stream";

import type { File } from "../utils/file";

/**
 * Part interface for multipart uploads.
 */
export interface Part {
    ETag?: string;
    PartNumber: number;
    Size?: number;
}

/**
 * An unfinished multipart upload, as ListMultipartUploads reports it.
 */
export interface MultipartUpload {
    Initiated?: Date;
    Key?: string;
    UploadId?: string;
}

/**
 * Base file type for S3-compatible storage.
 */
export interface S3CompatibleFile extends File {
    Parts?: Part[];
    partSize?: number;
    partsUrls?: string[];
    UploadId?: string;
    uri?: string;
}

/**
 * Per-call options forwarded to the underlying AWS SDK send().
 */
export interface S3CallOptions {
    /** Forwarded to `client.send(command, { abortSignal })`. */
    signal?: AbortSignal;
}

/**
 * S3 API operations interface that must be implemented by concrete storage classes.
 */
export interface S3ApiOperations {
    abortMultipartUpload: (params: { Bucket: string; Key: string; UploadId: string }, options?: S3CallOptions) => Promise<void>;

    checkBucketAccess: (params: { Bucket: string }) => Promise<void>;

    completeMultipartUpload: (
        params: {
            Bucket: string;
            IfMatch?: string;
            IfNoneMatch?: string;
            Key: string;
            Parts: { ETag: string; PartNumber: number }[];
            UploadId: string;
        },
        options?: S3CallOptions,
    ) => Promise<{ ETag?: string; Location: string }>;

    copyObject: (
        params: { ACL?: string; Bucket: string; CopySource: string; CopySourceIfMatch?: string; IfMatch?: string; IfNoneMatch?: string; Key: string; StorageClass?: string },
        options?: S3CallOptions,
    ) => Promise<void>;

    createMultipartUpload: (
        params: {
            ACL?: string;
            Bucket: string;
            ContentType?: string;
            Key: string;
            Metadata?: Record<string, string>;
        },
        options?: S3CallOptions,
    ) => Promise<{ UploadId: string }>;

    deleteObject: (params: { Bucket: string; IfMatch?: string; Key: string }, options?: S3CallOptions) => Promise<void>;

    getObject: (
        params: { Bucket: string; IfMatch?: string; Key: string; Range?: string },
        options?: S3CallOptions,
    ) => Promise<{
        Body?: ReadableStream | Readable;
        ContentLength?: number;
        ContentType?: string;
        ETag?: string;
        Expires?: Date;
        LastModified?: Date;
        Metadata?: Record<string, string>;
    }>;

    getPresignedUrl: (params: { Bucket: string; expiresIn: number; Key: string; PartNumber: number; UploadId: string }) => Promise<string>;

    headObject: (
        params: { Bucket: string; Key: string },
        options?: S3CallOptions,
    ) => Promise<{
        ContentLength?: number;
        ContentType?: string;
        ETag?: string;
        Expires?: Date;
        LastModified?: Date;
        Metadata?: Record<string, string>;
    }>;

    listMultipartUploads: (
        params: { Bucket: string; KeyMarker?: string; UploadIdMarker?: string },
        options?: S3CallOptions,
    ) => Promise<{ IsTruncated?: boolean; NextKeyMarker?: string; NextUploadIdMarker?: string; Uploads?: MultipartUpload[] }>;

    listObjectsV2: (
        params: { Bucket: string; ContinuationToken?: string; Delimiter?: string; MaxKeys?: number; Prefix?: string },
        options?: S3CallOptions,
    ) => Promise<{
        CommonPrefixes?: { Prefix?: string }[];
        Contents?: { Key?: string; LastModified?: Date }[];
        IsTruncated?: boolean;
        NextContinuationToken?: string;
    }>;

    listParts: (
        params: { Bucket: string; Key: string; PartNumberMarker?: string; UploadId: string },
        options?: S3CallOptions,
    ) => Promise<{ IsTruncated?: boolean; NextPartNumberMarker?: string; Parts?: Part[] }>;

    uploadPart: (
        params: {
            Body: Readable | ReadableStream | Uint8Array;
            Bucket: string;
            ContentLength?: number;
            ContentMD5?: string;
            Key: string;
            PartNumber: number;
            UploadId: string;
        },
        options?: S3CallOptions,
    ) => Promise<{ ETag: string }>;
}
