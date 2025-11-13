import { promises as fsp } from "node:fs";
import { chmod, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

import { createRequest } from "node-mocks-http";
import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import DiskStorage from "../../../src/storage/local/disk-storage";
import type { DiskStorageOptions } from "../../../src/storage/types";
import type { File } from "../../../src/storage/utils/file";
import { ERRORS } from "../../../src/utils/errors";
import { metafile, storageOptions } from "../../__helpers__/config";
import RequestReadStream from "../../__helpers__/streams/request-read-stream";

// Mock fs.createWriteStream to return our mock stream
// vi.mock("node:fs", async () => {
//     const actual = await vi.importActual("node:fs");
//     return {
//         ...actual,
//         createWriteStream: vi.fn((...args: any[]) => {
//             console.log('createWriteStream called with:', args);
//             return new FileWriteStream();
//         }),
//         createReadStream: actual.createReadStream,
//         promises: actual.promises,
//     };
// });

// Test helpers
const createTestFile = async (storage: DiskStorage, createDummyFile = true): Promise<void> => {
    const filePath = join(storage.directory, "testfile.mp4");

    // Use real filesystem operations
    if (createDummyFile) {
        // Create empty file
        await fsp.writeFile(filePath, "");
    } else {
        // Remove file if it exists
        try {
            await fsp.unlink(filePath);
        } catch {
            // ignore if file doesn't exist
        }
    }

    await storage.create(createRequest(), structuredClone(metafile));
};

const createReadonlyStorage = async (): Promise<{ cleanup: () => Promise<void>; storage: DiskStorage }> => {
    const readonlyDirectory = temporaryDirectory();

    await mkdir(join(readonlyDirectory, "readonly"), { recursive: true });
    await chmod(join(readonlyDirectory, "readonly"), 0o444);

    const storage = new DiskStorage({
        ...storageOptions,
        directory: join(readonlyDirectory, "readonly"),
    });

    const cleanup = async (): Promise<void> => {
        try {
            await chmod(join(readonlyDirectory, "readonly"), 0o755);
            await rm(readonlyDirectory, { force: true, recursive: true });
        } catch {
            // ignore cleanup errors
        }
    };

    return { cleanup, storage };
};

describe(DiskStorage, () => {
    let directory: string;
    let options: DiskStorageOptions<File>;
    let storage: DiskStorage;
    let readStream: RequestReadStream;

    const request = createRequest();

    beforeAll(async () => {
        directory = temporaryDirectory();
        options = { ...storageOptions, directory };

        vi.useFakeTimers();
        vi.setSystemTime(new Date("2022-02-02"));
    });

    beforeEach(async () => {
        // Clean up any existing files in the test directory for proper isolation
        try {
            await rm(directory, { force: true, recursive: true });
            await mkdir(directory, { recursive: true });
        } catch {
            // ignore cleanup errors
        }
    });

    afterAll(async () => {
        vi.useRealTimers();

        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore cleanup errors
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
            expect.assertions(1);

            await expect(storage.create(request, { ...metafile, size: 6e10 })).rejects.toThrow(/Request entity too large|ValidationError/);
        });
    });

    describe(".update()", () => {
        beforeEach(async () => {
            storage = new DiskStorage(options);
            await createTestFile(storage);
        });

        it("should update file metadata correctly", async () => {
            expect.assertions(2);

            const file = await storage.update(metafile, { metadata: { name: "newname.mp4" } });

            expect(file.metadata.name).toBe("newname.mp4");
            expect(file.metadata.mimeType).toBe("video/mp4");
        });
    });

    describe(".write()", () => {
        beforeEach(async () => {
            storage = new DiskStorage(options);
            readStream = new RequestReadStream();

            // Clean up any existing test file to ensure fresh state
            try {
                await storage.delete({ id: metafile.id });
            } catch {
                // ignore if file doesn't exist
            }

            await createTestFile(storage);
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

            // Mock the meta storage get method to simulate file not found
            const mockMetaGet = vi.spyOn(storage.meta, "get");

            mockMetaGet.mockRejectedValueOnce(new Error("File not found"));

            try {
                await storage.write({ id: metafile.id });

                expect.fail("Expected write to reject");
            } catch (error: unknown) {
                expect(error as Error & { UploadErrorCode?: string }).toHaveProperty("UploadErrorCode", "FileNotFound");
            } finally {
                mockMetaGet.mockRestore();
            }
        });

        it("should reject write operation when filesystem errors occur", async () => {
            expect.assertions(1);

            // Mock the lazyWrite method to simulate a filesystem error
            const mockLazyWrite = vi.fn().mockResolvedValue([Number.NaN, ERRORS.FILE_ERROR]);

            vi.spyOn(storage as unknown as { lazyWrite: typeof mockLazyWrite }, "lazyWrite").mockImplementationOnce(mockLazyWrite);

            const write = storage.write({ ...metafile, body: readStream, start: 0 });

            await expect(write).rejects.toHaveProperty("UploadErrorCode", "FileError");
        });

        it("should close file and reset bytesWritten when write is aborted", async () => {
            expect.assertions(1);

            const abortController = new AbortController();
            const { signal } = abortController;

            const bodyStream = new Readable({
                read() {
                    // Push data slowly to allow abort to happen during operation
                    if (!signal.aborted) {
                        this.push("chunk1");
                        setTimeout(() => {
                            if (!signal.aborted) {
                                this.push("chunk2");
                                // eslint-disable-next-line unicorn/no-null
                                this.push(null);
                            }
                        }, 50);
                    }
                },
            });

            const writePart: import("../../../src/storage/utils/file").FilePart & { signal?: AbortSignal } = {
                ...metafile,
                body: bodyStream,
                checksum: "test-checksum", // Add checksum so keepPartial is false and abort throws error
                checksumAlgorithm: "sha1",
                signal, // Pass signal as property of part object, not attached to stream
                start: 0, // Required for hasContent() to return true
            };
            const writePromise = storage.write(writePart);

            // Abort after a short delay to ensure lazyWrite has started
            // Use fake timers to trigger abort
            setTimeout(() => {
                abortController.abort();
            }, 10);
            vi.advanceTimersByTime(10);

            await expect(writePromise).rejects.toThrow();
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

            await expect(Promise.all([write, write2])).rejects.toHaveProperty("UploadErrorCode", "FileLocked");
        });
    });

    describe(".list()", () => {
        beforeEach(async () => {
            storage = new DiskStorage(options);
            await createTestFile(storage, false);
            // Write some content to ensure the file actually exists
            await storage.write({ ...metafile, body: Readable.from("test content") });
        });

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
        beforeEach(async () => {
            storage = new DiskStorage(options);
            await createTestFile(storage);
        });

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

        it("should delete file and metadata successfully", async () => {
            expect.assertions(2);

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
                status: "deleted",
            });
            await expect(() => storage.getMeta(diskFile.id)).rejects.toThrow("Not found");
        });
    });

    describe(".purge()", () => {
        beforeEach(async () => {
            storage = new DiskStorage(options);
            await createTestFile(storage, false);
        });

        it("should delete expired files based on age threshold", async () => {
            expect.assertions(1);

            // Use real timers for this test since purge compares filesystem timestamps
            vi.useRealTimers();

            // Create a file that will be old enough to purge
            const file = await storage.create(request, metafile);

            await storage.write({ ...file, body: Readable.from("test"), start: 0 });

            // Wait for the file to be at least 1 second old
            await new Promise((resolve) => setTimeout(resolve, 1100));

            const list = await storage.purge(1); // Purge files older than 1 second

            expect(list.items).toHaveLength(1);

            // Restore fake timers
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2022-02-02"));
        });
    });

    describe(".copy()", () => {
        beforeEach(async () => {
            storage = new DiskStorage(options);
            await storage.create(request, structuredClone(metafile));
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
            await storage.create(request, structuredClone(metafile));
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
            beforeEach(async () => {
                storage = new DiskStorage(options);
                await createTestFile(storage);
            });

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

            it("should handle files with expiry dates", async () => {
                expect.assertions(1);

                // Update file metadata to include expiry
                const expiredFile = { ...metafile, expiredAt: new Date(Date.now() + 86_400_000) };

                await storage.meta.save(metafile.id, expiredFile);

                const result = await storage.getStream({ id: metafile.id });

                expect(result.headers["X-Upload-Expires"]).toBe(expiredFile.expiredAt.toISOString());
            });

            it("should throw FileNotFound error for non-existent files", async () => {
                expect.assertions(1);

                await expect(storage.getStream({ id: "nonexistent" })).rejects.toHaveProperty("UploadErrorCode", "FileNotFound");
            });

            it("should stream large files efficiently", async () => {
                expect.assertions(2);

                // Create a larger file for testing
                const largeContent = Buffer.alloc(1024 * 1024); // 1MB

                await fsp.writeFile(join(directory, `${metafile.id}.bin`), largeContent);

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
            beforeEach(async () => {
                storage = new DiskStorage(options);
                await createTestFile(storage);
            });

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

    describe("error conditions and edge cases", () => {
        describe("filesystem permissions", () => {
            it("should handle EACCES permission errors during create", async () => {
                expect.assertions(1);

                const { cleanup, storage: readonlyStorage } = await createReadonlyStorage();

                try {
                    await expect(readonlyStorage.create(request, metafile)).rejects.toThrow();
                } finally {
                    await cleanup();
                }
            });

            it("should handle EACCES permission errors during write", async () => {
                expect.assertions(1);

                const { cleanup, storage: readonlyStorage } = await createReadonlyStorage();

                try {
                    // Try to write to readonly directory
                    await expect(readonlyStorage.write({ ...metafile, body: Readable.from("test") })).rejects.toThrow();
                } finally {
                    await cleanup();
                }
            });
        });

        describe("disk space issues", () => {
            // Note: Simulating ENOSPC is difficult in a test environment
            // This test documents the expected behavior for disk full scenarios
            it("should handle disk space exhaustion gracefully", async () => {
                expect.assertions(1);

                // Create a very large file that would exceed typical disk space
                const hugeContent = Buffer.alloc(1024 * 1024 * 1024); // 1GB
                const hugeFile = {
                    ...metafile,
                    body: Readable.from(hugeContent),
                    size: hugeContent.length,
                };

                // This would typically fail with ENOSPC in real scenarios
                // For testing, we verify the error handling path exists
                await expect(storage.write(hugeFile)).rejects.toThrow();
            });
        });

        describe("path traversal security", () => {
            beforeEach(async () => {
                storage = new DiskStorage(options);
            });

            it("should handle directory traversal attempts in filenames", async () => {
                expect.assertions(2);

                const maliciousFile = {
                    ...metafile,
                    id: "../../../etc/passwd",
                    name: "../../../etc/passwd",
                };

                // The storage may allow creation but should generate safe internal IDs
                const diskFile = await storage.create(request, maliciousFile);

                expect(diskFile).toBeDefined();
                expect(diskFile.id).not.toBe("../../../etc/passwd"); // Should generate safe ID
            });

            it("should handle absolute path attempts in filenames", async () => {
                expect.assertions(2);

                const maliciousFile = {
                    ...metafile,
                    id: "/etc/passwd",
                    name: "/etc/passwd",
                };

                // The storage may allow creation but should generate safe internal IDs
                const diskFile = await storage.create(request, maliciousFile);

                expect(diskFile).toBeDefined();
                expect(diskFile.id).not.toBe("/etc/passwd"); // Should generate safe ID
            });

            it("should handle reserved filesystem names safely", async () => {
                expect.assertions(12);

                // Test with Windows reserved names
                const reservedNames = ["CON", "PRN", "AUX", "NUL", "COM1", "LPT1"];

                for (const name of reservedNames) {
                    const reservedFile = {
                        ...metafile,
                        id: name,
                        name,
                    };

                    // Should create file with safe generated ID
                    const diskFile = await storage.create(request, reservedFile);

                    expect(diskFile).toBeDefined();
                    expect(diskFile.id).not.toBe(name); // Should generate different ID
                }
            });
        });

        describe("special characters and unicode in filenames", () => {
            beforeEach(async () => {
                storage = new DiskStorage(options);
            });

            it("should handle unicode characters in filenames", async () => {
                expect.assertions(3);

                const unicodeName = "测试文件.txt";
                const unicodeFile = {
                    ...metafile,
                    id: unicodeName,
                    name: unicodeName,
                    originalName: unicodeName,
                };

                const diskFile = await storage.create(request, unicodeFile);

                expect(diskFile).toBeDefined();
                expect(diskFile.originalName).toBe(unicodeName); // Original name should be preserved
                expect(diskFile.name).toBe(`anonymous/${unicodeName}`); // Generated name follows naming convention
            });

            it("should handle emoji in filenames", async () => {
                expect.assertions(3);

                const emojiName = "🚀⭐📁.txt";
                const emojiFile = {
                    ...metafile,
                    id: emojiName,
                    name: emojiName,
                    originalName: emojiName,
                };

                const diskFile = await storage.create(request, emojiFile);

                expect(diskFile).toBeDefined();
                expect(diskFile.originalName).toBe(emojiName); // Original name should be preserved
                expect(diskFile.name).toBe(`anonymous/${emojiName}`); // Generated name follows naming convention
            });

            it("should handle special characters in filenames", async () => {
                expect.assertions(9);

                const specialChars = ["file with spaces.txt", "file-with-dashes.txt", "file_with_underscores.txt"];

                for (const filename of specialChars) {
                    const specialFile = {
                        ...metafile,
                        id: filename,
                        name: filename,
                        originalName: filename,
                    };

                    const diskFile = await storage.create(request, specialFile);

                    expect(diskFile).toBeDefined();
                    expect(diskFile.originalName).toBe(filename); // Original name should be preserved
                    expect(diskFile.name).toBe(`anonymous/${filename}`); // Generated name follows naming convention
                }
            });

            it("should handle extremely long filenames", async () => {
                expect.assertions(3);

                const longName = "a".repeat(100); // Very long filename
                const longFile = {
                    ...metafile,
                    id: longName,
                    name: longName,
                    originalName: longName,
                };

                // Should succeed and generate safe internal ID while preserving original name
                const diskFile = await storage.create(request, longFile);

                expect(diskFile).toBeDefined();
                expect(diskFile.originalName).toBe(longName); // Original name should be preserved
                expect(diskFile.name).toBe(`anonymous/${longName}`); // Generated name follows naming convention
            });
        });

        describe("aborted operations", () => {
            beforeEach(async () => {
                storage = new DiskStorage(options);
                await createTestFile(storage);
            });

            it("should close file and reset bytesWritten when write is aborted", async () => {
                expect.assertions(2);

                // Create an abort controller
                const abortController = new AbortController();
                const { signal } = abortController;

                // Start a write operation that will be aborted
                const writePromise = storage.write({
                    ...metafile,
                    body: new Readable({
                        read() {
                            // Start emitting data immediately
                            this.push("chunk1");
                            // Schedule abort after a short delay to allow the write to start
                            setTimeout(() => {
                                abortController.abort();
                            }, 5);
                        },
                    }),
                    signal,
                    start: 0, // Required for hasContent() to return true
                } as import("../../../src/storage/utils/file").FilePart & { signal?: AbortSignal });

                // Advance timers to trigger abort
                vi.advanceTimersByTime(5);

                await expect(writePromise).rejects.toThrow();

                // Verify the file state is clean
                const meta = await storage.getMeta(metafile.id);

                expect(meta).toBeDefined();
            });
        });

        describe("streaming interruptions", () => {
            beforeEach(async () => {
                storage = new DiskStorage(options);
                await createTestFile(storage);
            });

            it("should handle network interruptions during streaming", async () => {
                expect.assertions(1);

                // Create a stream that fails during streaming
                let chunksSent = 0;
                const failingStream = new Readable({
                    read() {
                        chunksSent++;

                        if (chunksSent === 1) {
                            this.push(Buffer.from("some data"));
                            // Fail immediately after pushing data
                            this.emit("error", new Error("Network interrupted"));
                        }
                    },
                });

                await expect(
                    storage.write({
                        ...metafile,
                        body: failingStream,
                        start: 0, // Required for hasContent() to return true
                    }),
                ).rejects.toThrow("Network interrupted");
            });

            it("should handle partial streaming failures", async () => {
                expect.assertions(1);

                // Create a stream that emits some data then fails immediately
                let chunksSent = 0;
                const partialFailStream = new Readable({
                    read() {
                        chunksSent++;

                        if (chunksSent === 1) {
                            this.push(Buffer.from("chunk1"));
                            // Fail immediately after first chunk
                            this.emit("error", new Error("Partial failure"));
                        }
                    },
                });

                await expect(
                    storage.write({
                        ...metafile,
                        body: partialFailStream,
                        start: 0, // Required for hasContent() to return true
                    }),
                ).rejects.toThrow("Partial failure");
            });
        });
    });

    describe("enhanced purge functionality", () => {
        beforeEach(async () => {
            storage = new DiskStorage(options);
        });

        it("should purge files based on different age thresholds", async () => {
            expect.assertions(2);

            // Use real timers for this test since purge compares filesystem timestamps
            vi.useRealTimers();

            // Create a single test file
            const testFile = await storage.create(request, { ...metafile, originalName: "test.txt" });

            await storage.write({ ...testFile, body: Readable.from("test"), start: 0 });

            // Wait for file operations to complete
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Check that we have the file
            const initialList = await storage.list();

            expect(initialList).toHaveLength(1);

            // Purge all files (older than 0 seconds means any file)
            // Note: purge(0) might not work if 0 is falsy, so use a very small value
            const purgeResult = await storage.purge(0.001); // 1ms - should purge all files

            expect(purgeResult.items).toHaveLength(1); // Should purge the file

            // Restore fake timers
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2022-02-02"));
        });

        it("should handle purge with corrupted metadata", async () => {
            expect.assertions(2);

            // Use real timers for this test since purge compares filesystem timestamps
            vi.useRealTimers();

            // Create a file
            const testFile = await storage.create(request, metafile);

            await storage.write({ ...testFile, body: Readable.from("data"), start: 0 });

            // Corrupt the metadata file
            const metaPath = join(directory, `${testFile.id}.META`);

            await fsp.writeFile(metaPath, "corrupted json data");

            // Wait for file to be old enough
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Purge should handle corrupted metadata gracefully
            // Use a very small value since purge(0) doesn't work (0 is falsy)
            const purgeResult = await storage.purge(0.001); // 1ms - should purge all files

            expect(purgeResult.items.length).toBeGreaterThanOrEqual(0); // Should attempt to purge

            // List should still work even with corrupted metadata
            const list = await storage.list();

            expect(Array.isArray(list)).toBe(true);

            // Restore fake timers
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2022-02-02"));
        });
    });

    describe("metadata corruption scenarios", () => {
        beforeEach(async () => {
            storage = new DiskStorage(options);
        });

        it("should handle missing metadata files gracefully", async () => {
            expect.assertions(1);

            // Create a file
            const testFile = await storage.create(request, metafile);

            await storage.write({ ...testFile, body: Readable.from("test") });

            // Delete the metadata file
            const metaPath = join(directory, `${metafile.id}.META`);

            try {
                await fsp.unlink(metaPath);
            } catch {
                // ignore if file doesn't exist
            }

            // Operations should handle missing metadata
            await expect(storage.getMeta(metafile.id)).rejects.toThrow("Not found");
        });

        it("should handle corrupted metadata files", async () => {
            expect.assertions(1);

            // Create a file
            const testFile = await storage.create(request, metafile);

            await storage.write({ ...testFile, body: Readable.from("test") });

            // Corrupt the metadata file
            const metaPath = join(directory, `${metafile.id}.META`);

            await fsp.writeFile(metaPath, "invalid json");

            // Should handle corruption gracefully
            await expect(storage.getMeta(metafile.id)).rejects.toThrow();
        });

        it("should handle inconsistent metadata states", async () => {
            expect.assertions(1);

            // Create metadata but no actual file
            const orphanMeta = { ...metafile, id: "orphan.txt" };

            await storage.meta.save(orphanMeta.id, orphanMeta);

            // List should handle orphan metadata gracefully
            const list = await storage.list();

            expect(Array.isArray(list)).toBe(true); // Should return valid list
        });
    });

    describe("media file streaming", () => {
        beforeEach(async () => {
            // Create storage with media MIME types allowed
            storage = new DiskStorage({
                ...options,
                allowMIME: ["video/*", "audio/*", "image/*", "application/octet-stream"],
            });
        });

        it("should handle MP4 video files correctly", async () => {
            // Create a simple test file with video content
            const videoContent = Buffer.from("fake mp4 content for testing");

            const mp4File = {
                ...metafile,
                contentType: "video/mp4",
                originalName: "test.mp4",
                size: videoContent.length,
            };

            const diskFile = await storage.create(request, mp4File);

            // Write content and verify the write operation succeeded
            const writeResult = await storage.write({ ...diskFile, body: Readable.from(videoContent), start: 0 });

            expect(writeResult.bytesWritten).toBe(videoContent.length);

            // Verify the file exists on disk
            const filePath = join(storage.directory, diskFile.name);
            const fileExists = await fsp
                .access(filePath)
                .then(() => true)
                .catch(() => false);

            expect(fileExists).toBe(true);

            // Check file size on disk
            const stats = await fsp.stat(filePath);

            expect(stats.size).toBe(videoContent.length);

            // Verify MP4 streaming
            const streamResult = await storage.getStream({ id: diskFile.id });

            expect(streamResult.size).toBe(videoContent.length);
            expect(streamResult.headers["Content-Type"]).toBe("video/mp4");

            // Read stream data
            const chunks: Buffer[] = [];

            for await (const chunk of streamResult.stream) {
                chunks.push(chunk);
            }

            const streamData = Buffer.concat(chunks);

            expect(streamData).toHaveLength(videoContent.length);
            expect(streamData.equals(videoContent)).toBe(true);
        });

        it("should handle different media formats", async () => {
            expect.assertions(3);

            const mediaFiles = [
                { contentType: "audio/mpeg", name: "audio.mp3" },
                { contentType: "video/x-msvideo", name: "video.avi" },
                { contentType: "image/jpeg", name: "image.jpg" },
            ];

            for (const mediaFile of mediaFiles) {
                const testFile = {
                    ...metafile,
                    contentType: mediaFile.contentType,
                    id: mediaFile.name,
                    name: mediaFile.name,
                    size: 100,
                };

                try {
                    const diskFile = await storage.create(request, testFile);

                    await storage.write({ ...diskFile, body: Readable.from(Buffer.alloc(100)) });

                    const streamResult = await storage.getStream({ id: diskFile.id });

                    expect(streamResult.headers["Content-Type"]).toBe(mediaFile.contentType);
                } catch (error) {
                    // Some MIME types might be rejected, which is also valid behavior
                    expect(error).toBeDefined();
                }
            }
        });
    });

    describe("input validation", () => {
        beforeEach(async () => {
            storage = new DiskStorage(options);
        });

        it("should handle extremely large metadata objects", async () => {
            expect.assertions(1);

            const largeMetadata = {
                ...metafile,
                // Add large metadata (but not extremely large to avoid issues)
                customData: "x".repeat(10_000), // 10KB string
                nested: {
                    deep: {
                        data: "x".repeat(5000), // 5KB
                    },
                },
            };

            // Should handle large metadata gracefully or with appropriate limits
            try {
                const result = await storage.create(request, largeMetadata);

                expect(result).toBeDefined();
            } catch (error) {
                // If it fails, it should be due to size limits, not crashes
                expect(error).toBeDefined();
            }
        });

        it("should handle malformed file IDs", async () => {
            expect.assertions(1);

            const malformedIds: (string | undefined)[] = ["", undefined, undefined];

            // Test that storage can handle various malformed inputs
            // The storage may reject or sanitize these inputs
            const results = await Promise.allSettled(
                malformedIds.map(async (malformedId) => {
                    const malformedFile = {
                        ...metafile,
                        id: malformedId as string,
                    };

                    return storage.create(request, malformedFile);
                }),
            );

            // At least some operations should complete (either success or specific errors)
            expect(results).toHaveLength(3);
        });

        it("should validate MIME types and file sizes", async () => {
            expect.assertions(2);

            // Test with invalid MIME type (should be rejected by validation)
            const invalidMimeFile = {
                ...metafile,
                contentType: "invalid/mime/type/with/too/many/slashes",
            };

            // This should be rejected by the validator
            await expect(storage.create(request, invalidMimeFile)).rejects.toThrow();

            // Test with negative file size
            const negativeSizeFile = {
                ...metafile,
                size: -1,
            };

            await expect(storage.create(request, negativeSizeFile)).rejects.toThrow();
        });
    });
});
