import { Readable } from "node:stream";

import { parseBytes } from "@visulima/humanizer";

import { detectFileTypeFromStream } from "../../utils/detect-file-type";
import { ERRORS, throwErrorCode } from "../../utils/errors";
import mapValues from "../../utils/primitives/map-values";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import toSeconds from "../../utils/primitives/to-seconds";
import type { RetryConfig } from "../../utils/retry";
import { createRetryWrapper } from "../../utils/retry";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import { getMetaVersion, setMetaVersion } from "../meta-storage";
import { BaseStorage } from "../storage";
import type { BaseStorageOptions, OperationOptions, StoredObject } from "../types";
import type { File, FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import { assertNextPartSize, buildRangeHeader, isBadDigest, isNotFound, MIN_PART_SIZE, PART_SIZE, withoutParts } from "./s3-utils";

// Re-exported for existing importers of this module.
export { buildRangeHeader } from "./s3-utils";

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
            Key: string;
            Parts: { ETag: string; PartNumber: number }[];
            UploadId: string;
        },
        options?: S3CallOptions,
    ) => Promise<{ ETag?: string; Location: string }>;

    copyObject: (params: { Bucket: string; CopySource: string; Key: string; StorageClass?: string }, options?: S3CallOptions) => Promise<void>;

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

    deleteObject: (params: { Bucket: string; Key: string }, options?: S3CallOptions) => Promise<void>;

    getObject: (
        params: { Bucket: string; Key: string; Range?: string },
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

/**
 * Base class for S3-compatible storage implementations.
 * Contains all shared business logic for S3 operations.
 * @template TFile The file type used by this storage backend.
 */
export abstract class S3BaseStorage<TFile extends S3CompatibleFile = S3CompatibleFile> extends BaseStorage<TFile> {
    /**
     * Only `md5` is verified by S3 itself (`Content-MD5` on UploadPart, `BadDigest` on mismatch).
     * The flexible `x-amz-checksum-*` algorithms (sha1/sha256/crc32/crc32c) are not offered: S3
     * rejects a part checksum whose algorithm was not declared on CreateMultipartUpload, and a
     * TUS client only announces its algorithm per PATCH, after the multipart upload exists.
     */
    public override checksumTypes: string[] = ["md5"];

    public override readonly supportsRange: boolean = true;

    public override readonly supportsDelimiter: boolean = true;

    /** Parts are appended in order (see assertContiguousWrite). */
    public override readonly sequentialWrites: boolean = true;

    protected bucket: string;

    /** Set here for a caller-supplied or local meta storage, otherwise by the subclass constructor. */
    protected meta!: MetaStorage<TFile>;

    /**
     * S3 multipart upload does not allow more than 10000 parts.
     */
    protected readonly MAX_PARTS = 10_000;

    protected readonly partSize: number;

    protected readonly retry: ReturnType<typeof createRetryWrapper>;

    protected readonly resolvedRetryConfig: RetryConfig;

    /**
     * Abstract method to get S3 API operations implementation.
     */
    protected abstract getS3Api(): S3ApiOperations;

    /**
     * Abstract method to get the file class constructor.
     */
    protected abstract getFileClass(): new (config: FileInit) => TFile;

    /**
     * Abstract method to get ACL value.
     */
    protected abstract getAcl(): string | undefined;

    /**
     * Abstract method for access check.
     */
    protected abstract accessCheck(maxWaitTime?: number): Promise<void>;

    public constructor(
        config: Omit<BaseStorageOptions<TFile>, "metaStorage" | "retryConfig"> & {
            bucket: string;
            clientDirectUpload?: boolean;
            metaStorage?: MetaStorage<TFile>;
            metaStorageConfig?: unknown;
            partSize?: number | string;
            retryConfig?: RetryConfig;
        },
    ) {
        super(config);

        this.bucket = config.bucket;

        this.partSize = typeof config.partSize === "string" ? parseBytes(config.partSize) : config.partSize || PART_SIZE;

        if (this.partSize < MIN_PART_SIZE) {
            throw new Error("Minimum allowed partSize value is 5MB");
        }

        // Initialize retry wrapper with config or defaults
        const retryConfig: RetryConfig = {
            backoffMultiplier: 2,
            initialDelay: 1000,
            maxDelay: 30_000,
            maxRetries: 3,
            retryableStatusCodes: [408, 429, 500, 502, 503, 504],
            shouldRetry: (error: unknown) => {
                const errorWithMetadata = error as { retryable?: boolean; statusCode?: number };

                if (errorWithMetadata.statusCode && [408, 429, 500, 502, 503, 504].includes(errorWithMetadata.statusCode)) {
                    return true;
                }

                // Defer to the retry engine's built-in heuristics unless the SDK
                // explicitly flagged the error retryable.
                return errorWithMetadata.retryable === true ? true : undefined;
            },
            ...config.retryConfig,
        };

        this.retry = createRetryWrapper(retryConfig);
        this.resolvedRetryConfig = retryConfig;

        const { metaStorage, metaStorageConfig } = config;

        if (metaStorage) {
            this.meta = metaStorage;
        } else {
            const metaConfig = { ...config, ...(metaStorageConfig as Record<string, unknown>), logger: this.logger } as Record<string, unknown>;
            const localMeta = "directory" in metaConfig;

            // Otherwise the subclass creates its bucket-backed meta storage once its client exists.
            // Building a LocalMetaStorage here regardless created a directory on local disk even
            // for storages that never use it (e.g. aws-light on an edge runtime).
            if (localMeta) {
                this.logger?.debug("Using local meta storage");
                this.meta = new LocalMetaStorage<TFile>(metaConfig);
            }
        }

        // Subclasses start the bucket probe (startAccessCheck) at the end of their own constructor:
        // their S3 client only exists after super() returns.
    }

    protected override getRetryConfig(): RetryConfig {
        return this.resolvedRetryConfig;
    }

    /**
     * Creates a new S3 multipart upload.
     */
    public async create(config: FileInit, options?: OperationOptions): Promise<TFile> {
        return this.instrumentOperation("create", async () => {
            // Handle TTL option
            const processedConfig = { ...config };

            if (config.ttl) {
                const ttlMs = typeof config.ttl === "string" ? toMilliseconds(config.ttl) : config.ttl;

                if (ttlMs !== undefined) {
                    processedConfig.expiredAt = Date.now() + ttlMs;
                }
            }

            const file = new (this.getFileClass())(processedConfig);

            file.name = this.namingFunction(file);

            await this.validate(file);

            try {
                const existing = await this.getMeta(file.id);

                if (existing.bytesWritten >= 0) {
                    return existing;
                }
            } catch {
                // ignore
            }

            const s3Api = this.getS3Api();
            let result;

            try {
                result = await this.runOperation(options, (signal) =>
                    s3Api.createMultipartUpload(
                        {
                            ACL: this.getAcl(),
                            Bucket: this.bucket,
                            ContentType: file.contentType,
                            Key: file.name,
                            Metadata: mapValues({ originalName: file.originalName, ...file.metadata }, (value) => encodeURI(String(value))),
                        },
                        { signal },
                    ),
                );
            } catch {
                return throwErrorCode(ERRORS.FILE_ERROR, "s3 create upload error");
            }

            const { UploadId } = result || {};

            if (!UploadId) {
                return throwErrorCode(ERRORS.FILE_ERROR, "s3 create upload error");
            }

            file.UploadId = UploadId;
            file.bytesWritten = 0;

            if (this.config.clientDirectUpload) {
                (file as TFile & { partSize?: number }).partSize ??= this.partSize;
            }

            await this.saveMeta(file);

            file.status = "created";

            await this.onCreate(file);

            if (this.config.clientDirectUpload) {
                return this.buildPresigned(file);
            }

            return file;
        });
    }

    /**
     * Writes data to an S3 multipart upload.
     */
    public async write(part: FilePart | FileQuery | TFile, options?: OperationOptions): Promise<TFile> {
        return this.instrumentOperation("write", async () =>
            // Read the metadata under the lock: one read before it could be stale by the time a
            // concurrent write to the same upload released it.
            this.withLock(part.id, async () => {
                let file: TFile;

                if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                    file = part;
                } else {
                    file = await this.getMeta(part.id);

                    await this.checkIfExpired(file);
                }

                if (file.status === "completed") {
                    return file;
                }

                if (typeof part.size === "number" && part.size > 0) {
                    updateSize(file, part.size);
                }

                if (!partMatch(part, file)) {
                    return throwErrorCode(ERRORS.FILE_CONFLICT);
                }

                if (this.config.clientDirectUpload) {
                    return this.buildPresigned(file);
                }

                file.Parts ??= await this.getParts(file);
                file.bytesWritten = file.Parts.map((item) => item.Size || 0).reduce((p, c) => p + c, 0);

                if (hasContent(part)) {
                    if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                        return throwErrorCode(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
                    }

                    // Parts are appended strictly in order (PartNumber = Parts.length + 1). Persist the
                    // offset S3 reports before rejecting a misplaced chunk, so a stale stored offset
                    // heals and the client's next HEAD sees the real value.
                    try {
                        this.assertContiguousWrite(part, file);
                    } catch (error: unknown) {
                        await this.saveMeta(withoutParts(file));

                        throw error;
                    }

                    assertNextPartSize(part, file);

                    // Detect file type from stream if contentType is not set or is default
                    if (file.Parts.length === 0 && (!file.contentType || file.contentType === "application/octet-stream")) {
                        try {
                            const readable = part.body instanceof Readable ? part.body : Readable.fromWeb(part.body);

                            const { fileType, stream: detectedStream } = await detectFileTypeFromStream(readable);

                            if (fileType?.mime) {
                                file.contentType = fileType.mime;
                            }

                            part.body = detectedStream;
                        } catch {
                            // If file type detection fails, continue with original stream
                        }
                    }

                    if (file.Parts.length >= this.MAX_PARTS) {
                        throw new Error(`Exceeded ${this.MAX_PARTS} as part of the upload to ${this.bucket}.`);
                    }

                    const partNumber = file.Parts.length + 1;
                    const s3Api = this.getS3Api();

                    const uploadId = file.UploadId;

                    if (!uploadId) {
                        throw new Error("UploadId is required");
                    }

                    const partBody = part.body as Readable | ReadableStream | Uint8Array;
                    // A Readable/ReadableStream is consumed on first send and
                    // cannot be replayed; only an in-memory buffer is safe to
                    // retry. Forces maxRetries=0 for stream bodies.
                    const replayable = partBody instanceof Uint8Array;

                    let ETag: string;

                    try {
                        ({ ETag } = await this.runOperation(
                            options,
                            (signal) =>
                                s3Api.uploadPart(
                                    {
                                        Body: partBody,
                                        Bucket: this.bucket,
                                        ContentLength: part.contentLength || 0,
                                        Key: file.name,
                                        PartNumber: partNumber,
                                        UploadId: uploadId,
                                        ...(part.checksumAlgorithm === "md5" && part.checksum ? { ContentMD5: part.checksum } : {}),
                                    },
                                    { signal },
                                ),
                            { replayable },
                        ));
                    } catch (error: unknown) {
                        if (isBadDigest(error)) {
                            return throwErrorCode(ERRORS.CHECKSUM_MISMATCH);
                        }

                        throw error;
                    }

                    const uploadPart: Part = { ETag, PartNumber: partNumber, Size: part.contentLength };

                    file.Parts = [...file.Parts, uploadPart];
                    file.bytesWritten += part.contentLength || 0;
                }

                this.cache.set(file.id, file);

                file.status = getFileStatus(file);

                if (file.status === "completed") {
                    await this.internalOnComplete(file);
                } else if (hasContent(part)) {
                    // Persist the offset after every partial write: HEAD reports it and the next PATCH is checked against it.
                    await this.saveMeta(withoutParts(file));
                }

                return file;
            }),
        );
    }

    /**
     * Deletes an upload and its metadata: aborts an unfinished multipart upload, or deletes the
     * object of a finished one. An object without metadata (completed by an older version, which
     * dropped it) is deleted too.
     */
    public async delete({ id }: FileQuery, options?: OperationOptions): Promise<TFile> {
        return this.instrumentOperation("delete", async () => {
            const { file, tracked } = await this.findUpload(id, options);

            // Remove the data before the metadata, so a failure leaves a record to retry with
            // instead of an unreachable multipart upload that keeps incurring storage charges.
            if (file.status === "completed") {
                const s3Api = this.getS3Api();

                await this.runOperation(options, (signal) => s3Api.deleteObject({ Bucket: this.bucket, Key: file.name }, { signal }));
            } else {
                await this.abortMultipartUpload(file, options);
            }

            if (tracked) {
                await this.deleteMeta(file.id);
            }

            const deletedFile = { ...file, status: "deleted" as const };

            await this.onDelete(deletedFile);

            return deletedFile;
        });
    }

    /**
     * Copies an upload's object to `destination`, a key in the same bucket. The copy is an object
     * without upload metadata.
     */
    public async copy(name: string, destination: string, options?: OperationOptions & { storageClass?: string }): Promise<TFile> {
        return this.instrumentOperation("copy", async () => {
            S3BaseStorage.assertSafeId(destination);

            const { file } = await this.findUpload(name, options);

            return this.copyObject(file, destination, options);
        });
    }

    /**
     * Moves an upload's object to `destination`, a key in the same bucket, and drops the source
     * object and its metadata.
     */
    public async move(name: string, destination: string, options?: OperationOptions): Promise<TFile> {
        return this.instrumentOperation("move", async () => {
            S3BaseStorage.assertSafeId(destination);

            const { file, tracked } = await this.findUpload(name, options);
            const moved = await this.copyObject(file, destination, options);
            const s3Api = this.getS3Api();

            await this.runOperation(options, (signal) => s3Api.deleteObject({ Bucket: this.bucket, Key: file.name }, { signal }));

            if (tracked) {
                await this.deleteMeta(file.id);
            }

            return moved;
        });
    }

    /**
     * The uploads {@link BaseStorage.purge} checks: every object in the bucket (purge skips the ones
     * without upload metadata), and this storage's own unfinished multipart uploads, which no object
     * listing shows. Another client's multipart upload in a shared bucket is not ours to abort;
     * untracked leftovers are for an S3 lifecycle rule (AbortIncompleteMultipartUpload).
     */
    protected override async listUploads(): Promise<TFile[]> {
        // Metadata is looked up by the object key, which is the upload id unless a custom `filename` is set.
        const uploads = await this.list(Number.POSITIVE_INFINITY);
        const s3Api = this.getS3Api();
        let marker: { KeyMarker?: string; UploadIdMarker?: string } | undefined = {};

        while (marker) {
            const previous: { KeyMarker?: string; UploadIdMarker?: string } = marker;
            const page = await this.runOperation(undefined, (signal) => s3Api.listMultipartUploads({ Bucket: this.bucket, ...previous }, { signal }));

            for (const { Key, UploadId } of page.Uploads ?? []) {
                const file = Key === undefined ? undefined : await this.findMeta(Key);

                if (UploadId !== undefined && file?.UploadId === UploadId) {
                    uploads.push(file);
                }
            }

            // A truncated page without new markers would loop forever; stop instead.
            marker =
                page.IsTruncated && (page.NextKeyMarker !== previous.KeyMarker || page.NextUploadIdMarker !== previous.UploadIdMarker)
                    ? { KeyMarker: page.NextKeyMarker, UploadIdMarker: page.NextUploadIdMarker }
                    : undefined;
        }

        return uploads;
    }

    /**
     * Lists files in the bucket.
     */
    public override async list(limit = 1000, options?: OperationOptions): Promise<TFile[]> {
        return this.instrumentOperation(
            "list",

            async () => {
                const s3Api = this.getS3Api();
                const pageSize = Math.min(limit, 1000);
                let parameters: { Bucket: string; ContinuationToken?: string; MaxKeys?: number } = {
                    Bucket: this.bucket,
                    MaxKeys: pageSize,
                };
                const items: TFile[] = [];

                let truncated = true;

                while (truncated && items.length < limit) {
                    try {
                        const response = await this.runOperation(options, (signal) => s3Api.listObjectsV2(parameters, { signal }));

                        for (const { Key, LastModified } of response?.Contents || []) {
                            if (items.length >= limit) {
                                break;
                            }

                            if (Key === undefined || this.isMetaKey(Key)) {
                                continue;
                            }

                            // Skip the per-object HEAD: it turned the listing into
                            // an N+1 call just to surface lazy expiry. Callers that
                            // want expiry-cleanup can run the purge loop separately.
                            items.push({
                                id: Key,
                                ...(LastModified && { createdAt: LastModified }),
                            } as TFile);
                        }

                        truncated = response.IsTruncated || false;

                        if (truncated && response.NextContinuationToken && items.length < limit) {
                            parameters = {
                                ...parameters,
                                ContinuationToken: response.NextContinuationToken,
                                MaxKeys: Math.min(pageSize, limit - items.length),
                            };
                        }
                    } catch (error) {
                        const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

                        // Sequential error handling is intentional

                        await this.onError(httpError);
                        throw error;
                    }
                }

                return items;
            },
            { limit },
        );
    }

    /**
     * Directory-style listing via S3's native `Delimiter`/`Prefix` — the provider returns the direct
     * child objects plus the `CommonPrefixes` ("subdirectories") one delimiter level below `prefix`,
     * so the whole subtree never has to be fetched. Pages until exhausted or `limit` direct files
     * have been collected; common prefixes are accumulated (deduped) across pages.
     */
    public override async listDirectory(
        options?: OperationOptions & { delimiter: string; limit?: number; prefix?: string },
    ): Promise<{ files: TFile[]; prefixes: string[] }> {
        return this.instrumentOperation(
            "listDirectory",
            async () => {
                const s3Api = this.getS3Api();
                const limit = options?.limit ?? 1000;
                const pageSize = Math.min(limit, 1000);

                let parameters: { Bucket: string; ContinuationToken?: string; Delimiter?: string; MaxKeys?: number; Prefix?: string } = {
                    Bucket: this.bucket,
                    Delimiter: options?.delimiter,
                    MaxKeys: pageSize,
                    ...(options?.prefix !== undefined && { Prefix: options.prefix }),
                };

                const files: TFile[] = [];
                const prefixes = new Set<string>();

                let truncated = true;

                while (truncated && files.length < limit) {
                    try {
                        const response = await this.runOperation(options, (signal) => s3Api.listObjectsV2(parameters, { signal }));

                        for (const { Prefix } of response?.CommonPrefixes || []) {
                            if (Prefix !== undefined) {
                                prefixes.add(Prefix);
                            }
                        }

                        for (const { Key, LastModified } of response?.Contents || []) {
                            if (files.length >= limit) {
                                break;
                            }

                            if (Key === undefined || this.isMetaKey(Key)) {
                                continue;
                            }

                            files.push({ id: Key, ...(LastModified && { createdAt: LastModified }) } as TFile);
                        }

                        truncated = response.IsTruncated || false;

                        if (truncated && response.NextContinuationToken && files.length < limit) {
                            parameters = {
                                ...parameters,
                                ContinuationToken: response.NextContinuationToken,
                                MaxKeys: Math.min(pageSize, limit - files.length),
                            };
                        }
                    } catch (error) {
                        const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

                        await this.onError(httpError);

                        throw error;
                    }
                }

                return { files, prefixes: [...prefixes] };
            },
            { limit: options?.limit ?? 1000 },
        );
    }

    /**
     * Whether an upload's object exists: the one its metadata names, or, for an ID without
     * metadata, the object stored under it. An unfinished upload has no object yet.
     */
    public override async exists({ id }: FileQuery, options?: OperationOptions): Promise<boolean> {
        return this.instrumentOperation("exists", async () => (await this.findStoredObject(await this.storedName(id), options)) !== undefined);
    }

    /**
     * Gets an uploaded file by ID.
     */
    public async get({ id }: FileQuery, options?: OperationOptions & { range?: { end?: number; start: number } }): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const s3Api = this.getS3Api();
            const key = await this.storedName(id);
            const rangeHeader = buildRangeHeader(options?.range);
            const { Body, ContentLength, ContentType, ETag, Expires, LastModified, Metadata } = await this.runOperation(options, (signal) =>
                s3Api.getObject(
                    {
                        Bucket: this.bucket,
                        Key: key,
                        ...(rangeHeader !== undefined && { Range: rangeHeader }),
                    },
                    { signal },
                ),
            );

            await this.checkIfExpired({ expiredAt: Expires } as TFile);

            const chunks: Uint8Array[] = [];

            if (Body) {
                // Handle both ReadableStream and Readable
                if (Body instanceof Readable) {
                    // Node.js Readable stream
                    for await (const chunk of Body) {
                        chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
                    }
                } else {
                    // Web ReadableStream
                    const reader = (Body as ReadableStream<Uint8Array>).getReader();

                    try {
                        while (true) {
                            const { done, value } = await reader.read();

                            if (done) {
                                break;
                            }

                            chunks.push(value);
                        }
                    } finally {
                        reader.releaseLock();
                    }
                }
            }

            const { originalName, ...meta } = Metadata || {};

            return {
                content: Buffer.concat(chunks),
                contentType: ContentType as string,
                ETag,
                expiredAt: Expires,
                id,
                metadata: meta,
                modifiedAt: LastModified,
                name: key,
                originalName: originalName || key,
                size: Number(ContentLength),
            };
        });
    }

    /**
     * Gets file stream (abstract - must be implemented by subclasses due to stream differences).
     */
    public abstract override getStream(
        query: FileQuery,
        options?: OperationOptions,
    ): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }>;

    /**
     * Builds presigned URLs for client uploads.
     */
    protected async buildPresigned(file: TFile): Promise<TFile> {
        const fileWithParts = file as TFile & { bytesWritten?: number; Parts?: Part[]; partsUrls?: string[]; uri?: string };

        if (!fileWithParts.Parts?.length) {
            fileWithParts.Parts = await this.getParts(file);
        }

        // Calculate bytesWritten as sum of actual part sizes (same as write method)
        fileWithParts.bytesWritten = fileWithParts.Parts.map((item) => item.Size || 0).reduce((p, c) => p + c, 0);
        file.status = getFileStatus(fileWithParts);

        if (!fileWithParts.partsUrls?.length) {
            fileWithParts.partsUrls = await this.getPartsPresignedUrls(file);
        }

        if (file.status === "completed") {
            await this.internalOnComplete(file);
        }

        return file;
    }

    /**
     * Gets presigned URLs for all parts.
     */
    protected async getPartsPresignedUrls(file: TFile): Promise<string[]> {
        (file as TFile & { partSize?: number }).partSize ??= this.partSize;

        const uploadId = file.UploadId;

        if (!uploadId) {
            throw new Error("UploadId is required for getting presigned URLs");
        }

        const partsNumber = Math.trunc((file.size as number) / this.partSize) + 1;
        const promises = [];
        const expiresIn = Math.trunc(toSeconds(this.config.expiration?.maxAge || "6hrs"));
        const s3Api = this.getS3Api();

        for (let index = 0; index < partsNumber; index++) {
            promises.push(
                s3Api.getPresignedUrl({
                    Bucket: this.bucket,
                    expiresIn,
                    Key: file.name,
                    PartNumber: index + 1,
                    UploadId: uploadId,
                }),
            );
        }

        return Promise.all(promises);
    }

    /**
     * Gets parts for a multipart upload.
     */
    protected async getParts(file: TFile): Promise<Part[]> {
        const s3Api = this.getS3Api();
        const uploadId = file.UploadId;

        if (!uploadId) {
            throw new Error("UploadId is required");
        }

        // ListParts answers at most 1,000 parts per call; page through the rest (#916).
        const parts: Part[] = [];
        let partNumberMarker: string | undefined;

        do {
            const marker = partNumberMarker;

            const {
                IsTruncated,
                NextPartNumberMarker,
                Parts = [],
            } = await this.runOperation(undefined, (signal) =>
                s3Api.listParts(
                    {
                        Bucket: this.bucket,
                        Key: file.name,
                        PartNumberMarker: marker,
                        UploadId: uploadId,
                    },
                    { signal },
                ),
            );

            parts.push(...Parts);

            // A truncated page without a usable marker would loop forever; stop instead.
            partNumberMarker = IsTruncated && NextPartNumberMarker && NextPartNumberMarker !== marker ? NextPartNumberMarker : undefined;
        } while (partNumberMarker !== undefined);

        return parts;
    }

    /**
     * Completes a multipart upload.
     */
    protected completeMultipartUpload(file: TFile): Promise<{ ETag?: string; Location: string }> {
        const s3Api = this.getS3Api();
        const uploadId = file.UploadId;

        if (!uploadId) {
            throw new Error("UploadId is required");
        }

        const parts =
            file.Parts?.map(({ ETag, PartNumber }) => {
                if (!ETag || !PartNumber) {
                    throw new Error("ETag and PartNumber are required");
                }

                return { ETag, PartNumber };
            }) || [];

        return this.runOperation(undefined, (signal) =>
            s3Api.completeMultipartUpload(
                {
                    Bucket: this.bucket,
                    Key: file.name,
                    Parts: parts,
                    UploadId: uploadId,
                },
                { signal },
            ),
        );
    }

    /**
     * Aborts a multipart upload.
     */
    protected async abortMultipartUpload(file: TFile, options?: OperationOptions): Promise<void> {
        const s3Api = this.getS3Api();
        const uploadId = file.UploadId;

        if (!uploadId) {
            return;
        }

        try {
            await this.runOperation(options, (signal) =>
                s3Api.abortMultipartUpload(
                    {
                        Bucket: this.bucket,
                        Key: file.name,
                        UploadId: uploadId,
                    },
                    { signal },
                ),
            );
        } catch (error) {
            // NoSuchUpload: already aborted or completed. Any other failure must keep the metadata.
            if (!isNotFound(error)) {
                throw error;
            }
        }
    }

    protected override async statObject(id: string, options?: OperationOptions): Promise<StoredObject | undefined> {
        const s3Api = this.getS3Api();

        try {
            const head = await this.runOperation(options, (signal) => s3Api.headObject({ Bucket: this.bucket, Key: id }, { signal }));

            return { contentType: head.ContentType, etag: head.ETag, size: head.ContentLength ?? 0 };
        } catch (error) {
            if (isNotFound(error)) {
                return undefined;
            }

            throw error;
        }
    }

    /**
     * Whether a bucket key is a metadata record: they live next to the objects when the meta
     * storage uses the bucket, and must not be listed or purged as uploads of their own.
     */
    protected isMetaKey(key: string): boolean {
        const { prefix, suffix } = this.meta;

        return (prefix !== "" || suffix !== "") && key.startsWith(prefix) && key.endsWith(suffix);
    }

    /**
     * The upload's metadata, or for an ID without any, the object stored under it. `tracked` tells
     * whether there is metadata to delete with the upload.
     */
    protected async findUpload(id: string, options?: OperationOptions): Promise<{ file: TFile; tracked: boolean }> {
        S3BaseStorage.assertSafeId(id);

        const meta = await this.findMeta(id);

        if (meta) {
            return { file: meta, tracked: true };
        }

        const file = await this.findStoredObject(id, options);

        return file === undefined ? throwErrorCode(ERRORS.FILE_NOT_FOUND) : { file, tracked: false };
    }

    /**
     * Copies `file`'s object to `destination` in the same bucket.
     */
    protected async copyObject(file: TFile, destination: string, options?: OperationOptions & { storageClass?: string }): Promise<TFile> {
        const s3Api = this.getS3Api();

        await this.runOperation(options, (signal) =>
            s3Api.copyObject(
                {
                    Bucket: this.bucket,
                    // The source is "bucket/key" with the key URL-encoded.
                    CopySource: `${this.bucket}/${file.name
                        .split("/")
                        .map((segment) => encodeURIComponent(segment))
                        .join("/")}`,
                    // Always the same bucket: a leading "/" in `destination` once re-targeted another one.
                    Key: destination,
                    ...(options?.storageClass && { StorageClass: options.storageClass }),
                },
                { signal },
            ),
        );

        return { ...file, id: destination, name: destination };
    }

    /**
     * Completes the multipart upload and keeps the finished upload's metadata, as the other
     * storages do. A failed completion leaves the metadata of the unfinished upload in place, so it
     * can be retried or aborted.
     */
    protected internalOnComplete = async (file: TFile): Promise<[{ ETag?: string; Location: string }, TFile]> => {
        const completed = await this.completeMultipartUpload(file);

        delete file.Parts;
        file.uri = completed.Location;
        file.ETag = completed.ETag;

        // Presigned part URLs are only useful while uploading and would bloat the record.
        const { partsUrls: _partsUrls, ...record } = file;

        setMetaVersion(record, getMetaVersion(file));
        await this.saveMeta(record as TFile);

        return [completed, file];
    };
}
