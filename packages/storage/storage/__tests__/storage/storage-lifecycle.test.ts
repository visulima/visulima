import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import MemoryStorage from "../../src/storage/memory/memory-storage";
import { BaseStorage } from "../../src/storage/storage";
import type { File } from "../../src/storage/utils/file";
import { ERRORS } from "../../src/utils/errors";

const HOUR = 60 * 60 * 1000;

/** Exposes the lock internals the tests observe. */
type Internals = { locker: { get: (key: string) => string | undefined; set: (key: string, value: string) => void }; unlock: (key: string, token?: string) => Promise<void> };

const internals = (storage: MemoryStorage): Internals => storage as unknown as Internals;

const createUpload = async (storage: MemoryStorage, body = "hello"): Promise<File> => {
    const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: body.length });

    return storage.write({ body: Readable.from([Buffer.from(body)]), contentLength: body.length, id: file.id, start: 0 });
};

describe("baseStorage lifecycle", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe("locks", () => {
        it("should refuse a second holder and release the lock even when the function throws", async () => {
            expect.assertions(3);

            const storage = new MemoryStorage();
            let inner: unknown;

            await expect(
                storage.withLock("a", async () => {
                    inner = await storage.withLock("a", async () => "never").catch((error: unknown) => error);

                    throw new Error("work failed");
                }),
            ).rejects.toThrow("work failed");

            expect(inner).toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.FILE_LOCKED }));
            await expect(storage.withLock("a", async () => "free again")).resolves.toBe("free again");
        });

        it("should answer STORAGE_BUSY once the concurrency limit is reached", async () => {
            expect.assertions(2);

            const storage = new MemoryStorage({ concurrency: 1 });

            await storage.withLock("a", async () => {
                await expect(storage.withLock("b", async () => "b")).rejects.toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.STORAGE_BUSY }));
            });

            await expect(storage.withLock("b", async () => "b")).resolves.toBe("b");
        });

        it("should renew a held lock before its TTL runs out and stop renewing once it is released", async () => {
            expect.assertions(3);

            vi.useFakeTimers();

            const storage = new MemoryStorage();
            const { locker } = internals(storage);
            const set = vi.spyOn(locker, "set");
            let token: string | undefined;

            await storage.withLock("upload", async () => {
                token = locker.get("upload");
                set.mockClear();

                // Longer than the 30 s lock TTL
                await vi.advanceTimersByTimeAsync(35_000);
            });

            expect(set.mock.calls.length).toBeGreaterThanOrEqual(3);
            expect(set).toHaveBeenCalledWith("upload", token);

            set.mockClear();
            await vi.advanceTimersByTimeAsync(60_000);

            expect(set).not.toHaveBeenCalled();
        });

        it("should stop renewing a lock released without its token", async () => {
            expect.assertions(1);

            vi.useFakeTimers();

            const storage = new MemoryStorage();
            const { locker } = internals(storage);

            await storage.withLock("upload", async () => {
                // Legacy unlock: deletes the lock without the token
                await internals(storage).unlock("upload");
            });

            const set = vi.spyOn(locker, "set");

            await vi.advanceTimersByTimeAsync(60_000);

            expect(set).not.toHaveBeenCalled();
        });
    });

    describe("expiration", () => {
        it("should fix expiredAt from createdAt without rolling expiration", async () => {
            expect.assertions(2);

            vi.useFakeTimers({ now: 1_000_000, toFake: ["Date"] });

            const storage = new MemoryStorage({ expiration: { maxAge: "1h" } });
            const file = await createUpload(storage);

            expect(file.expiredAt).toBe(1_000_000 + HOUR);

            vi.setSystemTime(1_000_000 + HOUR / 2);
            await storage.update({ id: file.id }, { metadata: { touched: true } });

            await expect(storage.getMeta(file.id)).resolves.toStrictEqual(expect.objectContaining({ expiredAt: 1_000_000 + HOUR }));
        });

        it("should extend expiredAt on every save with rolling expiration, but never shorten an explicit ttl", async () => {
            expect.assertions(2);

            vi.useFakeTimers({ now: 1_000_000, toFake: ["Date"] });

            const storage = new MemoryStorage({ expiration: { maxAge: "1h", rolling: true } });
            const file = await createUpload(storage);

            vi.setSystemTime(1_000_000 + HOUR / 2);
            await storage.update({ id: file.id }, { metadata: { touched: true } });

            await expect(storage.getMeta(file.id)).resolves.toStrictEqual(expect.objectContaining({ expiredAt: 1_000_000 + HOUR / 2 + HOUR }));

            const longLived = { ...(await storage.getMeta(file.id)), expiredAt: 1_000_000 + 10 * HOUR };

            await storage.saveMeta(longLived);

            await expect(storage.getMeta(file.id)).resolves.toStrictEqual(expect.objectContaining({ expiredAt: 1_000_000 + 10 * HOUR }));
        });

        it("should answer GONE for an expired upload and remove it", async () => {
            expect.assertions(2);

            vi.useFakeTimers({ now: 1_000_000, toFake: ["Date"] });

            const storage = new MemoryStorage({ expiration: { maxAge: "1h" } });
            const file = await createUpload(storage);

            vi.setSystemTime(1_000_000 + 2 * HOUR);

            await expect(storage.checkIfExpired(await storage.getMeta(file.id))).rejects.toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.GONE }));

            // The removal is fire-and-forget
            await vi.waitFor(async () => {
                await expect(storage.exists({ id: file.id })).resolves.toBe(false);
            });
        });
    });

    describe("purge", () => {
        it("should purge by creation time, or by last save with rolling expiration", async () => {
            expect.assertions(4);

            vi.useFakeTimers({ now: 10 * HOUR, toFake: ["Date"] });

            const fixed = new MemoryStorage({ expiration: { maxAge: "1h" } });
            const rolling = new MemoryStorage({ expiration: { maxAge: "1h", rolling: true } });
            const fixedFile = await createUpload(fixed);
            const rollingFile = await createUpload(rolling);

            vi.setSystemTime(11.5 * HOUR);
            await fixed.update({ id: fixedFile.id }, { metadata: { touched: true } });
            await rolling.update({ id: rollingFile.id }, { metadata: { touched: true } });

            const purgedFixed = await fixed.purge();
            const purgedRolling = await rolling.purge();

            expect(purgedFixed.items.map(({ id }) => id)).toStrictEqual([fixedFile.id]);
            expect(purgedFixed.maxAgeMs).toBe(HOUR);
            // Saved half an hour ago: kept, as its prolonged expiredAt says
            expect(purgedRolling.items).toHaveLength(0);

            vi.setSystemTime(13 * HOUR);

            await expect(rolling.purge()).resolves.toStrictEqual(expect.objectContaining({ items: [expect.objectContaining({ id: rollingFile.id })] }));
        });

        it("should keep purging when one deletion fails, and log it", async () => {
            expect.assertions(3);

            vi.useFakeTimers({ now: 10 * HOUR, toFake: ["Date"] });

            const logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
            const storage = new MemoryStorage({ logger: logger as unknown as Console });
            const first = await createUpload(storage);
            const second = await createUpload(storage);
            const { delete: originalDelete } = storage;

            vi.spyOn(storage, "delete").mockImplementation(async (query) => {
                if (query.id === first.id) {
                    throw new Error("disk busy");
                }

                return originalDelete.call(storage, query);
            });

            vi.setSystemTime(12 * HOUR);

            const purged = await storage.purge("1h");

            expect(purged.items.map(({ id }) => id)).toStrictEqual([second.id]);
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`Failed to delete file ${first.id} during purge: disk busy`));
            expect(logger.info).toHaveBeenCalledWith("Purge: removed 1 uploads");
        });

        it("should do nothing without a max age", async () => {
            expect.assertions(1);

            const storage = new MemoryStorage();

            await createUpload(storage);

            await expect(storage.purge()).resolves.toStrictEqual({ items: [], maxAgeMs: undefined });
        });

        it("should purge on the configured interval and log a failing purge", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
            const storage = new MemoryStorage({ expiration: { maxAge: "1h", purgeInterval: "1m" }, logger: logger as unknown as Console });
            const purge = vi.spyOn(storage, "purge").mockRejectedValue(new Error("purge failed"));

            await vi.advanceTimersByTimeAsync(60_000);

            expect(purge).toHaveBeenCalledTimes(1);
            expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: "purge failed" }));

            await storage.close();
        });

        it("should stop purging once closed", async () => {
            expect.assertions(1);

            vi.useFakeTimers();

            const storage = new MemoryStorage({ expiration: { maxAge: "1h", purgeInterval: "1m" } });
            const purge = vi.spyOn(storage, "purge");

            await storage.close();
            storage.stopAutoPurge();
            await vi.advanceTimersByTimeAsync(5 * 60_000);

            expect(purge).not.toHaveBeenCalled();
        });

        it("should reject a purge interval setInterval cannot represent", () => {
            expect.assertions(1);

            expect(() => new MemoryStorage({ expiration: { maxAge: "1h", purgeInterval: 2_147_483_647 } })).toThrow("must be less than 2147483647 ms");
        });
    });

    describe("defaults", () => {
        it("should stream a file with an HTTP-date Last-Modified from the default getStream", async () => {
            expect.assertions(4);

            const storage = new MemoryStorage();
            const file = await createUpload(storage, "streamed");
            const { headers, size, stream } = await BaseStorage.prototype.getStream.call(storage, { id: file.id });
            const chunks: Buffer[] = [];

            for await (const chunk of stream) {
                chunks.push(chunk as Buffer);
            }

            expect(Buffer.concat(chunks).toString()).toBe("streamed");
            expect(size).toBe(8);
            expect(headers?.ETag).toBeDefined();
            expect(headers?.["Last-Modified"]).toBe(new Date(file.modifiedAt as string).toUTCString());
        });

        it("should not implement list, listDirectory or raw on the base class", async () => {
            expect.assertions(3);

            const storage = new MemoryStorage();

            await expect(BaseStorage.prototype.list.call(storage)).rejects.toThrow("Not implemented");
            await expect(storage.listDirectory({ delimiter: "/" })).rejects.toStrictEqual(expect.objectContaining({ UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED }));
            expect(Object.getOwnPropertyDescriptor(BaseStorage.prototype, "raw")?.get?.call(storage)).toBeUndefined();
        });

        it("should redact credentials in the logged configuration", () => {
            expect.assertions(4);

            const logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };

            const storage = new MemoryStorage({ apiKey: "top-secret", logger, nested: { password: "hunter2", region: "eu" } } as never);

            expect(storage.logger).toBe(logger);

            const logged = String(logger.debug.mock.calls[0]?.[0]);

            expect(logged).not.toContain("top-secret");
            expect(logged).not.toContain("hunter2");
            expect(logged).toContain("eu");
        });

        it("should retry a failed access check on the next ensureReady", async () => {
            expect.assertions(3);

            const storage = new MemoryStorage();
            const probe = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);

            (storage as unknown as { startAccessCheck: (probe: () => Promise<unknown>) => void }).startAccessCheck(probe);

            await vi.waitFor(() => {
                expect(probe).toHaveBeenCalledTimes(1);
            });

            await storage.ensureReady();

            expect(probe).toHaveBeenCalledTimes(2);
            expect(storage.isReady).toBe(true);
        });
    });
});
