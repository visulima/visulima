import {
    AbortMultipartUploadCommand,
    DeleteObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    ListMultipartUploadsCommand,
    ListObjectsV2Command,
    S3Client,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type S3File from "../../../src/storage/aws/s3-file";
import S3Storage from "../../../src/storage/aws/s3-storage";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";

vi.mock(import("aws-crt"));

const s3Mock = mockClient(S3Client);

const HOUR = 60 * 60 * 1000;

describe("s3Storage purge", () => {
    let metaStorage: MemoryMetaStorage<S3File>;
    let logger: { debug: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

    const createStorage = (rolling = false): S3Storage =>
        new S3Storage({ bucket: "bucket", expiration: { maxAge: "1h", rolling }, logger: logger as unknown as Console, metaStorage, region: "us-east-1" });

    const ago = (ms: number): Date => new Date(Date.now() - ms);

    beforeEach(() => {
        s3Mock.reset();
        s3Mock.on(HeadBucketCommand).resolves({});
        metaStorage = new MemoryMetaStorage<S3File>();
        logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    });

    it("should delete its own expired uploads and leave objects and multipart uploads it didn't create", async () => {
        expect.assertions(6);

        await metaStorage.save("tracked", { contentType: "text/plain", createdAt: ago(2 * HOUR).toISOString(), id: "tracked", metadata: {}, name: "tracked", UploadId: "U1" } as S3File);
        await metaStorage.save("old", { contentType: "text/plain", createdAt: ago(2 * HOUR).toISOString(), id: "old", metadata: {}, name: "old", status: "completed" } as S3File);
        await metaStorage.save("failing", { contentType: "text/plain", createdAt: ago(2 * HOUR).toISOString(), id: "failing", metadata: {}, name: "failing", UploadId: "U4" } as S3File);

        s3Mock.on(ListObjectsV2Command).resolves({
            Contents: [
                { Key: "old", LastModified: ago(2 * HOUR) },
                // An app file sharing the bucket: no upload metadata, never purged.
                { Key: "app-file", LastModified: ago(2 * HOUR) },
                { Key: "new", LastModified: ago(60_000) },
            ],
        });
        s3Mock.on(HeadObjectCommand, { Key: "old" }).resolves({ ContentLength: 3, ContentType: "text/plain" });
        s3Mock.on(DeleteObjectCommand).resolves({});
        s3Mock
            .on(ListMultipartUploadsCommand)
            .resolvesOnce({
                IsTruncated: true,
                NextKeyMarker: "k",
                NextUploadIdMarker: "u",
                Uploads: [
                    { Initiated: ago(2 * HOUR), Key: "tracked", UploadId: "U1" },
                    { Initiated: ago(2 * HOUR), Key: "orphan", UploadId: "U2" },
                    { Initiated: ago(60_000), Key: "fresh", UploadId: "U3" },
                ],
            })
            // A truncated page repeating its markers would loop forever: purge stops there.
            .resolves({ IsTruncated: true, NextKeyMarker: "k", NextUploadIdMarker: "u", Uploads: [{ Initiated: ago(2 * HOUR), Key: "failing", UploadId: "U4" }] });
        s3Mock.on(AbortMultipartUploadCommand).resolves({});
        s3Mock.on(AbortMultipartUploadCommand, { UploadId: "U4" }).rejects(new Error("access denied"));

        const purged = await createStorage().purge();

        expect(purged.items.map(({ id }) => id).toSorted()).toStrictEqual(["old", "tracked"]);
        expect(s3Mock.commandCalls(DeleteObjectCommand).map(({ args }) => args[0].input.Key)).toStrictEqual(["old"]);
        // The orphan U2 belongs to another client; U4 is ours but its abort fails.
        expect(s3Mock.commandCalls(AbortMultipartUploadCommand).map(({ args }) => args[0].input.UploadId)).toStrictEqual(["U1", "U4"]);
        expect(s3Mock.commandCalls(ListMultipartUploadsCommand)).toHaveLength(2);
        await expect(metaStorage.get("tracked")).rejects.toBeDefined();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Failed to delete file failing during purge"));
    });

    it("should keep a multipart upload written to recently with rolling expiration", async () => {
        expect.assertions(2);

        await metaStorage.save("busy", {
            contentType: "text/plain",
            createdAt: ago(3 * HOUR).toISOString(),
            id: "busy",
            metadata: {},
            modifiedAt: ago(60_000).toISOString(),
            name: "busy",
            UploadId: "U1",
        } as S3File);

        s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
        s3Mock.on(ListMultipartUploadsCommand).resolves({ Uploads: [{ Initiated: ago(3 * HOUR), Key: "busy", UploadId: "U1" }] });
        s3Mock.on(AbortMultipartUploadCommand).resolves({});

        const purged = await createStorage(true).purge();

        expect(purged.items).toHaveLength(0);
        expect(s3Mock.commandCalls(AbortMultipartUploadCommand)).toHaveLength(0);
    });

    it("should page past the first thousand objects", async () => {
        expect.assertions(2);

        await metaStorage.save("late", { contentType: "text/plain", createdAt: ago(2 * HOUR).toISOString(), id: "late", metadata: {}, name: "late", status: "completed" } as S3File);

        s3Mock
            .on(ListObjectsV2Command)
            .resolvesOnce({
                Contents: Array.from({ length: 1000 }, (_, index) => { return { Key: `app-${String(index)}`, LastModified: ago(2 * HOUR) }; }),
                IsTruncated: true,
                NextContinuationToken: "next",
            })
            .resolves({ Contents: [{ Key: "late", LastModified: ago(2 * HOUR) }] });
        s3Mock.on(ListMultipartUploadsCommand).resolves({});
        s3Mock.on(DeleteObjectCommand).resolves({});

        const purged = await createStorage().purge();

        expect(purged.items.map(({ id }) => id)).toStrictEqual(["late"]);
        expect(s3Mock.commandCalls(DeleteObjectCommand).map(({ args }) => args[0].input.Key)).toStrictEqual(["late"]);
    });

    it("should do nothing without a max age", async () => {
        expect.assertions(2);

        const storage = new S3Storage({ bucket: "bucket", metaStorage, region: "us-east-1" });

        await expect(storage.purge()).resolves.toStrictEqual({ items: [], maxAgeMs: undefined });
        expect(s3Mock.commandCalls(ListObjectsV2Command)).toHaveLength(0);
    });
});
