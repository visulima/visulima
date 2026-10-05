import { Readable } from "node:stream";

import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { S3BaseStorage } from "../../../src/storage/aws/s3-base-storage";
import S3Storage from "../../../src/storage/aws/s3-storage";
import AwsLightStorage from "../../../src/storage/aws-light/aws-light-storage";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import type MetaStorage from "../../../src/storage/meta-storage";
import { ERRORS } from "../../../src/utils/errors";
import { createAwsLightFake } from "../../__helpers__/fakes/aws-light";
import { createS3SdkFake } from "../../__helpers__/fakes/s3-sdk";

vi.mock(import("aws-crt"));

type Setup = () => { create: (metaStorage?: MetaStorage) => S3BaseStorage; objects: Map<string, { body: Buffer }> };

const PROVIDERS: Record<string, Setup> = {
    "aws-light": () => {
        const s3 = createAwsLightFake();

        vi.stubGlobal("fetch", s3.fetch);

        return {
            create: (metaStorage) =>
                new AwsLightStorage({
                    accessKeyId: "id",
                    bucket: "uploads",
                    endpoint: "https://s3.test",
                    metaStorage,
                    region: "auto",
                    retryConfig: { maxRetries: 0 },
                    secretAccessKey: "secret",
                }),
            objects: s3.objects,
        };
    },
    s3: () => {
        const s3 = createS3SdkFake();

        vi.spyOn(S3Client.prototype, "send").mockImplementation(s3.send as never);

        return {
            create: (metaStorage) =>
                new S3Storage({
                    bucket: "bucket",
                    credentials: { accessKeyId: "id", secretAccessKey: "secret" },
                    metaStorage,
                    region: "us-east-1",
                    retryConfig: { maxRetries: 0 },
                }),
            objects: s3.objects,
        };
    },
};

const upload = async (storage: S3BaseStorage, id: string): Promise<void> => {
    await storage.create({ contentType: "text/plain", id, metadata: {}, originalName: "a.txt", size: 3 });
    await storage.write({ body: Readable.from([Buffer.from("abc")]), contentLength: 3, id, start: 0 });
};

const invalidName = { UploadErrorCode: ERRORS.INVALID_FILE_NAME };

describe.each(Object.entries(PROVIDERS))("%s: keys of metadata records", (_name, setup) => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it.each(["report.META", "dir/report.META"])("should refuse %s on every operation and leave the record intact", async (key) => {
        expect.hasAssertions();

        const { create, objects } = setup();
        const storage = create();
        const id = key.slice(0, -".META".length);

        await upload(storage, id);

        const record = objects.get(key)?.body.toString();
        const write = vi.fn();

        expect(JSON.parse(record ?? "{}")).toMatchObject({ id, status: "completed" });

        await expect(storage.create({ contentType: "text/plain", id: key, metadata: {}, originalName: "x", size: 3 })).rejects.toMatchObject(invalidName);
        await expect(storage.write({ body: Readable.from([Buffer.from("xyz")]), contentLength: 3, id: key, start: 0 })).rejects.toThrow();
        await expect(storage.get({ id: key })).rejects.toMatchObject(invalidName);
        await expect(storage.getStream({ id: key })).rejects.toMatchObject(invalidName);
        await expect(storage.exists({ id: key })).rejects.toMatchObject(invalidName);
        await expect(storage.findStoredObject(key)).rejects.toMatchObject(invalidName);
        await expect(storage.getMeta(key)).rejects.toMatchObject({ UploadErrorCode: ERRORS.FILE_NOT_FOUND });
        await expect(storage.delete({ id: key })).rejects.toMatchObject(invalidName);
        await expect(storage.deleteBatch([key])).resolves.toMatchObject({ failedCount: 1, successfulCount: 0 });
        await expect(storage.copy(key, "copy")).rejects.toMatchObject(invalidName);
        await expect(storage.copy(id, key)).rejects.toMatchObject(invalidName);
        await expect(storage.move(key, "moved")).rejects.toMatchObject(invalidName);
        await expect(storage.move(id, key)).rejects.toMatchObject(invalidName);
        await expect(storage.replaceUpload(key, { contentType: "text/plain", metadata: {}, originalName: "x", size: 3 }, write)).rejects.toMatchObject(
            invalidName,
        );
        await expect(storage.getUploadPost(key)).rejects.toMatchObject(invalidName);

        expect(write).not.toHaveBeenCalled();
        expect(objects.get(key)?.body.toString()).toBe(record);
        expect(objects.get(id)?.body.toString()).toBe("abc");
        await expect(storage.list()).resolves.toStrictEqual([expect.objectContaining({ id })]);
    });

    it("should treat such keys as ordinary objects when the metadata is stored elsewhere", async () => {
        expect.assertions(3);

        const { create } = setup();
        const storage = create(new MemoryMetaStorage());

        await upload(storage, "dir/report.META");

        await expect(storage.get({ id: "dir/report.META" })).resolves.toMatchObject({ content: Buffer.from("abc") });
        await expect(storage.exists({ id: "dir/report.META" })).resolves.toBe(true);
        await expect(storage.list()).resolves.toStrictEqual([expect.objectContaining({ id: "dir/report.META" })]);
    });
});
