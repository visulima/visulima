import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Writable } from "node:stream";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FtpStorage from "../../../src/storage/ftp/ftp-storage";
import type { FtpStorageOptions } from "../../../src/storage/ftp/types";
import { metadata, storageOptions, testfile } from "../../__helpers__/config";

const { control, store } = vi.hoisted(() => {
    return { control: { renameThrows: false, uploadFailures: 0, uploadThrows: false }, store: new Map<string, Buffer>() };
});

vi.mock(import("basic-ftp"), () => {
    const normalize = (path: string): string => path.replace(/^\/+/, "");

    const drain = async (stream: Readable): Promise<Buffer> => {
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk as Uint8Array));
        }

        return Buffer.concat(chunks);
    };

    class Client {
        // eslint-disable-next-line class-methods-use-this
        public async access(): Promise<void> {}

        // eslint-disable-next-line class-methods-use-this
        public close(): void {}

        // eslint-disable-next-line class-methods-use-this
        public async ensureDir(): Promise<void> {}

        // eslint-disable-next-line class-methods-use-this
        public async cd(): Promise<void> {}

        // eslint-disable-next-line class-methods-use-this
        public async uploadFrom(source: Readable, path: string): Promise<void> {
            if (control.uploadThrows) {
                throw new Error("553 upload not permitted");
            }

            if (control.uploadFailures > 0) {
                control.uploadFailures -= 1;

                const error = new Error("connection reset") as Error & { code: string };

                error.code = "ECONNRESET";

                throw error;
            }

            store.set(normalize(path), await drain(source));
        }

        // eslint-disable-next-line class-methods-use-this
        public async downloadTo(destination: Writable, path: string): Promise<void> {
            const data = store.get(normalize(path));

            if (!data) {
                const error = new Error("550 File unavailable") as Error & { code: number };

                error.code = 550;

                throw error;
            }

            await new Promise<void>((resolve, reject) => {
                destination.on("error", reject);
                destination.on("finish", resolve);
                destination.end(data);
            });
        }

        // eslint-disable-next-line class-methods-use-this
        public async remove(path: string): Promise<void> {
            store.delete(normalize(path));
        }

        // eslint-disable-next-line class-methods-use-this
        public async rename(from: string, to: string): Promise<void> {
            if (control.renameThrows) {
                throw new Error("502 rename not supported");
            }

            const data = store.get(normalize(from));

            if (data) {
                store.set(normalize(to), data);
                store.delete(normalize(from));
            }
        }

        // eslint-disable-next-line class-methods-use-this
        public async size(path: string): Promise<number> {
            const data = store.get(normalize(path));

            if (!data) {
                const error = new Error("550 File unavailable") as Error & { code: number };

                error.code = 550;

                throw error;
            }

            return data.length;
        }

        // eslint-disable-next-line class-methods-use-this
        public async list(): Promise<{ isDirectory: boolean; isFile: boolean; modifiedAt: Date; name: string; size: number }[]> {
            return [...store.entries()].map(([name, data]) => {
                return { isDirectory: false, isFile: true, modifiedAt: new Date(), name, size: data.length };
            });
        }
    }

    return { Client };
});

const makeStorage = (metaDirectory: string): FtpStorage =>
    new FtpStorage({
        ...(storageOptions as FtpStorageOptions),
        connection: { host: "localhost", password: "p", user: "u" },
        metaStorageConfig: { directory: metaDirectory },
        rootFolderPath: "uploads",
    });

const writePart = (storage: FtpStorage, id: string) =>
    storage.write({ body: Readable.from([testfile.asBuffer]), contentLength: testfile.asBuffer.length, id, size: testfile.asBuffer.length, start: 0 });

describe(FtpStorage, () => {
    let metaDirectory: string;
    let storage: FtpStorage;

    beforeEach(() => {
        store.clear();
        control.renameThrows = false;
        control.uploadThrows = false;
        control.uploadFailures = 0;
        metaDirectory = join(tmpdir(), `ftp-meta-${Math.random().toString(36).slice(2)}`);
        storage = makeStorage(metaDirectory);
    });

    afterEach(async () => {
        await rm(metaDirectory, { force: true, recursive: true });
    });

    it("creates, writes and reads a file round-trip", async () => {
        expect.assertions(3);

        const created = await storage.create({ contentType: testfile.contentType, metadata });

        expect(created.status).toBe("created");

        const written = await writePart(storage, created.id);

        expect(written.status).toBe("completed");

        const got = await storage.get({ id: created.id });

        expect(got.content.equals(testfile.asBuffer)).toBe(true);
    });

    it("reports existence and deletes a file", async () => {
        expect.assertions(3);

        const created = await storage.create({ contentType: testfile.contentType, metadata });

        await writePart(storage, created.id);

        await expect(storage.exists({ id: created.id })).resolves.toBe(true);

        const deleted = await storage.delete({ id: created.id });

        expect(deleted.status).toBe("deleted");
        await expect(storage.exists({ id: created.id })).resolves.toBe(false);
    });

    it("copies and moves a file and keeps both retrievable", async () => {
        expect.assertions(5);

        const created = await storage.create({ contentType: testfile.contentType, metadata });

        await writePart(storage, created.id);

        const copied = await storage.copy(created.id, "copy-target");

        expect(copied.name).toBe("copy-target");
        expect(store.has("uploads/copy-target")).toBe(true);

        const gotCopy = await storage.get({ id: "copy-target" });

        expect(gotCopy.content.equals(testfile.asBuffer)).toBe(true);

        const moved = await storage.move(created.id, "move-target");

        expect(moved.name).toBe("move-target");

        const gotMove = await storage.get({ id: "move-target" });

        expect(gotMove.content.equals(testfile.asBuffer)).toBe(true);
    });

    it("throws FILE_NOT_FOUND when getting a missing file", async () => {
        expect.assertions(1);

        const created = await storage.create({ contentType: testfile.contentType, metadata });

        await expect(storage.get({ id: created.id })).rejects.toThrow();
    });

    it("reports a missing file as non-existent", async () => {
        expect.assertions(1);

        await expect(storage.exists({ id: "never-created" })).resolves.toBe(false);
    });

    it("rejects path-traversal destinations on copy", async () => {
        expect.assertions(2);

        const created = await storage.create({ contentType: testfile.contentType, metadata });

        await writePart(storage, created.id);

        await expect(storage.copy(created.id, "../../etc/passwd")).rejects.toThrow();
        expect(store.has("etc/passwd")).toBe(false);
    });

    it("rejects chunked / resumable uploads", async () => {
        expect.assertions(1);

        const created = await storage.create({ contentType: testfile.contentType, metadata });

        await expect(
            storage.write({
                body: Readable.from([testfile.asBuffer]),
                contentLength: testfile.asBuffer.length,
                id: created.id,
                size: testfile.asBuffer.length,
                start: 4,
            }),
        ).rejects.toThrow();
    });

    it("falls back to copy+delete when rename is unsupported", async () => {
        expect.assertions(3);

        const created = await storage.create({ contentType: testfile.contentType, metadata });

        await writePart(storage, created.id);

        control.renameThrows = true;

        const moved = await storage.move(created.id, "move-target");

        expect(moved.name).toBe("move-target");
        expect(store.has("uploads/move-target")).toBe(true);

        const got = await storage.get({ id: "move-target" });

        expect(got.content.equals(testfile.asBuffer)).toBe(true);
    });

    it("throws an AggregateError when rename and the fallback both fail", async () => {
        expect.assertions(2);

        const created = await storage.create({ contentType: testfile.contentType, metadata });

        await writePart(storage, created.id);

        control.renameThrows = true;
        control.uploadThrows = true;

        await expect(storage.move(created.id, "move-target")).rejects.toThrow(AggregateError);
        expect(store.has("uploads/move-target")).toBe(false);
    });

    it("retries a transient upload failure and eventually succeeds", async () => {
        expect.assertions(2);

        const created = await storage.create({ contentType: testfile.contentType, metadata });

        control.uploadFailures = 2;

        const written = await storage.write(
            {
                body: Readable.from([testfile.asBuffer]),
                contentLength: testfile.asBuffer.length,
                id: created.id,
                size: testfile.asBuffer.length,
                start: 0,
            },
            { retries: { initialDelay: 0, maxRetries: 3 } },
        );

        expect(written.status).toBe("completed");
        expect(control.uploadFailures).toBe(0);
    });

    it("aborts a write when the caller signal is already aborted and does not store the file", async () => {
        expect.assertions(2);

        const created = await storage.create({ contentType: testfile.contentType, metadata });
        const controller = new AbortController();

        controller.abort();

        await expect(
            storage.write(
                {
                    body: Readable.from([testfile.asBuffer]),
                    contentLength: testfile.asBuffer.length,
                    id: created.id,
                    size: testfile.asBuffer.length,
                    start: 0,
                },
                { signal: controller.signal },
            ),
        ).rejects.toThrow();

        expect(store.has(`uploads/${created.id}`)).toBe(false);
    });
});
