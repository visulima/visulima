import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";

import S3MetaStorage from "../../../src/storage/aws/s3-meta-storage";
import type { S3MetaStorageOptions } from "../../../src/storage/aws/types";
import { metafile } from "../../__helpers__/config";

vi.mock(import("aws-crt"));

const s3Mock = mockClient(S3Client);

describe(S3MetaStorage, () => {
    let metaStorage: S3MetaStorage;

    const options: S3MetaStorageOptions = {
        bucket: "test-bucket",
        region: "us-east-1",
    };

    beforeEach(() => {
        s3Mock.reset();
        // Mock bucket access check (waitUntilBucketExists)
        s3Mock.onAnyCommand().resolves({});
        metaStorage = new S3MetaStorage(options);
        s3Mock.resetHistory();
    });

    describe(".save()", () => {
        it("should save metadata to S3", async () => {
            expect.assertions(1);

            s3Mock.on(PutObjectCommand).resolves({});

            await metaStorage.save(metafile.id, metafile);

            expect(s3Mock.calls()).toHaveLength(1);
        });

        it("should encode metadata correctly", async () => {
            expect.assertions(1);

            s3Mock.on(PutObjectCommand).resolves({});

            await metaStorage.save(metafile.id, metafile);

            const putCommand = s3Mock.call(0).args[0].input as { Metadata?: { metadata?: string } };

            expect(putCommand.Metadata?.metadata).toBeDefined();
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

            s3Mock.on(HeadObjectCommand).resolves({
                Metadata: { metadata },
            });

            const file = await metaStorage.get(metafile.id);

            expect(file.id).toBe(metafile.id);
        });

        it("should throw error when metadata not found", async () => {
            expect.assertions(1);

            s3Mock.on(HeadObjectCommand).resolves({
                Metadata: {},
            });

            await expect(metaStorage.get("non-existent-id")).rejects.toThrow("Metafile non-existent-id not found");
        });

        it("should delete expired metadata", async () => {
            expect.assertions(2);

            const expiredDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
            const metadata = encodeURIComponent(
                JSON.stringify({
                    ...metafile,
                    bytesWritten: 0,
                    createdAt: new Date().toISOString(),
                    status: "created",
                }),
            );

            s3Mock.on(HeadObjectCommand).resolves({
                Expires: expiredDate,
                Metadata: { metadata },
            });
            s3Mock.on(DeleteObjectCommand).resolves({});

            await expect(metaStorage.get(metafile.id)).rejects.toThrow(`Metafile ${metafile.id} not found`);

            expect(s3Mock.calls()).toHaveLength(2); // HeadObjectCommand + DeleteObjectCommand
        });
    });

    describe(".delete()", () => {
        it("should delete metadata from S3", async () => {
            expect.assertions(1);

            s3Mock.on(DeleteObjectCommand).resolves({});

            await metaStorage.delete(metafile.id);

            expect(s3Mock.calls()).toHaveLength(1);
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
});
