import { Readable } from "node:stream";

// eslint-disable-next-line import/no-extraneous-dependencies
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
import { BaseStorage } from "../storage";
import type { File, FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, isExpired, partMatch, updateSize } from "../utils/file";

/**
 * Part interface for multipart uploads.
 */
export interface Part {
    ETag?: string;
    PartNumber: number;
    Size?: number;
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

const MIN_PART_SIZE = 5 * 1024 * 1024;
const PART_SIZE = 16 * 1024 * 1024;

/**
 * S3 API operations interface that must be implemented by concrete storage classes.
 */
export interface S3ApiOperations {
    abortMultipartUpload: (params: { Bucket: string; Key: string; UploadId: string }) => Promise<void>;

    checkBucketAccess: (params: { Bucket: string }) => Promise<void>;

    completeMultipartUpload: (params: {
        Bucket: string;
        Key: string;
        Parts: { ETag: string; PartNumber: number }[];
        UploadId: string;
    }) => Promise<{ ETag?: string; Location: string }>;

    copyObject: (params: { Bucket: string; CopySource: string; Key: string; StorageClass?: string }) => Promise<void>;

    createMultipartUpload: (params: {
        ACL?: string;
        Bucket: string;
        ContentType?: string;
        Key: string;
        Metadata?: Record<string, string>;
    }) => Promise<{ UploadId: string }>;

    deleteObject: (params: { Bucket: string; Key: string }) => Promise<void>;

    getObject: (params: { Bucket: string; Key: string }) => Promise<{
        Body?: ReadableStream | Readable;
        ContentLength?: number;
        ContentType?: string;
        ETag?: string;
        Expires?: Date;
        LastModified?: Date;
        Metadata?: Record<string, string>;
    }>;

    getPresignedUrl: (params: { Bucket: string; expiresIn: number; Key: string; PartNumber: number; UploadId: string }) => Promise<string>;

    headObject: (params: { Bucket: string; Key: string }) => Promise<{
        ContentLength?: number;
        ContentType?: string;
        ETag?: string;
        Expires?: Date;
        LastModified?: Date;
        Metadata?: Record<string, string>;
    }>;

    listObjectsV2: (params: { Bucket: string; ContinuationToken?: string; MaxKeys?: number }) => Promise<{
        Contents?: { Key?: string; LastModified?: Date }[];
        IsTruncated?: boolean;
        NextContinuationToken?: string;
    }>;

    listParts: (params: { Bucket: string; Key: string; UploadId: string }) => Promise<{ Parts?: Part[] }>;

    uploadPart: (params: {
        Body: Readable | ReadableStream | Uint8Array;
        Bucket: string;
        ContentLength?: number;
        ContentMD5?: string;
        Key: string;
        PartNumber: number;
        UploadId: string;
    }) => Promise<{ ETag: string }>;
}

/**
 * Base class for S3-compatible storage implementations.
 * Contains all shared business logic for S3 operations.
 * @template TFile The file type used by this storage backend.
 */
export abstract class S3BaseStorage<TFile extends S3CompatibleFile = S3CompatibleFile> extends BaseStorage<TFile, FileReturn> {
    public override checksumTypes: string[] = ["md5", "crc32", "crc32c", "sha1", "sha256"];

    protected bucket: string;

    protected meta: MetaStorage<TFile>;

    /**
     * S3 multipart upload does not allow more than 10000 parts.
     */
    protected readonly MAX_PARTS = 10_000;

    protected readonly partSize: number;

    protected readonly retry: ReturnType<typeof createRetryWrapper>;

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

    public constructor(config: {
        bucket: string;
        clientDirectUpload?: boolean;
        expiration?: { maxAge?: string };
        filename?: (file: TFile) => string;
        logger?: BaseStorage<TFile>["logger"];
        metaStorage?: MetaStorage<TFile>;
        metaStorageConfig?: unknown;
        partSize?: number | string;
        retryConfig?: RetryConfig;
    }) {
        super(config as never);

        this.bucket = config.bucket;

        this.partSize = typeof config.partSize === "string" ? parseBytes(config.partSize) : (config.partSize as number | undefined) || PART_SIZE;

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

                return errorWithMetadata.retryable ?? false;
            },
            ...config.retryConfig,
        };

        this.retry = createRetryWrapper(retryConfig);

        const { metaStorage, metaStorageConfig } = config;

        if (metaStorage) {
            this.meta = metaStorage;
        } else {
            const metaConfig = { ...config, ...metaStorageConfig, logger: this.logger };
            const localMeta = "directory" in metaConfig;

            if (localMeta) {
                this.logger?.debug("Using local meta storage");
                this.meta = new LocalMetaStorage<TFile>(metaConfig);
            } else {
                // For aws-light, we'll use local meta storage by default
                // S3Storage will override this to use S3MetaStorage
                this.meta = new LocalMetaStorage<TFile>(metaConfig);
            }
        }

        this.isReady = false;
        this.accessCheck()
            .then(() => {
                this.isReady = true;
            })
            .catch((error) => {
                this.logger?.error("Storage access check failed: %O", error);
            });
    }

    /**
     * Creates a new S3 multipart upload.
     */
    public async create(config: FileInit): Promise<TFile> {
        return this.instrumentOperation("create", async () => {
            // Handle TTL option
            const processedConfig = { ...config };

            if (config.ttl) {
                const ttlMs = typeof config.ttl === "string" ? toMilliseconds(config.ttl) : config.ttl;

                if (ttlMs !== undefined) {
                    processedConfig.expiredAt = Date.now() + ttlMs;
                }
            }

            const file = new (this.getFileClass())(processedConfig) as TFile;

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
                result = await this.retry(() =>
                    s3Api.createMultipartUpload({
                        ACL: this.getAcl(),
                        Bucket: this.bucket,
                        ContentType: file.contentType,
                        Key: file.name,
                        Metadata: mapValues({ originalName: file.originalName, ...file.metadata } as Record<string, unknown>, (value) =>
                            encodeURI(String(value))),
                    }),
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
    public async write(part: FilePart | FileQuery | TFile): Promise<TFile> {
        return this.instrumentOperation("write", async () => {
            let file: TFile;

            if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                file = part as TFile;
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

            await this.lock(part.id);

            try {
                if (hasContent(part)) {
                    if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                        return throwErrorCode(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
                    }

                    // Detect file type from stream if contentType is not set or is default
                    if (file.Parts.length === 0 && (!file.contentType || file.contentType === "application/octet-stream")) {
                        try {
                            const { fileType, stream: detectedStream } = await detectFileTypeFromStream(part.body as ReadableStream<Uint8Array>);

                            if (fileType?.mime) {
                                file.contentType = fileType.mime;
                            }

                            part.body = detectedStream;
                        } catch {
                            // If file type detection fails, continue with original stream
                        }
                    }

                    if (file.Parts.length > this.MAX_PARTS) {
                        throw new Error(`Exceeded ${this.MAX_PARTS} as part of the upload to ${this.bucket}.`);
                    }

                    const partNumber = file.Parts.length + 1;
                    const s3Api = this.getS3Api();

                    const uploadId = file.UploadId;

                    if (!uploadId) {
                        throw new Error("UploadId is required");
                    }

                    const { ETag } = await this.retry(() =>
                        s3Api.uploadPart({
                            Body: part.body as Readable | ReadableStream | Uint8Array,
                            Bucket: this.bucket,
                            ContentLength: part.contentLength || 0,
                            Key: file.name,
                            PartNumber: partNumber,
                            UploadId: uploadId,
                            ...part.checksumAlgorithm === "md5" ? { ContentMD5: part.checksum } : {},
                        }),
                    );

                    const uploadPart: Part = { ETag, PartNumber: partNumber, Size: part.contentLength };

                    file.Parts = [...file.Parts, uploadPart];
                    file.bytesWritten += part.contentLength || 0;
                }

                this.cache.set(file.id, file);

                file.status = getFileStatus(file);

                if (file.status === "completed") {
                    const [completed] = await this.internalOnComplete(file);

                    delete file.Parts;

                    file.uri = completed.Location;
                    file.ETag = completed.ETag;
                }
            } finally {
                await this.unlock(part.id);
            }

            return file;
        });
    }

    /**
     * Deletes an upload and its metadata.
     */
    public async delete({ id }: FileQuery): Promise<TFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);

            file.status = "deleted";

            await Promise.all([this.deleteMeta(file.id), this.retry(() => this.abortMultipartUpload(file))]);

            const deletedFile = { ...file };

            await this.onDelete(deletedFile);

            return deletedFile;
        });
    }

    /**
     * Copies an upload file to a new location.
     */
    public async copy(name: string, destination: string, options?: { storageClass?: string }): Promise<TFile> {
        return this.instrumentOperation("copy", async () => {
            const sourceFile = await this.getMeta(name);
            const CopySource = `${this.bucket}/${name}`;

            let Bucket = this.bucket;
            let Key = destination;

            if (destination.startsWith("/")) {
                const [, bucketName, ...pathSegments] = destination.split("/");

                Bucket = bucketName || this.bucket;
                Key = pathSegments.join("/");
            }

            const s3Api = this.getS3Api();

            await this.retry(() =>
                s3Api.copyObject({
                    Bucket,
                    CopySource,
                    Key,
                    ...options?.storageClass && { StorageClass: options.storageClass },
                }),
            );

            return { ...sourceFile, id: Key, name: Key } as TFile;
        });
    }

    /**
     * Moves an upload file to a new location.
     */
    public async move(name: string, destination: string): Promise<TFile> {
        return this.instrumentOperation("move", async () => {
            await this.copy(name, destination);

            const s3Api = this.getS3Api();

            await this.retry(() => s3Api.deleteObject({ Bucket: this.bucket, Key: name }));

            return await this.getMeta(destination);
        });
    }

    /**
     * Lists files in the bucket.
     */
    public override async list(limit = 1000): Promise<TFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const s3Api = this.getS3Api();
                let parameters: { Bucket: string; ContinuationToken?: string; MaxKeys?: number } = {
                    Bucket: this.bucket,
                    MaxKeys: limit,
                };
                const items: TFile[] = [];

                let truncated = true;

                while (truncated) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        const response = await this.retry(() => s3Api.listObjectsV2(parameters));

                        for (const { Key, LastModified } of response?.Contents || []) {
                            if (Key !== undefined) {
                                // eslint-disable-next-line no-await-in-loop
                                const { Expires } = await this.retry(() => s3Api.headObject({ Bucket: this.bucket, Key }));

                                if (Expires && isExpired({ expiredAt: Expires } as TFile)) {
                                    await this.delete({ id: Key });
                                } else {
                                    items.push({
                                        id: Key,
                                        ...LastModified && { createdAt: LastModified },
                                    } as TFile);
                                }
                            }
                        }

                        truncated = response.IsTruncated || false;

                        if (truncated && response.NextContinuationToken) {
                            parameters = { ...parameters, ContinuationToken: response.NextContinuationToken };
                        }
                    } catch (error) {
                        truncated = false;

                        const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

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
     * Gets an uploaded file by ID.
     */
    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const s3Api = this.getS3Api();
            const { Body, ContentLength, ContentType, ETag, Expires, LastModified, Metadata } = await this.retry(() =>
                s3Api.getObject({
                    Bucket: this.bucket,
                    Key: id,
                }),
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

                    while (true) {
                        // eslint-disable-next-line no-await-in-loop
                        const { done, value } = await reader.read();

                        if (done) {
                            break;
                        }

                        chunks.push(value);
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
                name: id,
                originalName: originalName || id,
                size: Number(ContentLength),
            };
        });
    }

    /**
     * Gets file stream (abstract - must be implemented by subclasses due to stream differences).
     */
    public abstract override getStream(query: FileQuery): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }>;

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
            const [completed] = await this.internalOnComplete(file);

            delete fileWithParts.Parts;
            fileWithParts.uri = completed.Location;

            return file;
        }

        return file;
    }

    /**
     * Gets presigned URLs for all parts.
     */
    protected async getPartsPresignedUrls(file: TFile): Promise<string[]> {
        (file as TFile & { partSize?: number }).partSize ??= this.partSize;

        const partsNumber = Math.trunc((file.size as number) / this.partSize) + 1;
        const promises = [];
        const expiresIn = Math.trunc(toSeconds(this.config.expiration?.maxAge || "6hrs"));
        const s3Api = this.getS3Api();

        // eslint-disable-next-line no-plusplus
        for (let index = 0; index < partsNumber; index++) {
            promises.push(
                s3Api.getPresignedUrl({
                    Bucket: this.bucket,
                    expiresIn,
                    Key: file.name,
                    PartNumber: index + 1,
                    UploadId: file.UploadId!,
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

        const { Parts = [] } = await this.retry(() =>
            s3Api.listParts({
                Bucket: this.bucket,
                Key: file.name,
                UploadId: uploadId,
            }),
        );

        return Parts;
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

        const parts
            = file.Parts?.map(({ ETag, PartNumber }) => {
                if (!ETag || !PartNumber) {
                    throw new Error("ETag and PartNumber are required");
                }

                return { ETag, PartNumber };
            }) || [];

        return this.retry(() =>
            s3Api.completeMultipartUpload({
                Bucket: this.bucket,
                Key: file.name,
                Parts: parts,
                UploadId: uploadId,
            }),
        );
    }

    /**
     * Aborts a multipart upload.
     */
    protected async abortMultipartUpload(file: TFile): Promise<void> {
        if (file.status === "completed") {
            return;
        }

        try {
            const s3Api = this.getS3Api();
            const uploadId = file.UploadId;

            if (!uploadId) {
                return;
            }

            await this.retry(() =>
                s3Api.abortMultipartUpload({
                    Bucket: this.bucket,
                    Key: file.name,
                    UploadId: uploadId,
                }),
            );
        } catch (error) {
            this.logger?.error("abortMultipartUploadError: ", error);

            const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

            await this.onError(httpError);
        }
    }

    /**
     * Internal onComplete handler.
     */
    protected internalOnComplete = async (file: TFile): Promise<[{ ETag?: string; Location: string }, TFile]> => {
        const [completed] = await Promise.all([this.completeMultipartUpload(file), this.deleteMeta(file.id)]);

        return [completed, file];
    };
}
