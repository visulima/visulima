import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import MemoryStorage from "../../../src/storage/memory/memory-storage";
import { ERRORS } from "../../../src/utils/errors";
import Locker from "../../../src/utils/locker";

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

    it("should keep a lock held past its TTL while the holder still runs", async () => {
        expect.assertions(1);

        vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

        const storage = new MemoryStorage();

        // The lock TTL is measured on `performance.now()` by default, which fake timers don't drive.
        Object.assign(storage, { locker: new Locker({ max: 1000, maxHoldMs: 15 * 60_000, perf: { now: () => Date.now() }, ttl: 30_000, ttlAutopurge: true }) });

        await storage.withLock("upload", async () => {
            await vi.advanceTimersByTimeAsync(60_000);

            await expect(storage.withLock("upload", async () => undefined)).rejects.toHaveProperty("UploadErrorCode", ERRORS.FILE_LOCKED);
        });
    });
});
