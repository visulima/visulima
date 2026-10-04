import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import type { AwsClient } from "aws4fetch";

import { toHttpDate } from "../../utils/headers";
import type { HttpError } from "../../utils/types";
import { S3BaseStorage } from "../aws/s3-base-storage";
import { buildRangeHeader } from "../aws/s3-utils";
import type { OperationOptions } from "../types";
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
 * - Default retryable status codes: 408, 429, 500, 502, 503, 504 (`retryConfig.retryableStatusCodes`)
 * - A custom `shouldRetry` is consulted first; returning `undefined` defers to the defaults
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
 * - ✅ exists: Implemented (checks metadata and S3 object)
 * - ✅ clientDirectUpload: part URLs are SigV4 query-signed (aws4fetch `signQuery`)
 */
class AwsLightStorage extends S3BaseStorage {
    public static override readonly name: string = "aws-light";

    private s3Api: AwsLightApiAdapter;

    public constructor(config: AwsLightStorageOptions) {
        const { bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET, region } = config;

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

        // Pass the whole config on: the base storage reads allowMIME, maxUploadSize, the hooks,
        // validation, acl, … from it, and they were silently dropped by an explicit allowlist.
        super({
            ...config,
            bucket,
            metaStorageConfig: config.metaStorageConfig ? { ...config.metaStorageConfig, ...config } : { ...config },
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

        // Bucket-backed metadata unless a meta storage, or a local one (`directory`), was configured.
        const { metaStorage, metaStorageConfig } = config;

        if (!metaStorage) {
            const metaConfig = { ...config, ...metaStorageConfig, logger: this.logger };

            if (!("directory" in metaConfig)) {
                this.meta = new AwsLightMetaStorage(metaConfig);
            }
        }

        this.startAccessCheck(async () => this.accessCheck());
    }

    /**
     * Normalizes AWS S3 errors with S3-specific context.
     */
    public override normalizeError(error: AwsLightError | Error): HttpError {
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

    public override async getStream(
        { id }: FileQuery,
        options?: OperationOptions & { range?: { end?: number; start: number } },
    ): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        return this.instrumentOperation("getStream", async () => {
            const s3Api = this.getS3Api();
            const key = await this.readableName(id);
            const rangeHeader = buildRangeHeader(options?.range);
            const { Body, ContentLength, ContentType, ETag, Expires, LastModified } = await this.runOperation(options, (signal) =>
                s3Api.getObject(
                    {
                        Bucket: this.bucket,
                        Key: key,
                        ...(rangeHeader !== undefined && { Range: rangeHeader }),
                    },
                    { signal },
                ),
            );

            await this.checkIfExpired({ expiredAt: Expires } as AwsLightFile);

            // Returned as-is: a proxy that subscribed inside read() re-added its listeners on every
            // pull and pushed each chunk once per listener.
            const stream: Readable = Body instanceof ReadableStream ? Readable.fromWeb(Body as unknown as NodeReadableStream<Uint8Array>) : (Body as Readable);

            return {
                headers: {
                    "Content-Length": ContentLength?.toString() ?? "0",
                    "Content-Type": ContentType as string,
                    ...(ETag && { ETag }),
                    ...(Expires && { "X-Upload-Expires": Expires.toString() }),
                    ...(LastModified && { "Last-Modified": toHttpDate(LastModified) }),
                },
                size: Number(ContentLength),
                stream,
            };
        });
    }

    public override get raw(): AwsClient {
        return this.s3Api.aws;
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
