import { Readable } from "node:stream";

import { HeadObjectCommand, PutObjectCommand, S3Client, UploadPartCopyCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

import S3Storage from "../../../src/storage/aws/s3-storage";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import { ERRORS } from "../../../src/utils/errors";
import { createS3SdkFake, s3Error } from "../../__helpers__/fakes/s3-sdk";

vi.mock(import("aws-crt"));

const GIB = 1024 ** 3;

const setup = () => {
    const s3 = createS3SdkFake();

    vi.spyOn(S3Client.prototype, "send").mockImplementation(s3.send as never);

    const create = (options: Partial<ConstructorParameters<typeof S3Storage>[0]> = {}): S3Storage =>
        new S3Storage({
            bucket: "bucket",
            credentials: { accessKeyId: "id", secretAccessKey: "secret" },
            region: "us-east-1",
            retryConfig: { maxRetries: 0 },
            ...options,
        });

    return { create, s3 };
};

const sentOf = (s3: ReturnType<typeof createS3SdkFake>, name: string) => s3.sent.filter((command) => command.name === name).map(({ input }) => input);

describe("s3Storage hardening", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should let only one of two processes claim an upload: each saved record changes its ETag", async () => {
        expect.assertions(2);

        const { create } = setup();
        const storages = [create(), create()];
        const file = await storages[0]!.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 3 });
        const results = await Promise.allSettled(storages.map(async (storage) => storage.claimWrite(file.id)));

        expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
        expect(results.find(({ status }) => status === "rejected")).toMatchObject({ reason: { UploadErrorCode: ERRORS.FILE_LOCKED } });
    });

    it("should read records stored in the metadata header by older versions", async () => {
        expect.assertions(1);

        const { create, s3 } = setup();
        const record = { contentType: "text/plain", id: "old", metadata: "", name: "old", size: 3, status: "completed" };

        s3.put("old.META", Buffer.alloc(0), { metadata: { metadata: encodeURIComponent(JSON.stringify(record)) } });

        await expect(create().getMeta("old")).resolves.toMatchObject({ metadata: {}, name: "old", status: "completed" });
    });

    it("should refuse an upload, copy or signed upload stored under the key of a metadata record", async () => {
        expect.assertions(5);

        const { create, s3 } = setup();
        const storage = create();
        const report = await storage.create({ contentType: "text/plain", id: "report", metadata: {}, originalName: "report.txt", size: 3 });

        await expect(storage.create({ contentType: "text/plain", id: "report.META", metadata: {}, originalName: "x", size: 3 })).rejects.toMatchObject({
            UploadErrorCode: ERRORS.INVALID_FILE_NAME,
        });
        await expect(storage.copy("report", "report.META")).rejects.toMatchObject({ UploadErrorCode: ERRORS.INVALID_FILE_NAME });
        await expect(storage.getUploadUrl("report.META")).rejects.toMatchObject({ UploadErrorCode: ERRORS.INVALID_FILE_NAME });
        await expect(storage.getMeta(report.id)).resolves.toMatchObject({ id: "report" });
        expect(s3.uploads.size).toBe(1);
    });

    it("should allow such keys when the metadata is stored elsewhere", async () => {
        expect.assertions(1);

        const { create } = setup();

        await expect(
            create({ metaStorage: new MemoryMetaStorage() }).create({ contentType: "text/plain", id: "report.META", metadata: {}, originalName: "x", size: 3 }),
        ).resolves.toMatchObject({ name: "report.META" });
    });

    it("should refuse metadata over the 2 KiB S3 allows before starting a multipart upload", async () => {
        expect.assertions(2);

        const { create, s3 } = setup();

        await expect(
            create().create({ contentType: "text/plain", metadata: { note: "x".repeat(2100) }, originalName: "a.txt", size: 3 }),
        ).rejects.toMatchObject({
            UploadErrorCode: ERRORS.REQUEST_ENTITY_TOO_LARGE,
        });
        expect(sentOf(s3, "CreateMultipartUploadCommand")).toHaveLength(0);
    });

    it("should abort the multipart upload when its record can't be saved", async () => {
        expect.assertions(2);

        const { create, s3 } = setup();

        s3.state.override = (command) => (command instanceof PutObjectCommand ? s3Error("InternalError", 500) : undefined);

        await expect(create().create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 3 })).rejects.toThrow("InternalError");
        expect(s3.uploads.size).toBe(0);
    });

    describe("copies over 5 GiB", () => {
        const size = 6 * GIB;

        /** Answers for a 6 GiB object "big"; copying part `failPart` fails. */
        const bigObject =
            (failPart?: number) =>
            (command: { input: Record<string, unknown> }): unknown => {
                if (command instanceof HeadObjectCommand && command.input.Key === "big") {
                    return { ContentLength: size, ContentType: "video/mp4", ETag: '"b"', Metadata: { originalname: "big.mp4" } };
                }

                if (command instanceof UploadPartCopyCommand) {
                    return command.input.PartNumber === failPart
                        ? s3Error("InternalError", 500)
                        : { CopyPartResult: { ETag: `"p${String(command.input.PartNumber)}"` } };
                }

                return undefined;
            };

        it("should copy part by part, keeping the source's type and metadata", async () => {
            expect.assertions(5);

            const { create, s3 } = setup();

            s3.put("big", Buffer.from("x"));
            s3.state.override = bigObject();

            await create().copy("big", "big copy");

            const ranges = sentOf(s3, "UploadPartCopyCommand").map(({ CopySourceRange }) => CopySourceRange);

            expect(sentOf(s3, "CopyObjectCommand")).toHaveLength(0);
            expect(sentOf(s3, "CreateMultipartUploadCommand")[0]).toMatchObject({
                ContentType: "video/mp4",
                Key: "big copy",
                Metadata: { originalname: "big.mp4" },
            });
            expect(ranges).toHaveLength(size / (16 * 1024 * 1024));
            expect([ranges[0], ranges.at(-1)]).toStrictEqual(["bytes=0-16777215", `bytes=${String(size - 16 * 1024 * 1024)}-${String(size - 1)}`]);
            expect((sentOf(s3, "CompleteMultipartUploadCommand")[0]?.MultipartUpload as { Parts: unknown[] }).Parts).toHaveLength(ranges.length);
        });

        it("should abort the multipart copy when a part fails", async () => {
            expect.assertions(2);

            const { create, s3 } = setup();

            s3.put("big", Buffer.from("x"));
            s3.state.override = bigObject(2);

            await expect(create().copy("big", "big copy")).rejects.toThrow("InternalError");
            expect(s3.uploads.size).toBe(0);
        });
    });

    it("should still copy smaller objects in one request", async () => {
        expect.assertions(2);

        const { create, s3 } = setup();
        const storage = create();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 3 });

        await storage.write({ body: Readable.from([Buffer.from("abc")]), contentLength: 3, id: file.id, start: 0 });
        await storage.copy(file.id, "b.txt");

        expect(sentOf(s3, "CopyObjectCommand")).toHaveLength(1);
        expect(s3.objects.get("b.txt")?.body.toString()).toBe("abc");
    });
});
