import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CopyObjectCommand,
    CreateMultipartUploadCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListPartsCommand,
    S3Client,
    UploadPartCommand,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import S3Storage from "../../../src/storage/aws/s3-storage";
import type { AwsError, S3StorageOptions } from "../../../src/storage/aws/types";
import { metafile, storageOptions, testfile } from "../../__helpers__/config";

vi.mock(import("aws-crt"));
vi.mock(import("@aws-sdk/s3-request-presigner"), () => {
    return {
        getSignedUrl: vi.fn().mockResolvedValue("https://api.s3.example.com?signed"),
    };
});

const s3Mock = mockClient(S3Client);

describe(S3Storage, () => {
    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    const options = { ...(storageOptions as S3StorageOptions), bucket: "bucket", region: "us-east-1" };

    let storage: S3Storage;

    const metafileResponse = {
        Metadata: {
            metadata: encodeURIComponent(
                JSON.stringify({
                    ...metafile,
                    bytesWritten: 0,
                    createdAt: new Date().toISOString(),
                    status: "created",
                    UploadId: "987654321",
                }),
            ),
        },
    };

    beforeEach(async () => {
        s3Mock.reset();
        storage = new S3Storage(options);
    });

    describe(".create()", () => {
        it("should request api and set status and UploadId", async () => {
            expect.assertions(1);

            s3Mock.on(HeadObjectCommand).rejects();
            s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: "123456789" });

            const s3file = await storage.create(metafile);

            expect(s3file).toMatchSnapshot({
                createdAt: expect.any(String),
                expiredAt: expect.any(Number),
            });
        });

        it("should handle existing", async () => {
            expect.assertions(1);

            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);

            const s3file = await storage.create(metafile);

            expect(s3file).toMatchSnapshot();
        });

        it("should send error on invalid s3 response", async () => {
            expect.assertions(1);

            s3Mock.on(HeadObjectCommand).rejects();
            s3Mock.on(CreateMultipartUploadCommand).resolves({});

            await expect(storage.create(metafile)).rejects.toMatchSnapshot();
        });

        it("should handle TTL option", async () => {
            expect.assertions(3);

            s3Mock.on(HeadObjectCommand).rejects();
            s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: "123456789" });

            const s3file = await storage.create({ ...metafile, ttl: "30d" });

            expect(s3file.expiredAt).toBeDefined();

            expectTypeOf(s3file.expiredAt).toBeNumber();

            // TTL should be converted to expiredAt timestamp
            const expectedExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days in ms

            expect(s3file.expiredAt).toBeGreaterThan(expectedExpiry - 1000); // Allow 1s tolerance
            expect(s3file.expiredAt).toBeLessThan(expectedExpiry + 1000);
        });
    });

    describe(".update()", () => {
        it("should update changed metadata keys", async () => {
            expect.assertions(2);

            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);

            const s3file = await storage.update(metafile, { metadata: { name: "newname.mp4" } });

            expect(s3file.metadata.name).toBe("newname.mp4");
            expect(s3file.metadata.mimeType).toBe(metafile.metadata.mimeType);
        });

        it("should reject if not found", async () => {
            expect.assertions(1);

            await expect(storage.update(metafile, { metadata: { name: "newname.mp4" } })).rejects.toHaveProperty("UploadErrorCode", "FileNotFound");
        });

        it("should handle TTL option in update", async () => {
            expect.assertions(3);

            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);

            const s3file = await storage.update(metafile, { ttl: "1h" });

            expect(s3file.expiredAt).toBeDefined();

            expectTypeOf(s3file.expiredAt).toBeNumber();

            // TTL should be converted to expiredAt timestamp
            const expectedExpiry = Date.now() + 60 * 60 * 1000; // 1 hour in ms

            expect(s3file.expiredAt).toBeGreaterThan(expectedExpiry - 1000); // Allow 1s tolerance
            expect(s3file.expiredAt).toBeLessThan(expectedExpiry + 1000);
        });
    });

    describe(".write()", () => {
        it("should request api and set status and bytesWritten", async () => {
            expect.assertions(1);

            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(ListPartsCommand).resolves({ Parts: [] });
            s3Mock.on(UploadPartCommand).resolves({ ETag: "1234" });
            s3Mock.on(CompleteMultipartUploadCommand).resolves({ Location: "/1234" });

            const part = {
                body: testfile.asReadable,
                contentLength: metafile.size,
                id: metafile.id,
                name: metafile.name,
                start: 0,
            };
            const s3file = await storage.write(part);

            expect(s3file).toMatchSnapshot();
        });

        it("should request api and set status and bytesWritten on resume", async () => {
            expect.assertions(1);

            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(ListPartsCommand).resolves({ Parts: [] });

            const part = {
                contentLength: 0,
                id: metafile.id,
                name: metafile.name,
            };
            const s3file = await storage.write(part);

            expect(s3file).toMatchSnapshot();
        });
    });

    describe("delete()", () => {
        it("should set status", async () => {
            expect.assertions(1);

            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(DeleteObjectCommand).resolves({});

            const deleted = await storage.delete(metafile);

            expect(deleted.status).toBe("deleted");
        });

        it("should return full file object when file exists", async () => {
            expect.assertions(2);

            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(DeleteObjectCommand).resolves({});
            s3Mock.on(AbortMultipartUploadCommand).resolves({});

            const deleted = await storage.delete(metafile);

            expect(deleted.id).toBe(metafile.id);
            expect(deleted.status).toBe("deleted");
        });

        it("should throw error when file does not exist", async () => {
            expect.assertions(1);

            // Mock getMeta to throw error (file not found)
            s3Mock.on(HeadObjectCommand).rejects(new Error("File not found"));

            await expect(storage.delete(metafile)).rejects.toThrow();
        });
    });

    describe("copy()", () => {
        it("relative", async () => {
            expect.assertions(2);

            s3Mock.resetHistory();
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(CopyObjectCommand).resolves({});

            const result = await storage.copy("name", "new name");

            expect(s3Mock.call(1).args[0].input).toStrictEqual({
                Bucket: "bucket",
                CopySource: "bucket/name",
                Key: "new name",
            });
            expect(result.name).toBe("new name");
        });

        it("absolute", async () => {
            expect.assertions(2);

            s3Mock.resetHistory();
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(CopyObjectCommand).resolves({});

            const result = await storage.copy("name", "/otherBucket/new name");

            expect(s3Mock.call(1).args[0].input).toStrictEqual({
                Bucket: "otherBucket",
                CopySource: "bucket/name",
                Key: "new name",
            });
            expect(result.name).toBe("new name");
        });

        it("with storage class", async () => {
            expect.assertions(2);

            s3Mock.resetHistory();
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(CopyObjectCommand).resolves({});

            const result = await storage.copy("name", "new name", { storageClass: "GLACIER" });

            expect(s3Mock.call(1).args[0].input).toStrictEqual({
                Bucket: "bucket",
                CopySource: "bucket/name",
                Key: "new name",
                StorageClass: "GLACIER",
            });
            expect(result.name).toBe("new name");
        });
    });

    describe("normalizeError", () => {
        it("s3 error", () => {
            expect.assertions(1);

            const error = {
                $metadata: { httpStatusCode: 400 },
                Code: "SomeServiceException",
                message: "SomeServiceException",
                name: "SomeError",
            };

            expect(storage.normalizeError(error)).toMatchSnapshot();
        });

        it("not s3 error", () => {
            expect.assertions(1);

            expect(storage.normalizeError(new Error("unknown") as AwsError)).toMatchSnapshot();
        });
    });
});

describe("s3PresignedStorage", () => {
    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    const options = {
        ...(storageOptions as S3StorageOptions),
        bucket: "bucket",
        clientDirectUpload: true,
        region: "us-east-1",
    };

    let storage: S3Storage;

    const metafileResponse = {
        Metadata: {
            metadata: encodeURIComponent(
                JSON.stringify({
                    ...metafile,
                    bytesWritten: 0,
                    createdAt: new Date().toISOString(),
                    status: "created",
                    UploadId: "987654321",
                }),
            ),
        },
    };

    beforeEach(async () => {
        s3Mock.reset();
        storage = new S3Storage(options);
    });

    describe(".create()", () => {
        it("should request api and set status and UploadId", async () => {
            expect.assertions(2);

            s3Mock.on(HeadObjectCommand).rejects();
            s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: "123456789" });
            s3Mock.on(ListPartsCommand).resolves({ Parts: [] });

            const s3file = await storage.create(metafile);

            expect(s3file.partsUrls?.length).toBe(1);
            expect(s3file.partSize).toBeGreaterThan(0);
        });
    });

    describe("update", () => {
        it("should add partsUrls", async () => {
            expect.assertions(1);

            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(ListPartsCommand).resolves({ Parts: [] });

            const s3file = await storage.update(metafile, metafile);

            expect(s3file.partsUrls?.length).toBe(1);
        });

        it("should complete", async () => {
            expect.assertions(1);

            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);

            const preCompleted = {
                ...metafile,
                Parts: [{ ETag: "123456789", PartNumber: 1, Size: 64 }],
                partSize: 16_777_216,
                partsUrls: ["https://api.s3.example.com?signed"],
                UploadId: "123456789",
            };

            s3Mock.on(CompleteMultipartUploadCommand).resolves({ Location: "/1234" });

            const s3file = await storage.update({ id: metafile.id }, preCompleted);

            expect(s3file.status).toBe("completed");
        });

        it("should complete (empty payload)", async () => {
            expect.assertions(1);

            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(ListPartsCommand).resolves({ Parts: [{ ETag: "123456789", PartNumber: 1, Size: 64 }] });
            s3Mock.on(CompleteMultipartUploadCommand).resolves({ Location: "/1234" });

            const s3file = await storage.update({ id: metafile.id }, {});

            expect(s3file.status).toBe("completed");
        });
    });
});
