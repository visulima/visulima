// eslint-disable-next-line import/no-namespace
import * as fs from "node:fs";
import { promises as fsp } from "node:fs";
import { join } from "node:path";

import { vol } from "memfs";
import { createRequest } from "node-mocks-http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DiskStorage from "../../../src/storage/local/disk-storage";
import { metafile, storageOptions, testRoot } from "../../__helpers__/config";
import FileWriteStream from "../../__helpers__/streams/file-write-stream";
import RequestReadStream from "../../__helpers__/streams/request-read-stream";
import { deepClone } from "../../__helpers__/utils";

vi.mock(import("node:fs/promises"), () => {
    const process = require("node:process");

    process.chdir("/");

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const { fs } = require("memfs");

    return {
        __esModule: true,
        ...fs.promises,
    };
});

vi.mock(import("node:fs"), () => {
    const process = require("node:process");

    process.chdir("/");

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const { fs } = require("memfs");

    return {
        __esModule: true,
        ...fs,
    };
});

// eslint-disable-next-line radar/no-identical-functions
vi.mock(import("node:fs"), () => {
    const process = require("node:process");

    process.chdir("/");

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const { fs } = require("memfs");

    return {
        __esModule: true,
        ...fs,
    };
});

const directory = join(testRoot, "disk-storage");

describe(DiskStorage, () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2022-02-02"));

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
        it("should set directory path correctly", () => {
            expect.assertions(1);

            storage = new DiskStorage(options);

            expect(storage.directory).toBe(directory);
        });
    });

    describe(".create()", () => {
        beforeEach(() => {
            storage = new DiskStorage(options);
        });

        it("should create disk file with correct status and bytesWritten", async () => {
            expect.assertions(1);

            const diskFile = await storage.create(request, metafile);

            expect(diskFile).toMatchSnapshot();
        });

        it("should reject creation when file size exceeds limits", async () => {
            expect.assertions(1);

            await expect(storage.create(request, { ...metafile, size: 6e10 })).rejects.toMatchSnapshot();
        });
    });

    describe(".update()", () => {
        beforeEach(createFile);

        it("should update file metadata correctly", async () => {
            expect.assertions(2);

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

        it("should write data and update file status and bytesWritten", async () => {
            expect.assertions(2);

            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockSend();

            const file = await storage.write({ ...metafile, body: readStream, start: 0 });

            expect(file.status).toBe("part");
            expect(file.bytesWritten).toBe(5);
        });

        it("should return bytesWritten when resuming write operation", async () => {
            expect.assertions(1);

            const file = await storage.write({ ...metafile });

            expect(file.bytesWritten).toBe(0);
        });

        it("should reject write operation when file is not found", async () => {
            expect.assertions(1);

            storage.cache.delete(metafile.id);

            const mockReadFile = vi.spyOn(fsp, "readFile");

            mockReadFile.mockRejectedValueOnce(new Error("not found"));

            const write = storage.write({ ...metafile });

            await expect(write).rejects.toHaveProperty("UploadErrorCode", "FileNotFound");
        });

        it("should reject write operation when filesystem errors occur", async () => {
            expect.assertions(1);

            const fileWriteStream = new FileWriteStream();

            vi.spyOn(fs, "createWriteStream").mockImplementationOnce(() => fileWriteStream as unknown as fs.WriteStream);

            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockPipeError(fileWriteStream);

            const write = storage.write({ ...metafile, body: readStream, start: 0 });

            await expect(write).rejects.toHaveProperty("UploadErrorCode", "FileError");
        });

        it("should close file and reset bytesWritten when write is aborted", async () => {
            expect.assertions(2);

            const fileWriteStream = new FileWriteStream();

            vi.spyOn(fs, "createWriteStream").mockImplementationOnce(() => fileWriteStream as unknown as fs.WriteStream);

            const close = vi.spyOn(fileWriteStream, "close");

            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockAbort();

            const file = await storage.write({ ...metafile, body: readStream, start: 0 });

            expect(file.bytesWritten).toBeNaN();
            expect(close).toHaveBeenCalledOnceExactlyOnceWith();
        });

        it("should reject write operation when range is invalid", async () => {
            expect.assertions(1);

            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockSend();

            await expect(() => storage.write({ ...metafile, body: readStream, start: (metafile.size as number) - 2 })).rejects.toThrow("File conflict");
        });

        it("should support file locking to prevent concurrent writes", async () => {
            expect.assertions(1);

            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockSend();

            const write = storage.write({ ...metafile, body: readStream, start: 0 });
            const write2 = storage.write({ ...metafile, body: readStream, start: 0 });

            // eslint-disable-next-line compat/compat
            await expect(Promise.all([write, write2])).rejects.toHaveProperty("UploadErrorCode", "FileLocked");
        });
    });

    describe(".list()", () => {
        beforeEach(createFile);

        it("should return all user files in storage", async () => {
            expect.assertions(2);

            const items = await storage.list();

            expect(items).toHaveLength(1);
            expect(items).toMatchSnapshot();
        });
    });

    describe(".delete()", () => {
        beforeEach(createFile);

        it("should mark file as deleted and return file data", async () => {
            expect.assertions(2);

            const deleted = await storage.delete(metafile);

            expect(deleted.id).toBe(metafile.id);
            expect(deleted.status).toBe("deleted");
        });

        it("should handle deletion of non-existent files gracefully", async () => {
            expect.assertions(2);

            const mockReadFile = vi.spyOn(fsp, "readFile");

            mockReadFile.mockRejectedValueOnce("notfound");

            const deleted = await storage.delete({ id: "notfound" });

            expect(deleted.id).toBe("notfound");
            expect(deleted.status).toBeUndefined();
        });
    });

    describe(".purge()", () => {
        beforeEach(createFile);

        it("should delete expired files based on age threshold", async () => {
            expect.assertions(3);

            vi.useFakeTimers();
            vi.advanceTimersByTime(500);

            const list = await storage.purge(5);

            expect(list.items).toHaveLength(1);

            vi.useRealTimers();
        });
    });

    describe(".copy()", () => {
        beforeEach(createFile);

        it("should copy file to new location", async () => {
            expect.assertions(1);

            await storage.copy(`${metafile.id}.META`, `${directory}/newname1.META`);

            const list = await storage.list();

            expect(list).toHaveLength(2);
        });
    });

    describe(".move()", () => {
        beforeEach(createFile);

        it("should move file to new location", async () => {
            expect.assertions(1);

            await storage.move(`${metafile.id}.META`, `${directory}/newname2.META`);

            const list = await storage.list();

            expect(list).toHaveLength(1);
        });
    });

    describe("streaming functionality", () => {
        describe(".getStream()", () => {
            beforeEach(createFile);

            it("should return streaming file data for existing files", async () => {
                expect.assertions(5);

                const result = await storage.getStream({ id: metafile.id });

                expect(result.stream).toBeDefined();
                expect(result.stream.readable).toBe(true);
                expect(result.size).toBeDefined();
                expect(result.headers).toBeDefined();
                expect(result.headers!["content-type"]).toBe(metafile.contentType);
            });

            it("should return proper headers for streaming", async () => {
                expect.assertions(4);

                const result = await storage.getStream({ id: metafile.id });

                expect(result.headers!["content-type"]).toBe(metafile.contentType);
                expect(result.headers!["content-length"]).toBe(metafile.size.toString());
                expect(result.headers!["x-upload-expires"]).toBeUndefined(); // No expiry set
                expect(result.headers!["last-modified"]).toBeDefined();
            });

            it("should handle files with expiry dates", async () => {
                expect.assertions(1);

                // Update file metadata to include expiry
                const expiredFile = { ...metafile, expiredAt: new Date(Date.now() + 86_400_000) };

                await storage.meta.save(metafile.id, expiredFile);

                const result = await storage.getStream({ id: metafile.id });

                expect(result.headers!["x-upload-expires"]).toBe(expiredFile.expiredAt.toISOString());
            });

            it("should throw FileNotFound error for non-existent files", async () => {
                expect.assertions(1);

                await expect(storage.getStream({ id: "nonexistent" })).rejects.toThrow("Not found");
            });

            it("should stream large files efficiently", async () => {
                expect.assertions(2);

                // Create a larger file for testing
                const largeContent = Buffer.alloc(1024 * 1024); // 1MB

                vol.writeFileSync(join(directory, `${metafile.id}.bin`), largeContent);

                const largeFile = {
                    ...metafile,
                    name: `${metafile.id}.bin`,
                    size: largeContent.length,
                };

                await storage.meta.save(largeFile.id, largeFile);

                const result = await storage.getStream({ id: largeFile.id });

                expect(result.size).toBe(largeContent.length);
                expect(result.stream).toBeDefined();
            });
        });

        describe("integration with get()", () => {
            beforeEach(createFile);

            it("should return same data via get() and getStream()", async () => {
                expect.assertions(3);

                const bufferResult = await storage.get({ id: metafile.id });
                const streamResult = await storage.getStream({ id: metafile.id });

                expect(streamResult.size).toBe(bufferResult.size);
                expect(streamResult.headers!["content-type"]).toBe(bufferResult.contentType);

                // Read stream data
                const chunks: Buffer[] = [];

                for await (const chunk of streamResult.stream) {
                    chunks.push(chunk);
                }

                const streamData = Buffer.concat(chunks);

                expect(streamData.equals(bufferResult.content)).toBe(true);
            });
        });
    });
});
