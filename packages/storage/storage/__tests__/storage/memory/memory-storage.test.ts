import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import MemoryStorage from "../../../src/storage/memory/memory-storage";
import { ERRORS } from "../../../src/utils/errors";
import { describeStorageContract } from "../../__helpers__/storage-contract";

describe(MemoryStorage, () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("should report a missing record as FILE_NOT_FOUND", async () => {
        expect.assertions(1);

        await expect(new MemoryMetaStorage().get("missing")).rejects.toHaveProperty("UploadErrorCode", ERRORS.FILE_NOT_FOUND);
    });

    it("should drop the old bytes when an incomplete upload is created again", async () => {
        expect.assertions(1);

        const storage = new MemoryStorage();
        const first = await storage.create({ id: "upload", metadata: {}, size: 10 });

        await storage.write({ body: Readable.from("01234"), contentLength: 5, id: first.id, start: 0 });
        await storage.create({ id: "upload", metadata: {}, size: 2 });
        await storage.write({ body: Readable.from("ab"), contentLength: 2, id: "upload", start: 0 });

        await expect(storage.get({ id: "upload" })).resolves.toHaveProperty("content", Buffer.from("ab"));
    });

    it("should keep the bytes when an upload is moved onto its own stored name", async () => {
        expect.assertions(1);

        const storage = new MemoryStorage({ filename: ({ id }) => `files/${id}.bin` });
        const file = await storage.create({ id: "upload", metadata: {}, size: 5 });

        await storage.write({ body: Readable.from("01234"), contentLength: 5, id: file.id, start: 0 });
        await storage.move("upload", "files/upload.bin");

        await expect(storage.get({ id: "files/upload.bin" })).resolves.toHaveProperty("content", Buffer.from("01234"));
    });

    it("should refuse a part that runs past the upload's size, and a write to an expired upload", async () => {
        expect.assertions(3);

        vi.useFakeTimers({ now: 1_000_000, toFake: ["Date"] });

        const storage = new MemoryStorage({ expiration: { maxAge: "1h" } });
        const file = await storage.create({ id: "upload", metadata: {}, size: 5 });

        await expect(storage.write({ body: Readable.from("0123456789"), contentLength: 10, id: file.id, start: 0 })).rejects.toHaveProperty(
            "UploadErrorCode",
            ERRORS.FILE_CONFLICT,
        );
        await expect(storage.getMeta(file.id)).resolves.toHaveProperty("bytesWritten", 0);

        vi.setSystemTime(1_000_000 + 2 * 60 * 60 * 1000);

        await expect(storage.write({ body: Readable.from("01234"), contentLength: 5, id: file.id, start: 0 })).rejects.toHaveProperty(
            "UploadErrorCode",
            ERRORS.GONE,
        );
    });

    it("should answer exists false only for a missing upload", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage();

        await expect(storage.exists({ id: "missing" })).resolves.toBe(false);

        vi.spyOn(storage.meta, "get").mockRejectedValueOnce(new Error("503 Service Unavailable"));

        await expect(storage.exists({ id: "missing" })).rejects.toThrow("503 Service Unavailable");
    });

    it("should purge uploads stored under a custom filename", async () => {
        expect.assertions(2);

        vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

        const storage = new MemoryStorage({ filename: ({ id }) => `files/${id}.bin` });
        const file = await storage.create({ id: "upload", metadata: {}, size: 5 });

        await storage.write({ body: Readable.from("01234"), contentLength: 5, id: file.id, start: 0 });

        vi.setSystemTime(new Date("2022-02-02T02:00:00Z"));

        const purged = await storage.purge("1h");

        expect(purged.items.map(({ id }) => id)).toStrictEqual(["upload"]);
        expect(storage.raw.size).toBe(0);
    });

    it("should hold the id's lock while merging a write", async () => {
        expect.assertions(3);

        const storage = new MemoryStorage();
        const file = await storage.create({ id: "upload", metadata: {}, size: 4 });
        let written: Promise<unknown> | undefined;

        await storage.withLock(file.id, async () => {
            written = storage.write({ body: Readable.from("ab"), contentLength: 2, id: file.id, start: 0 });

            // Give the write time to read its body and try the lock.
            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            await expect(storage.getMeta(file.id)).resolves.toHaveProperty("bytesWritten", 0);
        });

        // It retries once the lock is free.
        await expect(written).resolves.toHaveProperty("bytesWritten", 2);
        await expect(storage.get({ id: file.id })).resolves.toHaveProperty("content", Buffer.from("ab"));
    });

    it("should apply concurrent writes to the same id one after the other", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage();
        const file = await storage.create({ id: "upload", metadata: {}, size: 8 });

        await Promise.all(
            ["ab", "cd", "ef", "gh"].map(async (body, index) => storage.write({ body: Readable.from(body), contentLength: 2, id: file.id, start: index * 2 })),
        );

        await expect(storage.get({ id: file.id })).resolves.toHaveProperty("content", Buffer.from("abcdefgh"));
        await expect(storage.getMeta(file.id)).resolves.toStrictEqual(expect.objectContaining({ bytesWritten: 8, status: "completed" }));
    });
});

describe.each([
    ["memory", (): MemoryMetaStorage => new MemoryMetaStorage()],
    // Purge then walks `list()`, which yields every stored object, not only uploads.
    ["memory with a meta storage that can't list", (): MemoryMetaStorage => Object.assign(new MemoryMetaStorage(), { list: async () => undefined as never })],
])("%s", (_, createMetaStorage) => {
    describeStorageContract(() => {
        let storage = new MemoryStorage();

        return {
            createStorage: (options) => {
                storage = new MemoryStorage({ metaStorage: createMetaStorage(), ...options });

                return storage;
            },
            failBackend: (failing) => {
                // eslint-disable-next-line sonarjs/no-selector-parameter -- the contract switches failures on and off
                if (failing) {
                    const down = (): never => {
                        throw new Error("backend down");
                    };

                    vi.spyOn(storage.raw, "get").mockImplementation(down);
                    vi.spyOn(storage.raw, "delete").mockImplementation(down);
                } else {
                    vi.restoreAllMocks();
                }
            },
            hasObject: (key) => storage.raw.has(key),
            putObject: (key, content) => {
                const now = new Date().toISOString();

                storage.raw.set(key, { bytes: Buffer.from(content), contentType: "text/plain", createdAt: now, eTag: "\"app\"", metadata: {}, modifiedAt: now });
            },
        };
    }, { "resume across processes": "a MemoryStorage keeps its bytes in the instance; it resumes within one process only" });
});
