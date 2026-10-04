import { rm } from "node:fs/promises";
import { Readable } from "node:stream";

import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import DiskStorageWithChecksum from "../../../src/storage/local/disk-storage-with-checksum";
import { ERRORS } from "../../../src/utils/errors";
import { metafile, storageOptions } from "../../__helpers__/config";

// Mock file-type
vi.mock(import("file-type"), async () => {
    const actual = await vi.importActual<typeof import("file-type")>("file-type");

    return {
        ...actual,
        fileTypeFromBuffer: vi.fn(),
    };
});

let directory: string;

describe(DiskStorageWithChecksum, () => {
    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    let options: typeof storageOptions & { checksum: "sha1" };

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
        const diskFile = await storage.create({ ...metafile });

        expect(diskFile).toMatchSnapshot("file");

        const file = await storage.write({ ...diskFile, body: Readable.from("01234"), start: 0 });

        // not in the meta
        delete diskFile.ETag;
        delete diskFile.content;
        delete diskFile.hash;
        delete diskFile.modifiedAt;

        expect(file).toMatchSnapshot("file_readable");
    });

    it("should not hash with checksum: false", async () => {
        expect.assertions(2);

        const storage = new DiskStorageWithChecksum({ ...options, checksum: false });
        const diskFile = await storage.create({ ...metafile, id: "no-checksum" });
        const file = await storage.write({ ...diskFile, body: Readable.from("01234"), start: 0 });

        expect(file.bytesWritten).toBe(5);
        await expect(storage.getMeta(file.id)).resolves.not.toHaveProperty("hash");
    });

    it("should delete file and metadata successfully", async () => {
        expect.assertions(2);

        const storage = new DiskStorageWithChecksum(options);
        const diskFile = await storage.create({ ...metafile });

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
                // sha1("01234"): the bytes of the replaced upload are gone
                value: "11904a4e8b77f6242e2d288705023adad00a9310",
            },
            modifiedAt: expect.any(String),
            status: "deleted",
        });
        await expect(() => storage.getMeta(diskFile.id)).rejects.toThrow("Not found");
    });

    it("should call onDelete hook when deleting a file", async () => {
        expect.assertions(2);

        const storage = new DiskStorageWithChecksum(options);
        const onDeleteHook = vi.fn().mockResolvedValue(undefined);

        storage.onDelete = onDeleteHook;

        const diskFile = await storage.create({ ...metafile });

        await storage.write({ ...diskFile, body: Readable.from("01234"), start: 0 });

        const deletedFile = await storage.delete({ id: diskFile.id });

        expect(onDeleteHook).toHaveBeenCalledTimes(1);
        expect(onDeleteHook).toHaveBeenCalledWith(
            expect.objectContaining({
                id: diskFile.id,
                status: "deleted",
            }),
        );
    });

    describe("file type detection", () => {
        it("should detect file type when contentType is undefined", async () => {
            expect.assertions(1);

            const { fileTypeFromBuffer } = await import("file-type");
            const mockFileType = { ext: "png", mime: "image/png" };

            vi.mocked(fileTypeFromBuffer).mockResolvedValue(mockFileType);

            const storage = new DiskStorageWithChecksum(options);
            const uniqueId = `test-png-${Date.now()}-${Math.random()}`;
            const { contentType: _, metadata: __, ...metafileWithoutContentType } = metafile;
            const file = await storage.create({
                ...metafileWithoutContentType,
                contentType: undefined,
                id: uniqueId,
                metadata: {}, // Empty metadata to avoid mimeType extraction
                name: `${uniqueId}.png`,
                size: 18,
            });

            // Create a stream with PNG magic bytes - use a small buffer to avoid timeouts
            const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            const body = Buffer.concat([pngHeader, Buffer.alloc(10, 0x42)]); // Smaller buffer
            const stream = Readable.from(body);

            await storage.write({
                body: stream,
                contentLength: body.length,
                id: file.id,
                start: 0,
            });

            // Get updated file to check contentType
            const updatedFile = await storage.getMeta(file.id);

            expect(updatedFile.contentType).toBe("image/png");
        }, 15_000);

        it("should detect file type when contentType is application/octet-stream", async () => {
            expect.assertions(1);

            const { fileTypeFromBuffer } = await import("file-type");
            const mockFileType = { ext: "jpg", mime: "image/jpeg" };

            vi.mocked(fileTypeFromBuffer).mockResolvedValue(mockFileType);

            const storage = new DiskStorageWithChecksum(options);
            const uniqueId = `test-jpg-${Date.now()}-${Math.random()}`;
            const file = await storage.create({
                ...metafile,
                contentType: "application/octet-stream",
                id: uniqueId,
                name: `${uniqueId}.jpg`,
                size: 14,
            });

            // Create a stream with JPEG magic bytes - use a small buffer
            const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
            const body = Buffer.concat([jpegHeader, Buffer.alloc(10, 0x42)]);
            const stream = Readable.from(body);

            await storage.write({
                body: stream,
                contentLength: body.length,
                id: file.id,
                start: 0,
            });

            // Get updated file to check contentType
            const updatedFile = await storage.getMeta(file.id);

            expect(updatedFile.contentType).toBe("image/jpeg");
        }, 15_000);

        it("should not detect file type when contentType is already set", async () => {
            expect.assertions(1);

            const { fileTypeFromBuffer } = await import("file-type");

            vi.mocked(fileTypeFromBuffer).mockResolvedValue({ ext: "png", mime: "image/png" });

            const storage = new DiskStorageWithChecksum(options);
            const uniqueId = `test-mp4-${Date.now()}-${Math.random()}`;
            const file = await storage.create({
                ...metafile,
                contentType: "video/mp4",
                id: uniqueId,
                name: `${uniqueId}.mp4`,
                size: 4,
            });

            const body = Readable.from(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

            await storage.write({
                body,
                contentLength: 4,
                id: file.id,
                start: 0,
            });

            // Get updated file to check contentType
            const updatedFile = await storage.getMeta(file.id);

            // Should keep original contentType, not detect PNG
            expect(updatedFile.contentType).toBe("video/mp4");
        }, 15_000);

        it("should not detect file type on subsequent writes", async () => {
            expect.assertions(2);

            const { fileTypeFromBuffer } = await import("file-type");
            const mockFileType = { ext: "png", mime: "image/png" };

            vi.mocked(fileTypeFromBuffer).mockResolvedValue(mockFileType);

            const storage = new DiskStorageWithChecksum(options);
            const uniqueId = `test-chunked-${Date.now()}-${Math.random()}`;
            const { contentType: _, metadata: __, ...metafileWithoutContentType } = metafile;
            const file = await storage.create({
                ...metafileWithoutContentType,
                contentType: undefined,
                id: uniqueId,
                metadata: {}, // Empty metadata to avoid mimeType extraction
                name: `${uniqueId}.png`,
                size: 28, // Total size of both chunks
            });

            const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            const body1 = Buffer.concat([pngHeader, Buffer.alloc(10, 0x42)]); // Smaller chunks
            const body2 = Buffer.alloc(10, 0x42);

            // First write - should detect
            const result1 = await storage.write({
                body: Readable.from(body1),
                contentLength: body1.length,
                id: file.id,
                start: 0,
            });

            // Get updated file to check contentType
            const updatedFile1 = await storage.getMeta(result1.id);

            expect(updatedFile1.contentType).toBe("image/png");

            // Reset mock call count
            vi.mocked(fileTypeFromBuffer).mockClear();

            // Second write - should not detect (bytesWritten > 0)
            await storage.write({
                body: Readable.from(body2),
                contentLength: body2.length,
                id: result1.id,
                start: 18, // Start after first chunk
            });

            // fileTypeFromBuffer should not be called on second write
            expect(vi.mocked(fileTypeFromBuffer)).not.toHaveBeenCalled();
        }, 15_000);
    });

    it("should keep checksum error codes", async () => {
        expect.assertions(2);

        const storage = new DiskStorageWithChecksum(options);
        const file = await storage.create({ ...metafile, size: 5 });

        await expect(
            storage.write({ ...file, body: Readable.from("01234"), checksum: "AAAAAAAAAAAAAAAAAAAAAAAAAAA=", checksumAlgorithm: "sha1", start: 0 }),
        ).rejects.toHaveProperty("UploadErrorCode", ERRORS.CHECKSUM_MISMATCH);
        await expect(storage.write({ ...file, body: Readable.from("01234"), checksum: "AAAA", checksumAlgorithm: "crc32", start: 0 })).rejects.toHaveProperty(
            "UploadErrorCode",
            ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM,
        );
    });

    it("should store the real offset and hash after an aborted write", async () => {
        expect.assertions(2);

        const storage = new DiskStorageWithChecksum(options);
        const file = await storage.create({ ...metafile, size: 10 });
        const controller = new AbortController();

        controller.abort();

        const written = await storage.write({ ...file, body: Readable.from("01234"), signal: controller.signal, start: 0 } as Parameters<
            typeof storage.write
        >[0]);

        expect(written.bytesWritten).toBe(0);
        await expect(storage.getMeta(file.id)).resolves.toHaveProperty("bytesWritten", 0);
    });
});
