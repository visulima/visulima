// eslint-disable-next-line import/no-extraneous-dependencies
import type {
    CompleteMultipartUploadOutput,
    CopyObjectCommandInput,
    CopyObjectCommandOutput,
    DeleteObjectCommandInput,
    ListObjectsV2CommandInput,
    Part,
} from "@aws-sdk/client-s3";
// eslint-disable-next-line import/no-extraneous-dependencies
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
// eslint-disable-next-line import/no-extraneous-dependencies
import { fromIni } from "@aws-sdk/credential-providers";
// eslint-disable-next-line import/no-extraneous-dependencies
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// eslint-disable-next-line import/no-extraneous-dependencies
import type { HttpHandlerOptions, SdkStream } from "@aws-sdk/types";
import { parse } from "bytes";
import type { IncomingMessage } from "node:http";
import { resolve } from "node:path";

import type { HttpError } from "../../utils";
import { ERRORS, mapValues, throwErrorCode, toSeconds } from "../../utils";
import LocalMetaStorage from "../local/local-meta-storage";
import MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type { FileInit, FilePart, FileQuery } from "../utils/file";
import { getFileStatus, hasContent, isExpired, partMatch, updateSize } from "../utils/file";
import S3File from "./s3-file";
import S3MetaStorage from "./s3-meta-storage";
import type { AwsError, S3StorageOptions } from "./types.d";

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
class S3Storage extends BaseStorage<S3File> {
    /**
     * S3 multipart upload does not allow more than 10000 parts.
     */
    private MAX_PARTS = 10000;

    protected bucket: string;

    protected client: S3Client;

    protected meta: MetaStorage<S3File>;

    public checksumTypes = ["md5"];

    private readonly partSize = PART_SIZE;

    constructor(public config: S3StorageOptions) {
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

        this.partSize = parse(this.config.partSize || PART_SIZE);

        if (this.partSize < MIN_PART_SIZE) {
            throw new Error("Minimum allowed partSize value is 5MB");
        }

        if (this.config.clientDirectUpload) {
            this.onCreate = async (file) => {
                return { body: file };
            }; // TODO: remove hook
        }

        this.client = new S3Client(config);

        if (config.metaStorage) {
            this.meta = config.metaStorage;
        } else {
            const metaConfig = { ...config, ...config.metaStorageConfig, logger: this.logger };
            const localMeta = "directory" in metaConfig;

            if (localMeta) {
                this.logger?.debug("Using local meta storage");
                this.meta = new LocalMetaStorage<S3File>(metaConfig);
            } else {
                this.meta = new S3MetaStorage<S3File>(metaConfig);
            }
        }

        this.accessCheck().catch((error: AwsError) => {
            this.isReady = false;

            throw error;
        });
    }

    public normalizeError(error: AwsError): HttpError {
        if (error.$metadata) {
            return {
                message: error.message,
                code: error.Code || error.name,
                statusCode: error.$metadata.httpStatusCode || 500,
                name: error.name,
            };
        }

        return super.normalizeError(error);
    }

    public async create(request: IncomingMessage, config: FileInit): Promise<S3File> {
        const file = new S3File(config);

        file.name = this.namingFunction(file, request);

        await this.validate(file);

        try {
            const existing = await this.getMeta(file.id);

            if (existing.bytesWritten >= 0) {
                return existing;
            }
        } catch {
            // ignore
        }

        const { UploadId } = await this.client.send(
            new CreateMultipartUploadCommand({
                Bucket: this.bucket,
                Key: file.name,
                ContentType: file.contentType,
                Metadata: mapValues({ originalName: file.originalName, ...file.metadata }, encodeURI),
                ACL: this.config.acl,
            }),
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
    }

    public async write(part: FilePart | FileQuery): Promise<S3File> {
        const file = await this.getMeta(part.id);

        await this.checkIfExpired(file);

        if (file.status === "completed") {
            return file;
        }

        if (typeof part.size === "number" && part.size > 0) {
            updateSize(file, part.size as number);
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

                if (file.Parts.length > this.MAX_PARTS) {
                    throw new Error(`Exceeded ${this.MAX_PARTS} as part of the upload to ${this.bucket}.`);
                }

                const checksumMD5 = part.checksumAlgorithm === "md5" ? part.checksum : "";
                const partNumber = file.Parts.length + 1;

                const controller = new AbortController();
                const abortSignal = controller.signal;

                part.body.on("error", () => controller.abort());

                const { ETag } = await this.client.send(
                    new UploadPartCommand({
                        Bucket: this.bucket,
                        Key: file.name,
                        UploadId: file.UploadId,
                        PartNumber: partNumber,
                        Body: part.body,
                        ContentLength: part.contentLength || 0,
                        ContentMD5: checksumMD5,
                    }),
                    { abortSignal } as HttpHandlerOptions,
                );
                const uploadPart: Part = { PartNumber: partNumber, Size: part.contentLength, ETag };

                file.Parts = [...file.Parts, uploadPart];
                file.bytesWritten += part.contentLength || 0;
            }

            this.cache.set(file.id, file, {
                size: Object.keys(file).length,
            });

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
    }

    public async delete({ id }: FileQuery): Promise<S3File> {
        const file = await this.getMeta(id).catch(() => null);

        if (file) {
            file.status = "deleted";

            await Promise.all([this.deleteMeta(file.id), this.abortMultipartUpload(file)]);

            return { ...file };
        }

        return { id } as S3File;
    }

    public async update({ id }: FileQuery, metadata: Partial<S3File>): Promise<S3File> {
        if (this.config.clientDirectUpload) {
            const file = await this.getMeta(id);

            return this.buildPresigned({ ...file, ...metadata });
        }

        return super.update({ id }, metadata);
    }

    public async copy(name: string, destination: string): Promise<CopyObjectCommandOutput> {
        const CopySource = `${this.bucket}/${name}`;
        const newPath = decodeURI(resolve(`/${CopySource}`, destination));
        const [, Bucket, ...pathSegments] = newPath.split("/");
        const Key = pathSegments.join("/");
        const parameters: CopyObjectCommandInput = { Bucket, Key, CopySource };

        return this.client.send(new CopyObjectCommand(parameters));
    }

    public async move(name: string, destination: string): Promise<CopyObjectCommandOutput> {
        const copyOut = await this.copy(name, destination);
        const parameters: DeleteObjectCommandInput = { Bucket: this.bucket, Key: name };

        await this.client.send(new DeleteObjectCommand(parameters));

        return copyOut;
    }

    // eslint-disable-next-line radar/cognitive-complexity
    public async list(limit: number = 1000): Promise<S3File[]> {
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
                const response = await this.client.send(new ListObjectsV2Command(parameters));

                // eslint-disable-next-line no-restricted-syntax,no-await-in-loop
                for await (const { Key, LastModified } of response?.Contents || []) {
                    if (Key !== undefined) {
                        const { Expires } = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key }));

                        if (Expires && isExpired({ expiredAt: Expires } as S3File)) {
                            await this.delete({ id: Key });
                        } else {
                            items.push({
                                id: Key,
                                ...(LastModified && { createdAt: LastModified }),
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
    }

    public async get({ id }: FileQuery): Promise<S3File> {
        const parameters = {
            Bucket: this.bucket,
            Key: id,
        };
        const { Body, Metadata, ContentType, LastModified, Expires, ContentLength, ETag } = await this.client.send(new GetObjectCommand(parameters));

        const chunks = [];

        // eslint-disable-next-line no-restricted-syntax
        for await (const chunk of Body as SdkStream<any>) {
            chunks.push(chunk);
        }

        const { originalName, ...meta } = Metadata || {};

        return {
            id,
            name: id,
            originalName,
            contentType: ContentType,
            size: ContentLength,
            metadata: meta,
            content: Buffer.concat(chunks),
            expiredAt: Expires,
            modifiedAt: LastModified,
            ETag,
        } as S3File;
    }

    private async accessCheck(maxWaitTime = 30): Promise<any> {
        return waitUntilBucketExists({ client: this.client, maxWaitTime }, { Bucket: this.bucket });
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

        if (file.status === "completed") {
            const [completed] = await this.internalOnComplete(file);

            // eslint-disable-next-line no-param-reassign
            delete file.Parts;
            // eslint-disable-next-line no-param-reassign
            delete file.partsUrls;
            // eslint-disable-next-line no-param-reassign
            file.uri = completed.Location;

            return file;
        }

        if (!file.partsUrls?.length) {
            // eslint-disable-next-line no-param-reassign
            file.partsUrls = await this.getPartsPresignedUrls(file);
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
                UploadId: file.UploadId,
                PartNumber: index + 1,
            };

            promises.push(getSignedUrl(this.client, new UploadPartCommand(partCommandInput), { expiresIn }));
        }

        // eslint-disable-next-line compat/compat
        return Promise.all(promises);
    }

    private async getParts(file: S3File): Promise<Part[]> {
        const parameters = { Bucket: this.bucket, Key: file.name, UploadId: file.UploadId };
        const { Parts = [] } = await this.client.send(new ListPartsCommand(parameters));

        return Parts;
    }

    private completeMultipartUpload(file: S3File): Promise<CompleteMultipartUploadOutput> {
        return this.client.send(
            new CompleteMultipartUploadCommand({
                Bucket: this.bucket,
                Key: file.name,
                UploadId: file.UploadId,
                MultipartUpload: {
                    Parts: file.Parts?.map(({ ETag, PartNumber }) => {
                        return { ETag, PartNumber };
                    }),
                },
            }),
        );
    }

    private async abortMultipartUpload(file: S3File): Promise<any> {
        if (file.status === "completed") {
            return;
        }

        try {
            const parameters = { Bucket: this.bucket, Key: file.name, UploadId: file.UploadId };

            await this.client.send(new AbortMultipartUploadCommand(parameters));
        } catch (error) {
            this.logger?.error("abortMultipartUploadError: ", error);
        }
    }

    // eslint-disable-next-line compat/compat,max-len
    private internalOnComplete = (file: S3File): Promise<[CompleteMultipartUploadOutput, any]> =>
        Promise.all([this.completeMultipartUpload(file), this.deleteMeta(file.id)]);
}

export default S3Storage;
