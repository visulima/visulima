import { join } from "node:path";
import { Readable } from "node:stream";

import { describe, expect, it, jest } from "@jest/globals";
import { createRequest } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import DiskStorageWithChecksum from "../../../src/storage/local/disk-storage-with-checksum";
import { metafile, storageOptions, testRoot } from "../../__helpers__/config";

jest.mock("fs/promises", () => {
    const process = require("node:process");

    process.chdir("/");

    const { fs } = require("memfs");

    return fs.promises;
});

jest.mock("fs", () => {
    const process = require("node:process");

    process.chdir("/");

    const { fs } = require("memfs");

    return fs;
});

// eslint-disable-next-line radar/no-identical-functions
jest.mock("node:fs", () => {
    const process = require("node:process");

    process.chdir("/");

    const { fs } = require("memfs");

    return {
        __esModule: true,
        ...fs,
    };
});

const directory = join(testRoot, "disk-storage", "checksum");

describe(DiskStorageWithChecksum, () => {
    jest.useFakeTimers({ doNotFake: ["setTimeout"] }).setSystemTime(new Date("2022-02-02"));

    const options = { ...storageOptions, checksum: "sha1" as const, directory };
    const request = createRequest();

    it("should support checksum resume from fs", async () => {
        const storage = new DiskStorageWithChecksum(options);
        const diskFile = await storage.create(request, { ...metafile });

        expect(diskFile).toMatchSnapshot();

        const file = await storage.write({ ...diskFile, body: Readable.from("01234"), start: 0 });

        expect(file).toMatchSnapshot();
    });

    it("diskStorageWithChecksum.delete deletes file and metadata", async () => {
        const storage = new DiskStorageWithChecksum(options);
        const diskFile = await storage.create(request, { ...metafile });

        await storage.write({ ...diskFile, body: Readable.from("01234"), start: 0 });

        const deletedFiles = await storage.delete({ id: diskFile.id });

        expect(deletedFiles).toEqual({
            ...diskFile,
            hash: {
                algorithm: "sha1",
                value: "897988093208097ce65f78fd43e99208926103ea",
            },
            status: "deleted",
        });
        await expect(() => storage.getMeta(diskFile.id)).rejects.toThrow("Not found");
    });
});
