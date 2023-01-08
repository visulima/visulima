import {
    CompleteMultipartUploadCommand, CopyObjectCommand,
    CreateMultipartUploadCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListPartsCommand,
    S3Client,
    UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mockClient } from "aws-sdk-client-mock";
import { createRequest } from "node-mocks-http";
import {
    beforeEach, describe, expect, it, vi,
} from "vitest";

import S3Storage from "../../../src/storage/aws/s3-storage";
import type { AwsError, S3StorageOptions } from "../../../src/storage/aws/types.d";
import { metafile, storageOptions, testfile } from "../../__helpers__/config";

vi.mock("aws-crt");
vi.mock("@aws-sdk/s3-request-presigner");

const s3Mock = mockClient(S3Client);

describe("S3Storage", () => {
    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    const options = { ...(storageOptions as S3StorageOptions), bucket: "bucket", region: "us-east-1" };

    const request = createRequest();

    let storage: S3Storage;

    const metafileResponse = {
        Metadata: {
            metadata: encodeURIComponent(
                JSON.stringify({
                    ...metafile,
                    createdAt: new Date().toISOString(),
                    bytesWritten: 0,
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
            s3Mock.on(HeadObjectCommand).rejects();
            s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: "123456789" });

            const s3file = await storage.create(request, metafile);

            expect(s3file).toMatchSnapshot();
        });

        it("should handle existing", async () => {
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);

            const s3file = await storage.create(request, metafile);

            expect(s3file).toMatchSnapshot();
        });

        it("should send error on invalid s3 response", async () => {
            s3Mock.on(HeadObjectCommand).rejects();
            s3Mock.on(CreateMultipartUploadCommand).resolves({});

            await expect(storage.create(request, metafile)).rejects.toMatchSnapshot();
        });
    });

    describe(".update()", () => {
        it("should update changed metadata keys", async () => {
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);

            // eslint-disable-next-line radar/no-duplicate-string
            const s3file = await storage.update(metafile, { metadata: { name: "newname.mp4" } });

            expect(s3file.metadata.name).toBe("newname.mp4");
            expect(s3file.metadata.mimeType).toBe(metafile.metadata.mimeType);
        });

        it("should reject if not found", async () => {
            expect.assertions(1);

            await expect(storage.update(metafile, { metadata: { name: "newname.mp4" } })).rejects.toHaveProperty("UploadErrorCode", "FileNotFound");
        });
    });

    describe(".write()", () => {
        it("should request api and set status and bytesWritten", async () => {
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(ListPartsCommand).resolves({ Parts: [] });
            s3Mock.on(UploadPartCommand).resolves({ ETag: "1234" });
            s3Mock.on(CompleteMultipartUploadCommand).resolves({ Location: "/1234" });

            const part = {
                id: metafile.id,
                name: metafile.name,
                body: testfile.asReadable,
                start: 0,
                contentLength: metafile.size,
            };
            const s3file = await storage.write(part);

            expect(s3file).toMatchSnapshot();
        });

        it("should request api and set status and bytesWritten on resume", async () => {
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(ListPartsCommand).resolves({ Parts: [] });

            const part = {
                id: metafile.id,
                name: metafile.name,
                contentLength: 0,
            };
            const s3file = await storage.write(part);

            expect(s3file).toMatchSnapshot();
        });
    });

    describe("delete()", () => {
        it("should set status", async () => {
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(DeleteObjectCommand).resolves({});

            const deleted = await storage.delete(metafile);

            expect(deleted.status).toBe("deleted");
        });

        it("should ignore if not exist", async () => {
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);

            const deleted = await storage.delete(metafile);

            expect(deleted.id).toBe(metafile.id);
        });
    });

    describe("copy()", () => {
        it("relative", async () => {
            s3Mock.resetHistory();
            s3Mock.on(CopyObjectCommand).resolves({});

            await storage.copy("name", "new name");

            expect(s3Mock.call(0).args[0].input).toStrictEqual({
                Bucket: "bucket",
                CopySource: "bucket/name",
                Key: "new name",
            });
        });

        it("absolute", async () => {
            s3Mock.resetHistory();
            s3Mock.on(CopyObjectCommand).resolves({});

            await storage.copy("name", "/otherBucket/new name");

            expect(s3Mock.call(0).args[0].input).toStrictEqual({
                Bucket: "otherBucket",
                CopySource: "bucket/name",
                Key: "new name",
            });
        });
    });

    describe("normalizeError", () => {
        it("s3 error", () => {
            const error = {
                $metadata: { httpStatusCode: 400 },
                message: "SomeServiceException",
                name: "SomeError",
                Code: "SomeServiceException",
            };

            expect(storage.normalizeError(error)).toMatchSnapshot();
        });

        it("not s3 error", () => {
            expect(storage.normalizeError(new Error("unknown") as AwsError)).toMatchSnapshot();
        });
    });
});

describe("S3PresignedStorage", () => {
    const getSignedUrlMock = getSignedUrl as any;

    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    const options = {
        ...(storageOptions as S3StorageOptions), clientDirectUpload: true, bucket: "bucket", region: "us-east-1",
    };

    const request = createRequest();

    let storage: S3Storage;

    const metafileResponse = {
        Metadata: {
            metadata: encodeURIComponent(
                JSON.stringify({
                    ...metafile,
                    createdAt: new Date().toISOString(),
                    bytesWritten: 0,
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
            s3Mock.on(HeadObjectCommand).rejects();
            s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: "123456789" });
            s3Mock.on(ListPartsCommand).resolves({ Parts: [] });

            // eslint-disable-next-line radar/no-duplicate-string
            getSignedUrlMock.mockResolvedValue("https://api.s3.example.com?signed");

            const s3file = await storage.create(request, metafile);

            expect(s3file.partsUrls?.length).toBe(1);
            expect(s3file.partSize).toBeGreaterThan(0);
        });
    });

    describe("update", () => {
        it("should add partsUrls", async () => {
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(ListPartsCommand).resolves({ Parts: [] });
            getSignedUrlMock.mockResolvedValue("https://api.s3.example.com?signed");

            const s3file = await storage.update(metafile, metafile);

            expect(s3file.partsUrls?.length).toBe(1);
        });

        it("should complete", async () => {
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);

            const preCompleted = {
                ...metafile,
                Parts: [{ PartNumber: 1, Size: 64, ETag: "123456789" }],
                UploadId: "123456789",
                partSize: 16_777_216,
                partsUrls: ["https://api.s3.example.com?signed"],
            };

            s3Mock.on(CompleteMultipartUploadCommand).resolves({ Location: "/1234" });

            const s3file = await storage.update({ id: metafile.id }, preCompleted);

            expect(s3file.status).toBe("completed");
        });

        it("should complete (empty payload)", async () => {
            s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
            s3Mock.on(ListPartsCommand).resolves({ Parts: [{ PartNumber: 1, Size: 64, ETag: "123456789" }] });
            s3Mock.on(CompleteMultipartUploadCommand).resolves({ Location: "/1234" });

            const s3file = await storage.update({ id: metafile.id }, {});

            expect(s3file.status).toBe("completed");
        });
    });
});
