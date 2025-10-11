import { rm } from "node:fs/promises";
import { Readable } from "node:stream";

import { createRequest } from "node-mocks-http";
import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import DiskStorageWithChecksum from "../../../src/storage/local/disk-storage-with-checksum";
import { metafile, storageOptions } from "../../__helpers__/config";

let directory: string;

describe(DiskStorageWithChecksum, () => {
    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    let options: typeof storageOptions & { checksum: "sha1" };

    const request = createRequest();

    beforeAll(async () => {
        directory = temporaryDirectory();

        options = { ...storageOptions, checksum: "sha1" as const, directory };
    });

    afterAll(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    it("should support checksum resume from filesystem", async () => {
        expect.assertions(2);

        const storage = new DiskStorageWithChecksum(options);
        const diskFile = await storage.create(request, { ...metafile });

        expect(diskFile).toMatchSnapshot("file");

        const file = await storage.write({ ...diskFile, body: Readable.from("01234"), start: 0 });

        // not in the meta
        delete diskFile.ETag;
        delete diskFile.content;
        delete diskFile.hash;
        delete diskFile.modifiedAt;

        expect(file).toMatchSnapshot("file_readable");
    });

    it("should delete file and metadata successfully", async () => {
        expect.assertions(2);

        const storage = new DiskStorageWithChecksum(options);
        const diskFile = await storage.create(request, { ...metafile });

        await storage.write({ ...diskFile, body: Readable.from("01234"), start: 0 });

        const deletedFiles = await storage.delete({ id: diskFile.id });

        // not in the meta
        delete diskFile.ETag;
        delete diskFile.content;
        delete diskFile.hash;
        delete diskFile.modifiedAt;

        expect(deletedFiles).toStrictEqual({
            ...diskFile,
            bytesWritten: 5,
            hash: {
                algorithm: "sha1",
                value: "897988093208097ce65f78fd43e99208926103ea",
            },
            status: "deleted",
        });
        await expect(() => storage.getMeta(diskFile.id)).rejects.toThrow("Not found");
    });
});
