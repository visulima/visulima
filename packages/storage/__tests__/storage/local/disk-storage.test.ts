import { join } from "node:path";

import { fs, vol } from "memfs";
import { createRequest } from "node-mocks-http";
import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import DiskStorage from "../../../src/storage/local/disk-storage";
import { metafile, storageOptions } from "../../__helpers__/config";
import FileWriteStream from "../../__helpers__/streams/file-write-stream";
import RequestReadStream from "../../__helpers__/streams/request-read-stream";
import { deepClone } from "../../__helpers__/utils";

// Mock fs modules with memfs
vi.mock(import("node:fs"), async () => {
    const actual = await vi.importActual("node:fs");

    return {
        ...actual,
        ...fs,
    };
});
vi.mock(import("node:fs"), async () => {
    const actual = await vi.importActual("node:fs");

    return {
        ...actual,
        ...fs,
    };
});
vi.mock(import("node:fs/promises"), async () => {
    const actual = await vi.importActual("node:fs/promises");

    return {
        ...actual,
        ...fs.promises,
    };
});
vi.mock(import("@visulima/fs"), async () => {
    const actual = await vi.importActual("@visulima/fs");

    return {
        ...actual,
        ensureFile: async (path: string) => {
            // Ensure directory exists
            const dir = path.slice(0, Math.max(0, path.lastIndexOf("/")));

            await fs.promises.mkdir(dir, { recursive: true });
            // Create empty file
            await fs.promises.writeFile(path, "");
        },
        remove: fs.promises.rm,
        walk: actual.walk, // Keep original walk if it doesn't use fs
    };
});

describe(DiskStorage, () => {
    let directory: string;

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2022-02-02"));

    let options: typeof storageOptions;
    let storage: DiskStorage;
    let readStream: RequestReadStream;

    const request = createRequest();

    const createFile = async (createDummyFile: boolean = true): Promise<void> => {
        storage = new DiskStorage(options);

        const filePath = join(directory, "testfile.mp4");

        await (createDummyFile ? fs.promises.writeFile(filePath, "") : fs.promises.rm(filePath));

        await storage.create(request, deepClone(metafile));
    };

    beforeAll(async () => {
        directory = temporaryDirectory();
        options = { ...storageOptions, directory };
        // Set up memfs volume
        vol.fromJSON({}, directory);
    });

    afterAll(async () => {
        try {
            const { rm } = await import("node:fs/promises");

            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
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
            expect.assertions(4);

            const diskFile = await storage.create(request, metafile);

            expect(diskFile.id).toBeDefined();
            expect(diskFile.bytesWritten).toBe(0);
            expect(diskFile.contentType).toBe(metafile.contentType);
            expect(diskFile.status).toBe("created");

            expectTypeOf(diskFile.expiredAt).toBeNumber();
        });

        it("should reject creation when file size exceeds limits", async () => {
            expect.assertions(2);

            await expect(storage.create(request, { ...metafile, size: 6e10 })).rejects.toThrow();
            await expect(storage.create(request, { ...metafile, size: 6e10 })).rejects.toThrow(/Request entity too large|ValidationError/);
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
            readStream = new RequestReadStream();

            createFile();
        });

        it.todo("should write data and update file status and bytesWritten", async () => {
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

            // Mock the meta storage get method to simulate file not found
            const mockMetaGet = vi.spyOn(storage.meta, "get");

            mockMetaGet.mockRejectedValueOnce(new Error("File not found"));

            try {
                await storage.write({ ...metafile });

                expect.fail("Expected write to reject");
            } catch (error: any) {
                expect(error).toHaveProperty("UploadErrorCode", "FileNotFound");
            } finally {
                mockMetaGet.mockRestore();
            }
        });

        it.todo("should reject write operation when filesystem errors occur", async () => {
            expect.assertions(1);

            const fileWriteStream = new FileWriteStream();

            vi.spyOn(fs, "createWriteStream").mockImplementationOnce(() => fileWriteStream as unknown as fs.WriteStream);

            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockPipeError(fileWriteStream);

            const write = storage.write({ ...metafile, body: readStream, start: 0 });

            await expect(write).rejects.toHaveProperty("UploadErrorCode", "FileError");
        });

        it.todo("should close file and reset bytesWritten when write is aborted", async () => {
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

        it.todo("should reject write operation when range is invalid", async () => {
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

            await expect(Promise.all([write, write2])).rejects.toHaveProperty("UploadErrorCode", "FileLocked");
        });
    });

    describe(".list()", () => {
        beforeEach(() => createFile(false));

        it("should return all user files in storage", async () => {
            expect.assertions(4);

            const items = await storage.list();

            expect(items).toHaveLength(1);
            expect(items[0].id).toBe("/anonymous/testfile.mp4");
            expect(items[0].createdAt).toBeDefined();
            expect(items[0].modifiedAt).toBeDefined();
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

            const { promises: fsp } = await import("node:fs");
            const mockReadFile = vi.spyOn(fsp, "readFile");

            mockReadFile.mockRejectedValueOnce("notfound");

            const deleted = await storage.delete({ id: "notfound" });

            expect(deleted.id).toBe("notfound");
            expect(deleted.status).toBeUndefined();
        });
    });

    describe(".purge()", () => {
        beforeEach(() => createFile(false));

        it("should delete expired files based on age threshold", async () => {
            expect.assertions(1);

            vi.useFakeTimers();
            vi.advanceTimersByTime(6000); // Advance by 6 seconds

            const list = await storage.purge(5); // Purge files older than 5 seconds

            expect(list.items).toHaveLength(1);

            vi.useRealTimers();
        });
    });

    describe(".copy()", () => {
        beforeEach(async () => {
            storage = new DiskStorage(options);

            await storage.create(request, deepClone(metafile));
        });

        it("should copy file to new location", async () => {
            expect.assertions(1);

            // Copy the metadata file to a new location
            await storage.copy(`${metafile.id}.META`, `${directory}/newname1.META`);

            // List should still show only 1 item since it only shows data files, not metadata
            const list = await storage.list();

            expect(list).toHaveLength(1);
        });
    });

    describe(".move()", () => {
        beforeEach(async () => {
            storage = new DiskStorage(options);

            await storage.create(request, deepClone(metafile));
        });

        it("should move file to new location", async () => {
            expect.assertions(1);

            await storage.move(`${metafile.id}.META`, `${directory}/newname2.META`);

            const list = await storage.list();

            expect(list).toHaveLength(1);
        });
    });

    describe("streaming functionality", () => {
        describe(".getStream()", () => {
            // TODO Create dummpy mp4 file
            beforeEach(createFile);

            it("should return streaming file data for existing files", async () => {
                expect.assertions(5);

                const result = await storage.getStream({ id: metafile.id });

                expect(result.stream).toBeDefined();
                expect(result.stream.readable).toBe(true);
                expect(result.size).toBeDefined();
                expect(result.headers).toBeDefined();
                expect(result.headers["Content-Type"]).toBe(metafile.contentType);
            });

            it("should return proper headers for streaming", async () => {
                expect.assertions(4);

                const result = await storage.getStream({ id: metafile.id });

                expect(result.headers["Content-Type"]).toBe(metafile.contentType);
                expect(result.headers["Content-Length"]).toBe(metafile.size.toString());
                expect(result.headers["X-Upload-Expires"]).toBeDefined();
                expect(result.headers["Last-Modified"]).toBeUndefined();
            });

            it.todo("should handle files with expiry dates", async () => {
                expect.assertions(1);

                // Update file metadata to include expiry
                const expiredFile = { ...metafile, expiredAt: new Date(Date.now() + 86_400_000) };

                await storage.meta.save(metafile.id, expiredFile);

                const result = await storage.getStream({ id: metafile.id });

                expect(result.headers["X-Upload-Expires"]).toBe(expiredFile.expiredAt.toISOString());
            });

            it.todo("should throw FileNotFound error for non-existent files", async () => {
                expect.assertions(1);

                await expect(storage.getStream({ id: "nonexistent" })).rejects.toThrow("Not found");
            });

            it("should stream large files efficiently", async () => {
                expect.assertions(2);

                // Create a larger file for testing
                const largeContent = Buffer.alloc(1024 * 1024); // 1MB

                fs.writeFileSync(join(directory, `${metafile.id}.bin`), largeContent);

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
                expect(streamResult.headers["Content-Type"]).toBe(bufferResult.contentType);

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
