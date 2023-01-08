import {
    describe, expect, it, jest,
} from "@jest/globals";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createRequest } from "node-mocks-http";

import DiskStorageWithChecksum from "../../../src/storage/local/disk-storage-with-checksum";
import { metafile, storageOptions, testRoot } from "../../__helpers__/config";

jest.mock("fs/promises", () => {
    // eslint-disable-next-line unicorn/prefer-module
    const process = require("node:process");
    process.chdir("/");

    // eslint-disable-next-line unicorn/prefer-module,@typescript-eslint/no-shadow
    const { fs } = require("memfs");

    return fs.promises;
});

jest.mock("fs", () => {
    // eslint-disable-next-line unicorn/prefer-module
    const process = require("node:process");
    process.chdir("/");

    // eslint-disable-next-line unicorn/prefer-module,@typescript-eslint/no-shadow
    const { fs } = require("memfs");

    return fs;
});

// eslint-disable-next-line radar/no-identical-functions
jest.mock("node:fs", () => {
    // eslint-disable-next-line unicorn/prefer-module
    const process = require("node:process");
    process.chdir("/");

    // eslint-disable-next-line unicorn/prefer-module,@typescript-eslint/no-shadow
    const { fs } = require("memfs");

    // eslint-disable-next-line unicorn/prefer-module
    return {
        __esModule: true,
        ...fs,
    };
});

const directory = join(testRoot, "disk-storage", "checksum");

// eslint-disable-next-line no-secrets/no-secrets
describe("DiskStorageWithChecksum", () => {
    jest.useFakeTimers({ doNotFake: ["setTimeout"] }).setSystemTime(new Date("2022-02-02"));

    const options = { ...storageOptions, directory, checksum: "sha1" as const };
    const request = createRequest();

    it("should support checksum resume from fs", async () => {
        const storage = new DiskStorageWithChecksum(options);
        const diskFile = await storage.create(request, { ...metafile });

        expect(diskFile).toMatchSnapshot();

        const file = await storage.write({ ...diskFile, start: 0, body: Readable.from("01234") });

        expect(file).toMatchSnapshot();
    });

    it("DiskStorageWithChecksum.delete deletes file and metadata", async () => {
        const storage = new DiskStorageWithChecksum(options);
        const diskFile = await storage.create(request, { ...metafile });

        await storage.write({ ...diskFile, start: 0, body: Readable.from("01234") });

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
