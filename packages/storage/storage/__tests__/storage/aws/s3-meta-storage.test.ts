import { Readable } from "node:stream";

import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";

import S3MetaStorage from "../../../src/storage/aws/s3-meta-storage";
import type { S3MetaStorageOptions } from "../../../src/storage/aws/types";
import { getMetaVersion } from "../../../src/storage/meta-storage";
import { ERRORS } from "../../../src/utils/errors";
import { metafile } from "../../__helpers__/config";

vi.mock(import("aws-crt"));

const s3Mock = mockClient(S3Client);

/** A GetObject body as the SDK hands it out. */
const sdkBody = (text: string) => Object.assign(Readable.from([text]), { transformToString: async () => text }) as never;

// Calls other than the lazy bucket access probe (HeadBucketCommand) run on the first operation.
const dataCalls = () => s3Mock.calls().filter((call) => !(call.args[0] instanceof HeadBucketCommand));

describe(S3MetaStorage, () => {
    let metaStorage: S3MetaStorage;

    const options: S3MetaStorageOptions = {
        bucket: "test-bucket",
        region: "us-east-1",
    };

    beforeEach(() => {
        s3Mock.reset();
        // Mock bucket access check (HeadBucketCommand)
        s3Mock.onAnyCommand().resolves({});
        metaStorage = new S3MetaStorage(options);
    });

    describe("bucket access check", () => {
        it("should probe the bucket once, on the first operation instead of the constructor", async () => {
            expect.assertions(2);

            expect(s3Mock.commandCalls(HeadBucketCommand)).toHaveLength(0);

            await metaStorage.save(metafile.id, metafile);
            await metaStorage.save(metafile.id, metafile);

            expect(s3Mock.commandCalls(HeadBucketCommand)).toHaveLength(1);
        });

        it("should fail fast on a single HeadBucket and retry it on the next operation", async () => {
            expect.assertions(3);

            const error = Object.assign(new Error("NotFound"), { name: "NotFound" });

            s3Mock.on(HeadBucketCommand).rejectsOnce(error);

            await expect(metaStorage.save(metafile.id, metafile)).rejects.toThrow("NotFound");

            expect(s3Mock.commandCalls(HeadBucketCommand)).toHaveLength(1);

            await metaStorage.save(metafile.id, metafile);

            expect(s3Mock.commandCalls(HeadBucketCommand)).toHaveLength(2);
        });

        it("should not probe a caller-supplied client", async () => {
            expect.assertions(1);

            const storage = new S3MetaStorage({ ...options, client: new S3Client({ region: "us-east-1" }) });

            await storage.save(metafile.id, metafile);

            expect(s3Mock.commandCalls(HeadBucketCommand)).toHaveLength(0);
        });
    });

    describe(".save()", () => {
        it("should save metadata to S3", async () => {
            expect.assertions(1);

            s3Mock.on(PutObjectCommand).resolves({});

            await metaStorage.save(metafile.id, metafile);

            expect(dataCalls()).toHaveLength(1);
        });

        it("should store the record as the object's body, so its ETag changes with every change", async () => {
            expect.assertions(2);

            s3Mock.on(PutObjectCommand).resolves({});

            await metaStorage.save(metafile.id, metafile);

            const { input } = s3Mock.commandCalls(PutObjectCommand)[0]?.args[0] ?? {};

            expect(JSON.parse(input?.Body as string)).toMatchObject({ id: metafile.id, metadata: metafile.metadata });
            expect(input?.Metadata).toBeUndefined();
        });
    });

    describe(".get()", () => {
        it("should retrieve metadata from S3", async () => {
            expect.assertions(1);

            const metadata = encodeURIComponent(
                JSON.stringify({
                    ...metafile,
                    bytesWritten: 0,
                    createdAt: new Date().toISOString(),
                    status: "created",
                }),
            );

            s3Mock.on(GetObjectCommand).resolves({
                Metadata: { metadata },
            });

            const file = await metaStorage.get(metafile.id);

            expect(file.id).toBe(metafile.id);
        });

        it("should throw error when metadata not found", async () => {
            expect.assertions(1);

            s3Mock.on(GetObjectCommand).resolves({
                Metadata: {},
            });

            await expect(metaStorage.get("non-existent-id")).rejects.toThrow("Metafile non-existent-id not found");
        });

        it("should read a record from the object's body", async () => {
            expect.assertions(2);

            s3Mock.on(GetObjectCommand).resolves({ Body: sdkBody(JSON.stringify({ ...metafile, metadata: {} })) });

            await expect(metaStorage.get(metafile.id)).resolves.toMatchObject({ id: metafile.id, metadata: {} });

            expect(s3Mock.commandCalls(GetObjectCommand)[0]?.args[0].input.Key).toBe(`${metafile.id}.META`);
        });

        it("should read empty metadata of a header record as an object, not a string", async () => {
            expect.assertions(1);

            s3Mock.on(GetObjectCommand).resolves({ Metadata: { metadata: encodeURIComponent(JSON.stringify({ ...metafile, metadata: "" })) } });

            await expect(metaStorage.get(metafile.id)).resolves.toHaveProperty("metadata", {});
        });

        it("should not take an HTTP Expires header for the record's expiry", async () => {
            expect.assertions(2);

            s3Mock.on(GetObjectCommand).resolves({ Body: sdkBody(JSON.stringify(metafile)), Expires: new Date(Date.now() - 1000 * 60 * 60) });

            await expect(metaStorage.get(metafile.id)).resolves.toHaveProperty("id", metafile.id);

            expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(0);
        });

        it("should report a missing metafile as not found", async () => {
            expect.assertions(1);

            s3Mock.on(GetObjectCommand).rejects(Object.assign(new Error("NotFound"), { $metadata: { httpStatusCode: 404 }, name: "NotFound" }));

            await expect(metaStorage.get("non-existent-id")).rejects.toHaveProperty("UploadErrorCode", ERRORS.FILE_NOT_FOUND);
        });

        it("should rethrow other failures", async () => {
            expect.assertions(1);

            const failure = Object.assign(new Error("Forbidden"), { $metadata: { httpStatusCode: 403 } });

            s3Mock.on(GetObjectCommand).rejects(failure);

            await expect(metaStorage.get(metafile.id)).rejects.toThrow("Forbidden");
        });
    });

    describe(".delete()", () => {
        it("should delete metadata from S3", async () => {
            expect.assertions(1);

            s3Mock.on(DeleteObjectCommand).resolves({});

            await metaStorage.delete(metafile.id);

            expect(dataCalls()).toHaveLength(1);
        });
    });

    describe(".touch()", () => {
        it("should call save method", async () => {
            expect.assertions(1);

            s3Mock.on(PutObjectCommand).resolves({});

            const result = await metaStorage.touch(metafile.id, metafile);

            expect(result).toBe(metafile);
        });
    });

    describe("conditional saves", () => {
        it("should attach the ETag read by get() and write with If-Match", async () => {
            expect.assertions(4);

            s3Mock.on(GetObjectCommand).resolves({ ETag: '"v1"', Metadata: { metadata: encodeURIComponent(JSON.stringify(metafile)) } });
            s3Mock.on(PutObjectCommand).resolves({ ETag: '"v2"' });

            const file = await metaStorage.get(metafile.id);

            expect(getMetaVersion(file)).toBe('"v1"');

            const saved = await metaStorage.saveIfVersion(metafile.id, file, '"v1"');

            expect(saved).toBe(file);
            expect(s3Mock.commandCalls(PutObjectCommand)[0]?.args[0].input.IfMatch).toBe('"v1"');
            expect(getMetaVersion(file)).toBe('"v2"');
        });

        it.each([412, 409])("should report a %d conditional write conflict as undefined", async (httpStatusCode) => {
            expect.assertions(1);

            s3Mock.on(PutObjectCommand).rejects(Object.assign(new Error("PreconditionFailed"), { $metadata: { httpStatusCode } }));

            await expect(metaStorage.saveIfVersion(metafile.id, { ...metafile }, '"v1"')).resolves.toBeUndefined();
        });

        it("should rethrow other errors", async () => {
            expect.assertions(1);

            s3Mock.on(PutObjectCommand).rejects(Object.assign(new Error("AccessDenied"), { $metadata: { httpStatusCode: 403 } }));

            await expect(metaStorage.saveIfVersion(metafile.id, { ...metafile }, '"v1"')).rejects.toThrow("AccessDenied");
        });
    });
});
