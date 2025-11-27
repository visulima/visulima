import { Readable } from "node:stream";

import { S3BaseStorage } from "../aws/s3-base-storage";
import type { FileInit, FileQuery } from "../utils/file";
import AwsLightApiAdapter from "./aws-light-api-adapter";
import AwsLightFile from "./aws-light-file";
import AwsLightMetaStorage from "./aws-light-meta-storage";
import type { AwsLightError, AwsLightStorageOptions } from "./types";

/**
 * AWS Light storage implementation using aws4fetch.
 * Optimized for worker environments (Cloudflare Workers, Web Workers, etc.).
 * @example
 * ```ts
 * const storage = new AwsLightStorage({
 *  bucket: <YOUR_BUCKET>,
 *  region: <YOUR_REGION>,
 *  accessKeyId: <YOUR_ACCESS_KEY_ID>,
 *  secretAccessKey: <YOUR_SECRET_ACCESS_KEY>
 * });
 * ```
 * @remarks
 * ## Worker Compatibility
 * - Uses aws4fetch for AWS request signing (works in workers)
 * - No Node.js-specific dependencies
 * - Compatible with Cloudflare Workers, Web Workers, and edge runtimes
 *
 * ## Error Handling
 * - S3 API errors are normalized with AWS-specific context
 * - Errors include S3 error codes and status codes for debugging
 *
 * ## Retry Behavior
 * - All S3 API calls are wrapped with configurable retry logic via `retryConfig` option
 * - Default retryable status codes: 408, 429, 500, 502, 503, 504
 * - Custom `shouldRetry` function can be provided for advanced retry logic
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
 * - ⚠️ getUrl/getUploadUrl: Limited presigned URL support (uses aws4fetch signing)
 */
class AwsLightStorage extends S3BaseStorage<AwsLightFile> {
    public static override readonly name: string = "aws-light";

    private s3Api: AwsLightApiAdapter;

    public constructor(config: AwsLightStorageOptions) {
        const { bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET, region = process.env.S3_REGION || process.env.AWS_REGION } = config;

        if (!bucket) {
            throw new Error("S3 bucket is not defined");
        }

        if (!region) {
            throw new Error("S3 region is not defined");
        }

        if (!config.accessKeyId) {
            throw new Error("accessKeyId is required");
        }

        if (!config.secretAccessKey) {
            throw new Error("secretAccessKey is required");
        }

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
                    const errorWithStatus = error as { retryable?: boolean; statusCode?: number };

                    if (errorWithStatus.statusCode && [408, 429, 500, 502, 503, 504].includes(errorWithStatus.statusCode)) {
                        return true;
                    }

                    return errorWithStatus.retryable ?? false;
                },
            },
        });

        this.s3Api = new AwsLightApiAdapter({
            accessKeyId: config.accessKeyId,
            bucket,
            endpoint: config.endpoint,
            region,
            secretAccessKey: config.secretAccessKey,
            service: config.service,
            sessionToken: config.sessionToken,
        });

        // Override meta storage to use AwsLightMetaStorage
        const { metaStorage, metaStorageConfig } = config;

        if (!metaStorage) {
            const metaConfig = { ...config, ...metaStorageConfig, logger: this.logger };

            this.meta = new AwsLightMetaStorage<AwsLightFile>(metaConfig);
        }
    }

    /**
     * Normalizes AWS S3 errors with S3-specific context.
     */
    public override normalizeError(error: AwsLightError | Error): import("../../utils/types").HttpError {
        const awsError = error as AwsLightError;

        if (awsError.statusCode || awsError.code) {
            return {
                code: awsError.code || awsError.name,
                message: awsError.message,
                name: awsError.name,
                statusCode: awsError.statusCode || 500,
            };
        }

        return super.normalizeError(error);
    }

    public override async update({ id }: FileQuery, metadata: Partial<AwsLightFile>): Promise<AwsLightFile> {
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

            await this.checkIfExpired({ expiredAt: Expires } as AwsLightFile);

            // Body from adapter is ReadableStream, convert to Readable
            const stream: Readable
                = Body instanceof ReadableStream ? Readable.fromWeb(Body as unknown as import("node:stream/web").ReadableStream<Uint8Array>) : (Body as Readable);

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

    protected getS3Api(): AwsLightApiAdapter {
        return this.s3Api;
    }

    // eslint-disable-next-line class-methods-use-this
    protected getFileClass(): new (config: FileInit) => AwsLightFile {
        return AwsLightFile;
    }

    // eslint-disable-next-line class-methods-use-this
    protected getAcl(): string | undefined {
        // aws-light doesn't support ACL in the same way, return undefined
        return undefined;
    }

    protected async accessCheck(_maxWaitTime = 30): Promise<void> {
        await this.s3Api.checkBucketAccess({ Bucket: this.bucket });
    }
}

export default AwsLightStorage;
