import { rm } from "node:fs/promises";
import { PassThrough } from "node:stream";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import DiskStorage from "../../../src/storage/local/disk-storage";
import DiskStorageWithChecksum from "../../../src/storage/local/disk-storage-with-checksum";
import { waitForStorageReady } from "../../__helpers__/utils";

// A client that drops while the write still reads the upload's metadata, before any stream
// listener is attached: on a slow disk (Windows CI) the 10 ms the other tests wait is enough.
describe("diskStorage write when the body fails before it is read", () => {
    let directory: string;

    beforeEach(() => {
        directory = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(directory, { force: true, recursive: true });
    });

    it.each([
        ["DiskStorage", DiskStorage],
        ["DiskStorageWithChecksum", DiskStorageWithChecksum],
    ])("%s rejects with the body's error", async (_, Storage) => {
        expect.assertions(1);

        const storage = new Storage({ directory });

        await waitForStorageReady(storage);

        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });
        const body = new PassThrough();
        const written = storage.write({ body, contentLength: 10, id: file.id, start: 0 });

        body.destroy(new Error("socket hang up"));

        await expect(written).rejects.toThrow("socket hang up");
    });
});
