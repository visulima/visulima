import { createHash } from "node:crypto";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough, Readable } from "node:stream";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DiskStorage from "../../../src/storage/local/disk-storage";
import DiskStorageWithChecksum from "../../../src/storage/local/disk-storage-with-checksum";
import LocalMetaStorage from "../../../src/storage/local/local-meta-storage";
import type { File, FilePart } from "../../../src/storage/utils/file";
import { ERRORS } from "../../../src/utils/errors";
import { waitForStorageReady } from "../../__helpers__/utils";

// eslint-disable-next-line sonarjs/hashing
const md5 = (data: string): string => createHash("md5").update(data).digest("base64");

describe("diskStorage edge cases", () => {
    let directory: string;

    const createStorage = async (options: Partial<ConstructorParameters<typeof DiskStorage>[0]> = {}): Promise<DiskStorage> => {
        const storage = new DiskStorage({ directory, ...options });

        await waitForStorageReady(storage);

        return storage;
    };

    const create = async (storage: DiskStorage, size = 10, extra: Record<string, unknown> = {}): Promise<File> =>
        storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size, ...extra });

    const part = (file: File, body: string, extra: Partial<FilePart> = {}): FilePart => {
        return { body: Readable.from([Buffer.from(body)]), contentLength: Buffer.byteLength(body), id: file.id, start: 0, ...extra };
    };

    beforeEach(() => {
        directory = temporaryDirectory();
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await rm(directory, { force: true, recursive: true });
    });

    describe("create", () => {
        it("should turn a ttl into expiredAt", async () => {
            expect.assertions(2);

            vi.useFakeTimers({ now: 1_000_000, toFake: ["Date"] });

            const storage = await createStorage();

            await expect(create(storage, 10, { ttl: "1h" })).resolves.toStrictEqual(expect.objectContaining({ expiredAt: 1_000_000 + 3_600_000 }));
            await expect(create(storage, 10, { ttl: 5000 })).resolves.toStrictEqual(expect.objectContaining({ expiredAt: 1_000_000 + 5000 }));

            vi.useRealTimers();
        });

        it("should keep an undefined size for a deferred length", async () => {
            expect.assertions(1);

            const storage = await createStorage();
            const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt" });

            expect(file.size).toBeUndefined();
        });
    });

    describe("write", () => {
        it("should leave a completed upload untouched", async () => {
            expect.assertions(2);

            const storage = await createStorage();
            const file = await create(storage, 5);

            await storage.write(part(file, "hello"));

            const again = await storage.write(part(file, "WORLD"));

            expect(again.status).toBe("completed");
            await expect(readFile(join(directory, file.name), "utf8")).resolves.toBe("hello");
        });

        it("should refuse a part that runs past the upload's size", async () => {
            expect.assertions(1);

            const storage = await createStorage();
            const file = await create(storage, 5);

            await expect(storage.write(part(file, "too long"))).rejects.toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.FILE_CONFLICT }));
        });

        it("should truncate the bytes of a checksummed write whose signal aborts", async () => {
            expect.assertions(2);

            const storage = await createStorage();
            const file = await create(storage, 10);
            const body = new PassThrough();
            const controller = new AbortController();
            const written = storage.write({
                ...part(file, ""),
                body,
                checksum: md5("0123456789"),
                checksumAlgorithm: "md5",
                contentLength: 10,
                signal: controller.signal,
            } as FilePart);

            body.write("01234");
            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });
            controller.abort();

            await expect(written).rejects.toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.REQUEST_ABORTED }));
            await expect(stat(join(directory, file.name))).resolves.toStrictEqual(expect.objectContaining({ size: 0 }));
        });

        it("should keep the stored bytes of a checksum-less write whose signal aborts", async () => {
            expect.assertions(2);

            const storage = await createStorage();
            const file = await create(storage, 10);
            const body = new PassThrough();
            const controller = new AbortController();
            const written = storage.write({ ...part(file, ""), body, contentLength: 10, signal: controller.signal } as FilePart);

            body.write("01234");
            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });
            controller.abort();

            const result = await written;

            expect(result.status).toBe("part");
            expect(result.bytesWritten).toBe(5);
        });

        it("should not start a write whose signal is already aborted", async () => {
            expect.assertions(1);

            const storage = await createStorage();
            const file = await create(storage, 10);
            const controller = new AbortController();

            controller.abort();

            await expect(
                storage.write({ ...part(file, "0123456789"), checksum: md5("0123456789"), checksumAlgorithm: "md5", signal: controller.signal } as FilePart),
            ).rejects.toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.REQUEST_ABORTED }));
        });

        it("should reject when the request body fails", async () => {
            expect.assertions(1);

            const storage = await createStorage();
            const file = await create(storage, 10);
            const body = new PassThrough();
            const written = storage.write({ ...part(file, ""), body, contentLength: 10 });

            setTimeout(() => body.destroy(new Error("socket hang up")), 10);

            await expect(written).rejects.toThrow("socket hang up");
        });
    });

    describe("get", () => {
        it("should read only the requested range, with a weak range-aware ETag", async () => {
            expect.assertions(4);

            const storage = await createStorage();
            const file = await create(storage, 10);

            await storage.write(part(file, "0123456789"));

            const ranged = await storage.get({ id: file.id }, { range: { end: 5, start: 2 } });

            expect(ranged.content.toString()).toBe("2345");
            expect(ranged.size).toBe(4);
            expect(ranged.ETag).toMatch(/^W\/".+-2-5"$/u);
            await expect(storage.get({ id: file.id }, { range: { start: 7 } })).resolves.toStrictEqual(expect.objectContaining({ size: 3 }));
        });

        it("should refuse a range outside the file", async () => {
            expect.assertions(1);

            const storage = await createStorage();
            const file = await create(storage, 10);

            await storage.write(part(file, "0123456789"));

            await expect(storage.get({ id: file.id }, { range: { start: 10 } })).rejects.toStrictEqual(
                expect.objectContaining({ UploadErrorCode: ERRORS.BAD_REQUEST }),
            );
        });

        it("should answer FILE_NOT_FOUND when the content is gone but the metadata remains", async () => {
            expect.assertions(3);

            const onError = vi.fn();
            const storage = await createStorage({ onError });
            const file = await create(storage, 10);

            await storage.write(part(file, "0123456789"));
            await rm(join(directory, file.name));

            await expect(storage.get({ id: file.id })).rejects.toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.FILE_NOT_FOUND }));
            await expect(storage.get({ id: file.id }, { range: { start: 0 } })).rejects.toStrictEqual(
                expect.objectContaining({ UploadErrorCode: ERRORS.FILE_NOT_FOUND }),
            );
            expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("ENOENT") }));
        });
    });

    describe("move and copy", () => {
        it("should return the source when moving onto itself", async () => {
            expect.assertions(2);

            const storage = await createStorage();
            const file = await create(storage, 10);

            await storage.write(part(file, "0123456789"));

            await expect(storage.move(file.id, file.id)).resolves.toStrictEqual(expect.objectContaining({ id: file.id }));
            await expect(storage.exists({ id: file.id })).resolves.toBe(true);
        });

        it("should keep the metadata and content of a copy independent from its source", async () => {
            expect.assertions(3);

            const storage = await createStorage();
            const file = await create(storage, 10, { metadata: { owner: "u1" } });

            await storage.write(part(file, "0123456789"));
            await storage.copy(file.id, "copies/one");
            await storage.delete({ id: file.id });

            const copy = await storage.get({ id: "copies/one" });

            expect(copy.content.toString()).toBe("0123456789");
            expect(copy.metadata).toStrictEqual({ owner: "u1" });
            await expect(storage.exists({ id: file.id })).resolves.toBe(false);
        });

        it("should copy and move to nested ids with metadata in a separate directory", async () => {
            expect.assertions(6);

            const storage = await createStorage({ metaStorageConfig: { directory: join(directory, "meta") } });
            const file = await create(storage, 10);

            await storage.write(part(file, "0123456789"));
            await storage.copy(file.id, "copies/deep/one");
            await storage.move(file.id, "moved/two");

            await expect(storage.get({ id: "copies/deep/one" })).resolves.toHaveProperty("content", Buffer.from("0123456789"));
            await expect(storage.get({ id: "moved/two" })).resolves.toHaveProperty("content", Buffer.from("0123456789"));
            await expect(storage.exists({ id: file.id })).resolves.toBe(false);

            const listed = await storage.meta.list();

            expect(listed.map(({ id }) => id).toSorted()).toStrictEqual(["copies/deep/one", "moved/two"]);

            const purged = await storage.purge(-1);

            expect(purged.items.map(({ id }) => id).toSorted()).toStrictEqual(["copies/deep/one", "moved/two"]);
            await expect(storage.meta.list()).resolves.toStrictEqual([]);
        });

        it("should reject unsafe destinations", async () => {
            expect.assertions(2);

            const storage = await createStorage();
            const file = await create(storage, 10);

            await expect(storage.copy(file.id, "../outside")).rejects.toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.INVALID_FILE_NAME }));
            await expect(storage.move(file.id, "/etc/passwd")).rejects.toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.INVALID_FILE_NAME }));
        });
    });

    it("should use a custom meta storage", async () => {
        expect.assertions(2);

        const metaStorage = new LocalMetaStorage({ directory: join(directory, "meta") });
        const storage = await createStorage({ metaStorage });
        const file = await create(storage, 10);

        expect(storage.meta).toBe(metaStorage);
        await expect(stat(metaStorage.getMetaPath(file.id))).resolves.toBeDefined();
    });
});

describe(DiskStorageWithChecksum, () => {
    let directory: string;

    beforeEach(() => {
        directory = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(directory, { force: true, recursive: true });
    });

    it("should report the hash of the stored bytes, also after the upload was reopened", async () => {
        expect.assertions(2);

        const storage = new DiskStorageWithChecksum({ checksum: "sha1", directory });

        await waitForStorageReady(storage);

        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });
        const first = await storage.write({ body: Readable.from([Buffer.from("01234")]), contentLength: 5, id: file.id, start: 0 });
        // eslint-disable-next-line sonarjs/hashing
        const expected = createHash("sha1").update("01234").digest("hex");

        expect(first.hash).toStrictEqual({ algorithm: "sha1", value: expected });

        // A fresh instance has no cached hash and rebuilds it from disk
        const reopened = new DiskStorageWithChecksum({ checksum: "sha1", directory });

        await waitForStorageReady(reopened);

        const meta = await reopened.getMeta(file.id);

        await expect(reopened.saveMeta(meta)).resolves.toStrictEqual(expect.objectContaining({ hash: { algorithm: "sha1", value: expected } }));
    });

    it("should fail a delete of a missing upload like DiskStorage", async () => {
        expect.assertions(2);

        const storage = new DiskStorageWithChecksum({ directory });
        const plain = new DiskStorage({ directory });

        await waitForStorageReady(storage);
        await waitForStorageReady(plain);

        const expected = await plain.delete({ id: "missing" }).catch((error: unknown) => error);

        expect(expected).toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.FILE_NOT_FOUND }));
        await expect(storage.delete({ id: "missing" })).rejects.toStrictEqual(expected);
    });

    it("should throw when deleting the metadata fails", async () => {
        expect.assertions(2);

        const storage = new DiskStorageWithChecksum({ directory });

        await waitForStorageReady(storage);

        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 3 });

        vi.spyOn(storage.meta, "delete").mockRejectedValueOnce(Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" }));

        await expect(storage.delete({ id: file.id })).rejects.toThrow("EACCES");
        await expect(storage.delete({ id: file.id })).resolves.toStrictEqual(expect.objectContaining({ id: file.id, status: "deleted" }));
    });

    it("should rethrow a failing body and forget the partial hash", async () => {
        expect.assertions(3);

        const storage = new DiskStorageWithChecksum({ directory });

        await waitForStorageReady(storage);

        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });
        const body = new PassThrough();
        const written = storage.write({ body, contentLength: 10, id: file.id, start: 0 });

        body.write("01234");
        setTimeout(() => body.destroy(new Error("socket hang up")), 10);

        await expect(written).rejects.toThrow("socket hang up");

        // The next write hashes what is really on disk
        await writeFile(join(directory, file.name), "abcde");

        const resumed = await storage.write({ body: Readable.from([Buffer.from("fghij")]), contentLength: 5, id: file.id, start: 5 });

        expect(resumed.status).toBe("completed");
        // eslint-disable-next-line sonarjs/hashing
        expect(resumed.hash).toStrictEqual({ algorithm: "md5", value: createHash("md5").update("abcdefghij").digest("hex") });
    });
});

describe(LocalMetaStorage, () => {
    let directory: string;

    beforeEach(() => {
        directory = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(directory, { force: true, recursive: true });
    });

    it("should refuse ids resolving outside its directory", () => {
        expect.assertions(1);

        const meta = new LocalMetaStorage({ directory });

        expect(() => meta.getMetaPath("../../etc/passwd")).toThrow(expect.objectContaining({ UploadErrorCode: ERRORS.INVALID_FILE_NAME }));
    });

    it("should read a corrupted record as missing and save no version over a missing one", async () => {
        expect.assertions(2);

        const meta = new LocalMetaStorage({ directory });

        await meta.save("broken", { id: "broken" } as File);
        await writeFile(meta.getMetaPath("broken"), "{not json");

        await expect(meta.get("broken")).rejects.toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.FILE_NOT_FOUND }));
        await expect(meta.saveIfVersion("absent", { id: "absent" } as File, "any")).resolves.toBeUndefined();
    });

    it("should list only its records and touch their modification time", async () => {
        expect.assertions(2);

        const meta = new LocalMetaStorage({ directory });

        await meta.save("one", { id: "one", metadata: { a: "1" } } as unknown as File);
        await writeFile(join(directory, "unrelated.txt"), "x");

        await expect(meta.list()).resolves.toStrictEqual([expect.objectContaining({ id: "one", metadata: { a: "1" } })]);

        const { mtimeMs: before } = await stat(meta.getMetaPath("one"));

        await new Promise((resolve) => {
            setTimeout(resolve, 20);
        });
        await meta.touch("one", { id: "one" } as File);

        const { mtimeMs: after } = await stat(meta.getMetaPath("one"));

        expect(after).toBeGreaterThan(before);
    });
});
