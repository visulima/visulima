import { Readable } from "node:stream";
import { ReadableStream as NodeReadableStream } from "node:stream/web";

import type {
    CompleteMultipartUploadOutput,
    CopyObjectCommandInput,
    GetObjectCommandOutput,
    HeadObjectCommandOutput,
    ListObjectsV2CommandOutput,
    ListPartsCommandOutput,
    ObjectCannedACL,
    S3Client,
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
    UploadPartCommand,
    waitUntilBucketExists,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { Part, S3ApiOperations } from "./s3-base-storage";

// Use global ReadableStream type for interface compatibility
type ReadableStream = globalThis.ReadableStream;

/**
 * Adapter that wraps AWS SDK S3Client to implement S3ApiOperations interface.
 */
class S3ClientAdapter implements S3ApiOperations {
    public constructor(
        private readonly client: S3Client,

        _bucket: string,
    ) {
        // Bucket is stored for potential future use in getSignedUrl calls
    }

    public async createMultipartUpload(params: {
        ACL?: string;
        Bucket: string;
        ContentType?: string;
        Key: string;
        Metadata?: Record<string, string>;
    }): Promise<{ UploadId: string }> {
        const command = new CreateMultipartUploadCommand({
            ACL: params.ACL as ObjectCannedACL | undefined,
            Bucket: params.Bucket,
            ContentType: params.ContentType,
            Key: params.Key,
            Metadata: params.Metadata,
        });

        const response = await this.client.send(command);

        if (!response.UploadId) {
            throw new Error("Failed to create multipart upload");
        }

        return { UploadId: response.UploadId };
    }

    public async uploadPart(params: {
        Body: Readable | ReadableStream | Uint8Array;
        Bucket: string;
        ContentLength?: number;
        ContentMD5?: string;
        Key: string;
        PartNumber: number;
        UploadId: string;
    }): Promise<{ ETag: string }> {
        // Convert ReadableStream to Readable if needed
        const body: Readable | Uint8Array
            = params.Body instanceof NodeReadableStream
                ? Readable.fromWeb(params.Body as unknown as NodeReadableStream<Uint8Array>)
                : (params.Body as Readable | Uint8Array);

        const command = new UploadPartCommand({
            Body: body,
            Bucket: params.Bucket,
            ContentLength: params.ContentLength,
            ContentMD5: params.ContentMD5,
            Key: params.Key,
            PartNumber: params.PartNumber,
            UploadId: params.UploadId,
        });

        const response = await this.client.send(command);

        if (!response.ETag) {
            throw new Error("Failed to upload part");
        }

        return { ETag: response.ETag };
    }

    public async completeMultipartUpload(params: {
        Bucket: string;
        Key: string;
        Parts: { ETag: string; PartNumber: number }[];
        UploadId: string;
    }): Promise<{ ETag?: string; Location: string }> {
        const command = new CompleteMultipartUploadCommand({
            Bucket: params.Bucket,
            Key: params.Key,
            MultipartUpload: {
                Parts: params.Parts.map(({ ETag, PartNumber }) => {
                    return { ETag, PartNumber };
                }),
            },
            UploadId: params.UploadId,
        });

        const response: CompleteMultipartUploadOutput = await this.client.send(command);

        if (!response.Location) {
            throw new Error("Failed to complete multipart upload");
        }

        return {
            ETag: response.ETag,
            Location: response.Location,
        };
    }

    public async abortMultipartUpload(params: { Bucket: string; Key: string; UploadId: string }): Promise<void> {
        const command = new AbortMultipartUploadCommand({
            Bucket: params.Bucket,
            Key: params.Key,
            UploadId: params.UploadId,
        });

        await this.client.send(command);
    }

    public async listParts(params: { Bucket: string; Key: string; UploadId: string }): Promise<{ Parts?: Part[] }> {
        const command = new ListPartsCommand({
            Bucket: params.Bucket,
            Key: params.Key,
            UploadId: params.UploadId,
        });

        const response: ListPartsCommandOutput = await this.client.send(command);

        const parts: Part[] = [];

        if (response.Parts) {
            for (const part of response.Parts) {
                if (part.ETag && part.PartNumber) {
                    parts.push({
                        ETag: part.ETag,
                        PartNumber: part.PartNumber,
                        Size: part.Size,
                    });
                }
            }
        }

        return { Parts: parts.length > 0 ? parts : undefined };
    }

    public async getObject(params: { Bucket: string; Key: string }): Promise<{
        Body?: ReadableStream | Readable;
        ContentLength?: number;
        ContentType?: string;
        ETag?: string;
        Expires?: Date;
        LastModified?: Date;
        Metadata?: Record<string, string>;
    }> {
        const command = new GetObjectCommand({
            Bucket: params.Bucket,
            Key: params.Key,
        });

        const response: GetObjectCommandOutput = await this.client.send(command);

        // Convert SdkStream to Readable
        let body: Readable | ReadableStream | undefined;

        if (response.Body) {
            const sdkStream = response.Body;

            if (sdkStream instanceof Readable) {
                body = sdkStream;
            } else if (typeof sdkStream === "object" && "transform" in sdkStream && sdkStream instanceof NodeReadableStream) {
                // Handle Web ReadableStream if returned by SDK
                body = sdkStream as unknown as ReadableStream;
            } else {
                // Handle Blob or other types
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                body = Readable.from(sdkStream as any);
            }
        }

        return {
            Body: body,
            ContentLength: response.ContentLength,
            ContentType: response.ContentType,
            ETag: response.ETag,
            Expires: response.Expires,
            LastModified: response.LastModified,
            Metadata: response.Metadata,
        };
    }

    public async headObject(params: { Bucket: string; Key: string }): Promise<{
        ContentLength?: number;
        ContentType?: string;
        ETag?: string;
        Expires?: Date;
        LastModified?: Date;
    }> {
        const command = new HeadObjectCommand({
            Bucket: params.Bucket,
            Key: params.Key,
        });

        const response: HeadObjectCommandOutput = await this.client.send(command);

        return {
            ContentLength: response.ContentLength,
            ContentType: response.ContentType,
            ETag: response.ETag,
            Expires: response.Expires,
            LastModified: response.LastModified,
        };
    }

    public async deleteObject(params: { Bucket: string; Key: string }): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: params.Bucket,
            Key: params.Key,
        });

        await this.client.send(command);
    }

    public async copyObject(params: { Bucket: string; CopySource: string; Key: string; StorageClass?: string }): Promise<void> {
        const commandInput: CopyObjectCommandInput = {
            Bucket: params.Bucket,
            CopySource: params.CopySource,
            Key: params.Key,
        };

        if (params.StorageClass) {
            commandInput.StorageClass = params.StorageClass as CopyObjectCommandInput["StorageClass"];
        }

        const command = new CopyObjectCommand(commandInput);

        await this.client.send(command);
    }

    public async listObjectsV2(params: { Bucket: string; ContinuationToken?: string; MaxKeys?: number }): Promise<{
        Contents?: { Key?: string; LastModified?: Date }[];
        IsTruncated?: boolean;
        NextContinuationToken?: string;
    }> {
        const command = new ListObjectsV2Command({
            Bucket: params.Bucket,
            ContinuationToken: params.ContinuationToken,
            MaxKeys: params.MaxKeys,
        });

        const response: ListObjectsV2CommandOutput = await this.client.send(command);

        return {
            Contents: response.Contents?.map((item) => {
                return {
                    Key: item.Key,
                    LastModified: item.LastModified,
                };
            }),
            IsTruncated: response.IsTruncated,
            NextContinuationToken: response.NextContinuationToken,
        };
    }

    public async getPresignedUrl(params: { Bucket: string; expiresIn: number; Key: string; PartNumber: number; UploadId: string }): Promise<string> {
        const command = new UploadPartCommand({
            Bucket: params.Bucket,
            Key: params.Key,
            PartNumber: params.PartNumber,
            UploadId: params.UploadId,
        });

        return getSignedUrl(this.client, command, { expiresIn: params.expiresIn });
    }

    public async checkBucketAccess(params: { Bucket: string }): Promise<void> {
        await waitUntilBucketExists({ client: this.client, maxWaitTime: 30 }, { Bucket: params.Bucket });
    }
}

export default S3ClientAdapter;
