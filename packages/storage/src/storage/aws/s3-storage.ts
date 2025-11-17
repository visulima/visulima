import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";

import type {
    CompleteMultipartUploadOutput,
    CopyObjectCommandInput,
    CopyObjectCommandOutput,
    DeleteObjectCommandInput,
    ListObjectsV2CommandInput,
    ObjectCannedACL,
    Part,
    StorageClass,
} from "@aws-sdk/client-s3";
import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CopyObjectCommand,
    CreateMultipartUploadCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    ListPartsCommand,
    S3Client,
    UploadPartCommand,
    waitUntilBucketExists,
} from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-providers";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { HttpHandlerOptions, SdkStream } from "@aws-sdk/types";
import { parseBytes } from "@visulima/humanizer";

import { detectFileTypeFromStream } from "../../utils/detect-file-type";
import { ERRORS, throwErrorCode } from "../../utils/errors";
import mapValues from "../../utils/primitives/map-values";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import toSeconds from "../../utils/primitives/to-seconds";
import type { RetryConfig } from "../../utils/retry";
import { createRetryWrapper } from "../../utils/retry";
import type { HttpError } from "../../utils/types";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, isExpired, partMatch, updateSize } from "../utils/file";
import S3File from "./s3-file";
import S3MetaStorage from "./s3-meta-storage";
import type { AwsError, S3StorageOptions } from "./types";

const MIN_PART_SIZE = 5 * 1024 * 1024;
const PART_SIZE = 16 * 1024 * 1024;

/**
 * S3 storage based backend.
 * @example
 * ```ts
 * const storage = new S3Storage({
 *  bucket: <YOUR_BUCKET>,
 *  endpoint: <YOUR_ENDPOINT>,
 *  region: <YOUR_REGION>,
 *  credentials: {
 *    accessKeyId: <YOUR_ACCESS_KEY_ID>,
 *    secretAccessKey: <YOUR_SECRET_ACCESS_KEY>
 *  },
 *  metaStorageConfig: { directory: '/tmp/upload-metafiles' }
 * });
 * ```
 */
class S3Storage extends BaseStorage<S3File, FileReturn> {
    public static override readonly name: string = "s3";

    public override checksumTypes: string[] = ["md5", "crc32", "crc32c", "sha1", "sha256"];

    protected bucket: string;

    protected client: S3Client;

    protected meta: MetaStorage<S3File>;

    /**
     * S3 multipart upload does not allow more than 10000 parts.
     */
    private MAX_PARTS = 10_000;

    private readonly partSize = PART_SIZE;

    private readonly retry: ReturnType<typeof createRetryWrapper>;

    public constructor(config: S3StorageOptions) {
        super(config);

        const { bucket = process.env.S3_BUCKET, region = process.env.S3_REGION } = config;

        if (!bucket) {
            throw new Error("S3 bucket is not defined");
        }

        this.bucket = bucket;

        if (!region) {
            throw new Error("S3 region is not defined");
        }

        // eslint-disable-next-line no-param-reassign
        config.region = region;

        const keyFile = config.keyFile || process.env.S3_KEYFILE;

        if (keyFile) {
            // eslint-disable-next-line no-param-reassign
            config.credentials = fromIni({ configFilepath: keyFile });
        }

        this.partSize = typeof this.config.partSize === "string" ? parseBytes(this.config.partSize) : (this.config.partSize as number | undefined) || PART_SIZE;

        if (this.partSize < MIN_PART_SIZE) {
            throw new Error("Minimum allowed partSize value is 5MB");
        }

        if (this.config.clientDirectUpload) {
            this.onCreate = async (file) => {
                return { body: file };
            }; // TODO: remove hook
        }

        this.client = new S3Client(config);

        // Initialize retry wrapper with config or defaults
        const retryConfig: RetryConfig = {
            backoffMultiplier: 2,
            initialDelay: 1000,
            maxDelay: 30_000,
            maxRetries: 3,
            retryableStatusCodes: [408, 429, 500, 502, 503, 504],
            shouldRetry: (error: unknown) => {
                // AWS SDK v3 errors
                const errorWithMetadata = error as { $fault?: string; $metadata?: { httpStatusCode?: number }; retryable?: boolean };

                if (errorWithMetadata.$metadata) {
                    const statusCode = errorWithMetadata.$metadata.httpStatusCode;

                    if (statusCode && [408, 429, 500, 502, 503, 504].includes(statusCode)) {
                        return true;
                    }

                    if (errorWithMetadata.$fault === "server") {
                        return true;
                    }
                }

                return errorWithMetadata.retryable;
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
                this.meta = new LocalMetaStorage<S3File>(metaConfig);
            } else {
                this.meta = new S3MetaStorage<S3File>(metaConfig);
            }
        }

        this.isReady = false;
        this.accessCheck()
            .then(() => {
                this.isReady = true;
            })
            .catch((error) => this.logger?.error("Storage access check failed: %O", error));
    }

    public override normalizeError(error: AwsError): HttpError {
        if (error.$metadata) {
            return {
                code: error.Code || error.name,
                message: error.message,
                name: error.name,
                statusCode: error.$metadata.httpStatusCode || 500,
            };
        }

        return super.normalizeError(error);
    }

    public async create(config: FileInit): Promise<S3File> {
        return this.instrumentOperation("create", async () => {
            // Handle TTL option
            const processedConfig = { ...config };

            if (config.ttl) {
                const ttlMs = typeof config.ttl === "string" ? toMilliseconds(config.ttl) : config.ttl;

                if (ttlMs !== undefined) {
                    processedConfig.expiredAt = Date.now() + ttlMs;
                }
            }

            const file = new S3File(processedConfig);

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

            const { UploadId } = await this.retry(() =>
                this.client.send(
                    new CreateMultipartUploadCommand({
                        ACL: this.config.acl as ObjectCannedACL | undefined,
                        Bucket: this.bucket,
                        ContentType: file.contentType,
                        Key: file.name,
                        Metadata: mapValues({ originalName: file.originalName, ...file.metadata } as Record<string, unknown>, (value) =>
                            encodeURI(String(value))),
                    }),
                ),
            );

            if (!UploadId) {
                // @TODO add better error message
                return throwErrorCode(ERRORS.FILE_ERROR, "s3 create upload error");
            }

            file.UploadId = UploadId;
            file.bytesWritten = 0;

            if (this.config.clientDirectUpload) {
                file.partSize ??= this.partSize;
            }

            await this.saveMeta(file);

            file.status = "created";

            if (this.config.clientDirectUpload) {
                return this.buildPresigned(file);
            }

            return file;
        });
    }

    public async write(part: FilePart | FileQuery | S3File): Promise<S3File> {
        return this.instrumentOperation("write", async () => {
            let file: S3File;

            if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                // part is a full file object (not a FilePart)
                file = part as S3File;
            } else {
                // part is FilePart or FileQuery
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
                    // Only detect on first write (when bytesWritten is 0 or NaN, and it's the first part)
                    if (file.Parts.length === 0 && (!file.contentType || file.contentType === "application/octet-stream")) {
                        try {
                            const { fileType, stream: detectedStream } = await detectFileTypeFromStream(part.body);

                            // Update contentType if file type was detected
                            if (fileType?.mime) {
                                file.contentType = fileType.mime;
                            }

                            // Use the stream from file type detection
                            part.body = detectedStream;
                        } catch {
                            // If file type detection fails, continue with original stream
                            // This is not a critical error
                        }
                    }

                    if (file.Parts.length > this.MAX_PARTS) {
                        throw new Error(`Exceeded ${this.MAX_PARTS} as part of the upload to ${this.bucket}.`);
                    }

                    const partNumber = file.Parts.length + 1;

                    const controller = new AbortController();
                    const abortSignal = controller.signal;

                    part.body.on("error", () => controller.abort());

                    const { ETag } = await this.retry(() =>
                        this.client.send(
                            new UploadPartCommand({
                                Body: part.body,
                                Bucket: this.bucket,
                                ContentLength: part.contentLength || 0,
                                Key: file.name,
                                PartNumber: partNumber,
                                UploadId: file.UploadId,
                                ...part.checksumAlgorithm === "md5" ? { ContentMD5: part.checksum } : {},
                            }),
                            { abortSignal } as HttpHandlerOptions,
                        ),
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
     * Deletes an upload and its metadata
     * @param query - File query containing the file ID to delete
     * @returns Promise resolving to the deleted file object with status: "deleted"
     * @throws {Error} If the file metadata cannot be found
     */
    public async delete({ id }: FileQuery): Promise<S3File> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);

            file.status = "deleted";

            await Promise.all([this.deleteMeta(file.id), this.retry(() => this.abortMultipartUpload(file))]);

            return { ...file };
        });
    }

    public override async update({ id }: FileQuery, metadata: Partial<S3File>): Promise<S3File> {
        if (this.config.clientDirectUpload) {
            const file = await this.getMeta(id);

            return this.buildPresigned({ ...file, ...metadata });
        }

        return super.update({ id }, metadata);
    }

    /**
     * Copy an upload file to a new location
     * @param name - Source file name/ID
     * @param destination - Destination file name/ID
     * @param options - Optional copy options including storage class
     * @returns Promise resolving to the copied file object
     * @throws {Error} If the source file cannot be found
     */
    public async copy(name: string, destination: string, options?: { storageClass?: string }): Promise<S3File> {
        return this.instrumentOperation("copy", async () => {
            const sourceFile = await this.getMeta(name);
            const CopySource = `${this.bucket}/${name}`;

            // Handle absolute vs relative destination paths
            let Bucket = this.bucket;
            let Key = destination;

            if (destination.startsWith("/")) {
                // Absolute path: /otherBucket/new name -> copy to otherBucket
                const [, bucketName, ...pathSegments] = destination.split("/");

                Bucket = bucketName || this.bucket;
                Key = pathSegments.join("/");
            }

            const parameters: CopyObjectCommandInput = {
                Bucket,
                CopySource,
                Key,
                ...options?.storageClass && { StorageClass: options.storageClass as StorageClass },
            };

            await this.retry(() => this.client.send(new CopyObjectCommand(parameters)));

            // Return copied file with destination name (use Key for the actual destination name)
            return { ...sourceFile, name: Key, id: Key } as S3File;
        });
    }

    /**
     * Move an upload file to a new location
     * @param name - Source file name/ID
     * @param destination - Destination file name/ID
     * @returns Promise resolving to the moved file object
     * @throws {Error} If the source file cannot be found
     */
    public async move(name: string, destination: string): Promise<S3File> {
        return this.instrumentOperation("move", async () => {
            await this.copy(name, destination);
            const parameters: DeleteObjectCommandInput = { Bucket: this.bucket, Key: name };

            await this.retry(() => this.client.send(new DeleteObjectCommand(parameters)));

            // Return the moved file metadata (destination)
            return await this.getMeta(destination);
        });
    }

    public override async list(limit = 1000): Promise<S3File[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                let parameters: ListObjectsV2CommandInput = {
                    Bucket: this.bucket,
                    MaxKeys: limit,
                };
                const items: S3File[] = [];

                // Declare truncated as a flag that the while loop is based on.
                let truncated = true;

                while (truncated) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        const response = await this.retry(() => this.client.send(new ListObjectsV2Command(parameters)));

                        // eslint-disable-next-line no-await-in-loop
                        for await (const { Key, LastModified } of response?.Contents || []) {
                            if (Key !== undefined) {
                                const { Expires } = await this.retry(() => this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key })));

                                if (Expires && isExpired({ expiredAt: Expires } as S3File)) {
                                    await this.delete({ id: Key });
                                } else {
                                    items.push({
                                        id: Key,
                                        ...LastModified && { createdAt: LastModified },
                                    } as S3File);
                                }
                            }
                        }

                        truncated = response.IsTruncated || false;

                        if (truncated) {
                            // Declare a variable to which the key of the last element is assigned to in the response.
                            parameters = { ...parameters, ContinuationToken: response.NextContinuationToken };
                        }
                    } catch (error) {
                        truncated = false;

                        throw error;
                    }
                }

                return items;
            },
            { limit },
        );
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const parameters = {
                Bucket: this.bucket,
                Key: id,
            };
            const { Body, ContentLength, ContentType, ETag, Expires, LastModified, Metadata } = await this.retry(() =>
                this.client.send(new GetObjectCommand(parameters)),
            );

            await this.checkIfExpired({ expiredAt: Expires } as S3File);

            const chunks: Uint8Array[] = [];

            if (Body) {
                // Convert SdkStream to Readable and collect chunks
                const readable = Readable.fromWeb(Body as ReadableStream<Uint8Array>);

                for await (const chunk of readable) {
                    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
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

    public override async getStream({ id }: FileQuery): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        return this.instrumentOperation("getStream", async () => {
            const parameters = {
                Bucket: this.bucket,
                Key: id,
            };

            const { Body, ContentLength, ContentType, ETag, Expires, LastModified } = await this.retry(() =>
                this.client.send(new GetObjectCommand(parameters)),
            );

            await this.checkIfExpired({ expiredAt: Expires } as S3File);

            // Convert S3 stream to Node.js Readable stream
            const stream = Body as SdkStream<Uint8Array>;
            const readableStream = new Readable({
                read() {
                    stream.on("data", (chunk: Buffer) => {
                        this.push(chunk);
                    });
                    stream.on("end", () => {
                        // eslint-disable-next-line unicorn/no-null
                        this.push(null);
                    });
                    stream.on("error", (error: Error) => {
                        this.destroy(error);
                    });
                },
            });

            return {
                headers: {
                    "Content-Length": ContentLength?.toString() ?? "0",
                    "Content-Type": ContentType as string,
                    ...ETag && { ETag },
                    ...Expires && { "X-Upload-Expires": Expires.toString() },
                    ...LastModified && { "Last-Modified": LastModified.toString() },
                },
                size: Number(ContentLength),
                stream: readableStream,
            };
        });
    }

    private async accessCheck(maxWaitTime = 30): Promise<void> {
        await waitUntilBucketExists({ client: this.client, maxWaitTime }, { Bucket: this.bucket });
    }

    private async buildPresigned(file: S3File): Promise<S3File> {
        if (!file.Parts?.length) {
            // eslint-disable-next-line no-param-reassign
            file.Parts = await this.getParts(file);
        }

        // eslint-disable-next-line no-param-reassign
        file.bytesWritten = Math.min(file.Parts.length * this.partSize, file.size as number);
        // eslint-disable-next-line no-param-reassign
        file.status = getFileStatus(file);

        // Generate presigned URLs for client uploads, even for completed files
        if (!file.partsUrls?.length) {
            // eslint-disable-next-line no-param-reassign
            file.partsUrls = await this.getPartsPresignedUrls(file);
        }

        if (file.status === "completed") {
            const [completed] = await this.internalOnComplete(file);

            // eslint-disable-next-line no-param-reassign
            delete file.Parts;
            // eslint-disable-next-line no-param-reassign
            file.uri = completed.Location;

            return file;
        }

        return file;
    }

    private async getPartsPresignedUrls(file: S3File): Promise<string[]> {
        // eslint-disable-next-line no-param-reassign
        file.partSize ??= this.partSize;

        const partsNumber = Math.trunc((file.size as number) / this.partSize) + 1;
        const promises = [];
        const expiresIn = Math.trunc(toSeconds(this.config.expiration?.maxAge || "6hrs"));

        // eslint-disable-next-line no-plusplus
        for (let index = 0; index < partsNumber; index++) {
            const partCommandInput = {
                Bucket: this.bucket,
                Key: file.name,
                PartNumber: index + 1,
                UploadId: file.UploadId,
            };

            promises.push(getSignedUrl(this.client, new UploadPartCommand(partCommandInput), { expiresIn }));
        }

        return Promise.all(promises);
    }

    private async getParts(file: S3File): Promise<Part[]> {
        const parameters = { Bucket: this.bucket, Key: file.name, UploadId: file.UploadId };
        const { Parts = [] } = await this.retry(() => this.client.send(new ListPartsCommand(parameters)));

        return Parts;
    }

    private completeMultipartUpload(file: S3File): Promise<CompleteMultipartUploadOutput> {
        return this.retry(() =>
            this.client.send(
                new CompleteMultipartUploadCommand({
                    Bucket: this.bucket,
                    Key: file.name,
                    MultipartUpload: {
                        Parts: file.Parts?.map(({ ETag, PartNumber }) => {
                            return { ETag, PartNumber };
                        }),
                    },
                    UploadId: file.UploadId,
                }),
            ),
        );
    }

    private async abortMultipartUpload(file: S3File): Promise<void> {
        if (file.status === "completed") {
            return;
        }

        try {
            const parameters = { Bucket: this.bucket, Key: file.name, UploadId: file.UploadId };

            await this.retry(() => this.client.send(new AbortMultipartUploadCommand(parameters)));
        } catch (error) {
            this.logger?.error("abortMultipartUploadError: ", error);
        }
    }

    private internalOnComplete = (file: S3File): Promise<[CompleteMultipartUploadOutput, S3File]> =>
        Promise.all([this.completeMultipartUpload(file), this.deleteMeta(file.id)]);
}

export default S3Storage;
