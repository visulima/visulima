import { Readable } from "node:stream";

import { S3Client as S3ClientConstructor } from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-providers";

import type { HttpError } from "../../utils/types";
import type { FileInit, FileQuery } from "../utils/file";
import { S3BaseStorage } from "./s3-base-storage";
import S3ClientAdapter from "./s3-client-adapter";
import S3File from "./s3-file";
import S3MetaStorage from "./s3-meta-storage";
import type { AwsError, S3StorageOptions } from "./types";

/**
 * Amazon S3 storage implementation.
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
 * @remarks
 * ## Error Handling
 * - S3 API errors are normalized with AWS-specific context
 * - Errors include S3 error codes and metadata for debugging
 * - Batch operations handle individual failures gracefully
 *
 * ## Retry Behavior
 * - All S3 API calls are wrapped with configurable retry logic via `retryConfig` option
 * - Default retryable status codes: 408 (Request Timeout), 429 (Too Many Requests),
 * 500 (Internal Server Error), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)
 * - Retries server-side faults ($fault === "server") automatically
 * - Custom `shouldRetry` function can be provided for advanced retry logic
 * - Default retry configuration: maxRetries: 3, initialDelay: 1000ms, maxDelay: 30000ms, backoffMultiplier: 2 (exponential backoff)
 * - Retry wrapper handles transient network errors and rate limiting
 *
 * ## Multipart Uploads
 * - Large files are automatically split into multipart uploads
 * - Maximum 10,000 parts per upload (S3 limitation)
 * - Part size is configurable (default: 16MB, minimum: 5MB)
 * - Failed multipart uploads are automatically aborted
 *
 * ## Supported Operations
 * - ✅ create, write, delete, get, getStream, list, update, copy, move
 * - ✅ Batch operations: deleteBatch, copyBatch, moveBatch (inherited from BaseStorage)
 * - ❌ exists: Not implemented (use get() and catch FILE_NOT_FOUND error)
 * - ❌ getUrl: Not implemented (presigned URLs available via buildPresigned for clientDirectUpload)
 * - ❌ getUploadUrl: Not implemented (presigned URLs available via buildPresigned for clientDirectUpload)
 */
class S3Storage extends S3BaseStorage<S3File> {
    public static override readonly name: string = "s3";

    private s3Api: S3ClientAdapter;

    public constructor(config: S3StorageOptions) {
        const { bucket = process.env.S3_BUCKET, region = process.env.S3_REGION } = config;

        if (!bucket) {
            throw new Error("S3 bucket is not defined");
        }

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

        // Initialize client before calling super
        const client = new S3ClientConstructor(config);

        super({
            bucket,
            clientDirectUpload: config.clientDirectUpload,
            expiration: config.expiration?.maxAge ? { maxAge: String(config.expiration.maxAge) } : undefined,
            filename: config.filename,
            logger: config.logger,
            metaStorage: config.metaStorage,
            metaStorageConfig: config.metaStorageConfig ? { ...config.metaStorageConfig, ...config } : { ...config },
            partSize: config.partSize,
            retryConfig: {
                ...config.retryConfig,
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

                    return errorWithMetadata.retryable ?? false;
                },
            },
        });

        this.s3Api = new S3ClientAdapter(client, bucket);

        // Override meta storage to use S3MetaStorage if not local
        const { metaStorage, metaStorageConfig } = config;

        if (!metaStorage) {
            const metaConfig = { ...config, ...metaStorageConfig, logger: this.logger };
            const localMeta = "directory" in metaConfig;

            if (!localMeta) {
                this.meta = new S3MetaStorage<S3File>(metaConfig);
            }
        }

        if (this.config.clientDirectUpload) {
            this.onCreate = async () => {}; // TODO: remove hook
        }
    }

    /**
     * Normalizes AWS S3 errors with S3-specific context.
     */
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

    public override async update({ id }: FileQuery, metadata: Partial<S3File>): Promise<S3File> {
        if (this.config.clientDirectUpload) {
            const file = await this.getMeta(id);

            return this.buildPresigned({ ...file, ...metadata });
        }

        return super.update({ id }, metadata);
    }

    public override async getStream({ id }: FileQuery): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        return this.instrumentOperation("getStream", async () => {
            const s3Api = this.getS3Api();
            const { Body, ContentLength, ContentType, ETag, Expires, LastModified } = await this.retry(() =>
                s3Api.getObject({
                    Bucket: this.bucket,
                    Key: id,
                }),
            );

            await this.checkIfExpired({ expiredAt: Expires } as S3File);

            // Body from adapter is already Readable
            const stream = Body as Readable;
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

    protected getS3Api(): S3ClientAdapter {
        return this.s3Api;
    }

    // eslint-disable-next-line class-methods-use-this
    protected getFileClass(): new (config: FileInit) => S3File {
        return S3File;
    }

    protected getAcl(): string | undefined {
        return this.config.acl as string | undefined;
    }

    protected async accessCheck(_maxWaitTime = 30): Promise<void> {
        await this.s3Api.checkBucketAccess({ Bucket: this.bucket });
    }
}

export default S3Storage;
