import { buffer } from "node:stream/consumers";

import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CopyObjectCommand,
    CreateMultipartUploadCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListMultipartUploadsCommand,
    ListObjectsV2Command,
    ListPartsCommand,
    PutObjectCommand,
    UploadPartCommand,
} from "@aws-sdk/client-s3";

import { createS3State } from "../s3-state";

// Copied from __tests__/storage/aws/s3-fake.test.ts so other suites can share it.

export const s3Error = (name: string, status: number): Error =>
    Object.assign(new Error(name), { $fault: "client", $metadata: { httpStatusCode: status }, name });

const toBuffer = async (body: unknown): Promise<Buffer> => {
    if (typeof body === "string") {
        return Buffer.from(body);
    }

    return body instanceof Uint8Array ? Buffer.from(body) : buffer(body as AsyncIterable<Uint8Array>);
};

/**
 * In-memory S3 bucket answering the commands S3Storage and S3MetaStorage send. `override` answers a
 * command before the fake does: an Error is thrown, any other value is returned as the response.
 */
export const createS3SdkFake = () => {
    const bucket = createS3State();
    const sent: { input: Record<string, unknown>; name: string }[] = [];
    const state: { override?: (command: { input: Record<string, unknown> }) => unknown } = {};

    const send = async (command: { constructor: { name: string }; input: Record<string, unknown> }): Promise<unknown> => {
        const { input } = command;

        sent.push({ input, name: command.constructor.name });

        const overridden = state.override?.(command);

        if (overridden instanceof Error) {
            throw overridden;
        }

        if (overridden !== undefined) {
            return overridden;
        }

        const key = input.Key as string;
        const uploadId = input.UploadId as string;

        if (command instanceof CreateMultipartUploadCommand) {
            return { UploadId: bucket.createUpload(key, { contentType: input.ContentType as string, metadata: input.Metadata as Record<string, string> }) };
        }

        if (command instanceof UploadPartCommand) {
            const ETag = bucket.putPart(uploadId, input.PartNumber as number, await toBuffer(input.Body));

            if (ETag === undefined) {
                throw s3Error("NoSuchUpload", 404);
            }

            return { ETag };
        }

        if (command instanceof ListPartsCommand) {
            const parts = bucket.parts(uploadId);

            if (parts === undefined) {
                throw s3Error("NoSuchUpload", 404);
            }

            return {
                Parts: parts.map(([number, part]) => {
                    return { ETag: part.etag, PartNumber: number, Size: part.body.byteLength };
                }),
            };
        }

        if (command instanceof CompleteMultipartUploadCommand) {
            const requested = (input.MultipartUpload as { Parts: { PartNumber: number }[] }).Parts;
            const completed = bucket.complete(
                uploadId,
                requested.map(({ PartNumber }) => PartNumber),
            );

            if (completed === undefined) {
                throw s3Error("NoSuchUpload", 404);
            }

            return { ETag: completed.etag, Location: `https://bucket.s3.test/${key}` };
        }

        if (command instanceof AbortMultipartUploadCommand) {
            if (!bucket.abort(uploadId)) {
                throw s3Error("NoSuchUpload", 404);
            }

            return {};
        }

        if (command instanceof ListMultipartUploadsCommand) {
            return {
                IsTruncated: false,
                Uploads: [...bucket.uploads].map(([id, upload]) => {
                    return { Initiated: upload.initiated, Key: upload.key, UploadId: id };
                }),
            };
        }

        if (command instanceof ListObjectsV2Command) {
            // A real bucket may answer fewer keys than asked for; two per page forces paging.
            const page = bucket.list({
                delimiter: input.Delimiter as string | undefined,
                maxKeys: input.MaxKeys as number | undefined,
                pageSize: 2,
                prefix: input.Prefix as string | undefined,
                start: Number(input.ContinuationToken ?? 0),
            });

            return {
                CommonPrefixes: page.prefixes.map((name) => {
                    return { Prefix: name };
                }),
                Contents: page.contents.map((object) => {
                    return { Key: object.key, LastModified: object.lastModified };
                }),
                IsTruncated: page.next !== undefined,
                NextContinuationToken: page.next === undefined ? undefined : String(page.next),
            };
        }

        if (command instanceof PutObjectCommand) {
            if (input.IfMatch !== undefined && bucket.objects.get(key)?.etag !== input.IfMatch) {
                throw s3Error("PreconditionFailed", 412);
            }

            return {
                ETag: bucket.put(key, await toBuffer(input.Body ?? Buffer.alloc(0)), {
                    contentType: input.ContentType as string,
                    metadata: input.Metadata as Record<string, string>,
                }).etag,
            };
        }

        if (command instanceof CopyObjectCommand) {
            if (!bucket.copy(decodeURIComponent((input.CopySource as string).slice("bucket/".length)), key)) {
                throw s3Error("NoSuchKey", 404);
            }

            return {};
        }

        if (command instanceof DeleteObjectCommand) {
            bucket.objects.delete(key);

            return {};
        }

        if (command instanceof HeadObjectCommand || command instanceof GetObjectCommand) {
            const read = bucket.read(key, input.Range as string | undefined);

            if (!read) {
                throw s3Error(command instanceof HeadObjectCommand ? "NotFound" : "NoSuchKey", 404);
            }

            return {
                // Not a Readable: the adapter has to wrap whatever body type the SDK hands it.
                ...(command instanceof GetObjectCommand && {
                    Body: Object.assign(Buffer.from(read.body), { transformToString: async () => read.body.toString() }),
                }),
                ContentLength: read.body.byteLength,
                ContentType: read.object.contentType,
                ETag: read.object.etag,
                Expires: read.object.expires,
                LastModified: read.object.lastModified,
                Metadata: read.object.metadata,
            };
        }

        // HeadBucket (access checks).
        return {};
    };

    return { objects: bucket.objects, put: bucket.put, send, sent, state, uploads: bucket.uploads };
};
