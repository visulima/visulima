import {
    afterEach, beforeEach, describe, expect, it, jest,
} from "@jest/globals";
// eslint-disable-next-line unicorn/prefer-module
import { vol } from "memfs";
// eslint-disable-next-line import/no-namespace
import * as fs from "node:fs";
import { join } from "node:path";
import { createRequest } from "node-mocks-http";

import DiskStorage from "../../../src/storage/local/disk-storage";
import { fsp } from "../../../src/utils/fs";
import { metafile, storageOptions, testRoot } from "../../__helpers__/config";
import FileWriteStream from "../../__helpers__/streams/file-write-stream";
import RequestReadStream from "../../__helpers__/streams/request-read-stream";
import { deepClone } from "../../__helpers__/utils";

jest.mock("fs/promises", () => {
    // eslint-disable-next-line unicorn/prefer-module
    const process = require("node:process");
    process.chdir("/");

    // eslint-disable-next-line unicorn/prefer-module,@typescript-eslint/no-shadow
    const { fs } = require("memfs");

    // eslint-disable-next-line unicorn/prefer-module
    return {
        __esModule: true,
        ...fs.promises,
    };
});

jest.mock("fs", () => {
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

const directory = join(testRoot, "disk-storage");

describe("DiskStorage", () => {
    jest.useFakeTimers({ doNotFake: ["setTimeout"] }).setSystemTime(new Date("2022-02-02"));

    const options = { ...storageOptions, directory };

    let storage: DiskStorage;
    let readStream: RequestReadStream;

    const request = createRequest();
    const createFile = (): Promise<any> => {
        storage = new DiskStorage(options);

        return storage.create(request, deepClone(metafile));
    };

    beforeEach(async () => {
        vol.reset();
    });

    afterEach(async () => {
        vol.reset();
    });

    describe("initialization", () => {
        it("should set directory", () => {
            storage = new DiskStorage(options);

            expect(storage.directory).toBe(directory);
        });
    });

    describe(".create()", () => {
        beforeEach(() => {
            storage = new DiskStorage(options);
        });

        it("should set status and bytesWritten", async () => {
            const diskFile = await storage.create(request, metafile);

            expect(diskFile).toMatchSnapshot();
        });

        it("should reject on limits", async () => {
            await expect(storage.create(request, { ...metafile, size: 6e10 })).rejects.toMatchSnapshot();
        });
    });

    describe(".update()", () => {
        beforeEach(createFile);

        it("should update metadata", async () => {
            const file = await storage.update(metafile, { metadata: { name: "newname.mp4" } });

            expect(file.metadata.name).toBe("newname.mp4");
            expect(file.metadata.mimeType).toBe("video/mp4");
        });
    });

    describe(".write()", () => {
        beforeEach(() => {
            vol.reset();

            readStream = new RequestReadStream();

            return createFile();
        });

        it("should set status and bytesWritten", async () => {
            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockSend();

            const file = await storage.write({ ...metafile, start: 0, body: readStream });

            expect(file.status).toBe("part");
            expect(file.bytesWritten).toBe(5);
        });

        it("should return bytesWritten (resume)", async () => {
            const file = await storage.write({ ...metafile });

            expect(file.bytesWritten).toBe(0);
        });

        it("should reject if file not found", async () => {
            storage.cache.delete(metafile.id);

            const mockReadFile = jest.spyOn(fsp, "readFile");

            mockReadFile.mockRejectedValueOnce(new Error("not found"));

            const write = storage.write({ ...metafile });

            await expect(write).rejects.toHaveProperty("UploadErrorCode", "FileNotFound");
        });

        it("should reject on fs errors", async () => {
            const fileWriteStream = new FileWriteStream();

            jest.spyOn(fs, "createWriteStream").mockImplementationOnce(() => fileWriteStream as unknown as fs.WriteStream);

            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockPipeError(fileWriteStream);

            const write = storage.write({ ...metafile, start: 0, body: readStream });
            await expect(write).rejects.toHaveProperty("UploadErrorCode", "FileError");
        });

        it("should close file and reset bytesWritten on abort", async () => {
            const fileWriteStream = new FileWriteStream();

            jest.spyOn(fs, "createWriteStream").mockImplementationOnce(() => fileWriteStream as unknown as fs.WriteStream);

            const close = jest.spyOn(fileWriteStream, "close");

            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockAbort();

            const file = await storage.write({ ...metafile, start: 0, body: readStream });

            expect(file.bytesWritten).toBeNaN();
            expect(close).toHaveBeenCalled();
        });

        it("should reject on invalid range", async () => {
            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockSend();

            await expect(() => storage.write({ ...metafile, start: (metafile.size as number) - 2, body: readStream })).rejects.toThrow("File conflict");
        });

        it("should support lock", async () => {
            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockSend();

            const write = storage.write({ ...metafile, start: 0, body: readStream });
            const write2 = storage.write({ ...metafile, start: 0, body: readStream });

            // eslint-disable-next-line compat/compat
            await expect(Promise.all([write, write2])).rejects.toHaveProperty("UploadErrorCode", "FileLocked");
        });
    });

    describe(".list()", () => {
        beforeEach(createFile);

        it("should return all user files", async () => {
            const items = await storage.list();

            expect(items).toHaveLength(1);
            expect(items).toMatchSnapshot();
        });
    });

    describe(".delete()", () => {
        beforeEach(createFile);

        it("should set status", async () => {
            const deleted = await storage.delete(metafile);

            expect(deleted.id).toBe(metafile.id);
            expect(deleted.status).toBe("deleted");
        });

        it("should ignore not found", async () => {
            const mockReadFile = jest.spyOn(fsp, "readFile");

            mockReadFile.mockRejectedValueOnce("notfound");

            const deleted = await storage.delete({ id: "notfound" });

            expect(deleted.id).toBe("notfound");
            expect(deleted.status).toBeUndefined();
        });
    });

    describe(".purge()", () => {
        beforeEach(createFile);

        it("should delete file", async () => {
            jest.useFakeTimers();
            jest.advanceTimersByTime(500);

            const list = await storage.purge(5);

            expect(list.items).toHaveLength(1);

            jest.useRealTimers();
        });
    });

    describe(".copy()", () => {
        beforeEach(createFile);

        it("should copy file", async () => {
            await storage.copy(`${metafile.id}.META`, `${directory}/newname1.META`);

            const list = await storage.list();

            expect(list).toHaveLength(2);
        });
    });

    describe(".move()", () => {
        beforeEach(createFile);

        it("should move file", async () => {
            await storage.move(`${metafile.id}.META`, `${directory}/newname2.META`);

            const list = await storage.list();

            expect(list).toHaveLength(1);
        });
    });
});
