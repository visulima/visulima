import { GetObjectCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";

import S3Storage from "../../../src/storage/aws/s3-storage";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import { ERRORS } from "../../../src/utils/errors";

vi.mock(import("aws-crt"));

const s3Mock = mockClient(S3Client);

const webStream = (text: string): ReadableStream<Uint8Array> =>
    new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(text.slice(0, 3)));
            controller.enqueue(new TextEncoder().encode(text.slice(3)));
            controller.close();
        },
    });

describe("s3Storage get", () => {
    const createStorage = (): S3Storage => new S3Storage({ bucket: "bucket", metaStorage: new MemoryMetaStorage(), region: "us-east-1" });

    beforeEach(() => {
        s3Mock.reset();
        s3Mock.on(HeadBucketCommand).resolves({});
    });

    it("should read a web stream body with a byte range and split off the original name", async () => {
        expect.assertions(3);

        s3Mock.on(GetObjectCommand).resolves({
            Body: webStream("234567") as never,
            ContentLength: 6,
            ContentType: "text/plain",
            ETag: '"e"',
            Metadata: { originalName: "report.txt", owner: "u1" },
        });

        const file = await createStorage().get({ id: "docs/report" }, { range: { end: 7, start: 2 } });

        expect(s3Mock.commandCalls(GetObjectCommand)[0]?.args[0].input).toStrictEqual({ Bucket: "bucket", Key: "docs/report", Range: "bytes=2-7" });
        expect(file.content.toString()).toBe("234567");
        expect(file).toStrictEqual(expect.objectContaining({ metadata: { owner: "u1" }, originalName: "report.txt" }));
    });

    it("should serve an object whose HTTP Expires caching header is past: it is not the upload's expiry", async () => {
        expect.assertions(3);

        s3Mock.on(GetObjectCommand).resolves({ Body: webStream("x") as never, Expires: new Date(Date.now() - 1000) });

        const storage = createStorage();
        const file = await storage.get({ id: "old" });
        const { headers } = await storage.getStream({ id: "old" });

        expect(file.content.toString()).toBe("x");
        expect(file.expiredAt).toBeUndefined();
        expect(headers).not.toHaveProperty("X-Upload-Expires");
    });

    it("should answer GONE for an upload whose record has expired", async () => {
        expect.assertions(1);

        const metaStorage = new MemoryMetaStorage();

        await metaStorage.save("old", { expiredAt: Date.now() - 1000, id: "old", metadata: {}, name: "old" } as never);

        await expect(new S3Storage({ bucket: "bucket", metaStorage, region: "us-east-1" }).get({ id: "old" })).rejects.toStrictEqual(
            expect.objectContaining({ UploadErrorCode: ERRORS.GONE }),
        );
    });

    it("should refuse a part size below the S3 minimum", () => {
        expect.assertions(1);

        expect(() => new S3Storage({ bucket: "bucket", metaStorage: new MemoryMetaStorage(), partSize: "1MB", region: "us-east-1" })).toThrow(
            "Minimum allowed partSize value is 5MB",
        );
    });
});
