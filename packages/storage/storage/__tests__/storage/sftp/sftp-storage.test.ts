import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SftpStorage from "../../../src/storage/sftp/sftp-storage";
import type { SftpStorageOptions } from "../../../src/storage/sftp/types";
import { metadata, storageOptions, testfile } from "../../__helpers__/config";

const { control, store } = vi.hoisted(() => {
    return { control: { renameThrows: false, uploadThrows: false }, store: new Map<string, Buffer>() };
});

vi.mock(import("ssh2-sftp-client"), () => {
    const normalize = (path: string): string => path.replace(/^\/+/, "");

    class FakeSftpClient {
        // eslint-disable-next-line class-methods-use-this
        public async connect(): Promise<void> {}

        // eslint-disable-next-line class-methods-use-this
        public async end(): Promise<void> {}

        // eslint-disable-next-line class-methods-use-this
        public async mkdir(): Promise<void> {}

        // eslint-disable-next-line class-methods-use-this
        public async put(input: Buffer, path: string): Promise<void> {
            if (control.uploadThrows) {
                throw new Error("Permission denied");
            }

            store.set(normalize(path), Buffer.from(input));
        }

        // eslint-disable-next-line class-methods-use-this
        public async get(path: string): Promise<Buffer> {
            const data = store.get(normalize(path));

            if (!data) {
                const error = new Error("No such file") as Error & { code: number };

                error.code = 2;

                throw error;
            }

            return data;
        }

        // eslint-disable-next-line class-methods-use-this
        public async delete(path: string): Promise<void> {
            store.delete(normalize(path));
        }

        // eslint-disable-next-line class-methods-use-this
        public async rename(from: string, to: string): Promise<void> {
            if (control.renameThrows) {
                throw new Error("Failure: rename not supported");
            }

            const data = store.get(normalize(from));

            if (data) {
                store.set(normalize(to), data);
                store.delete(normalize(from));
            }
        }

        // eslint-disable-next-line class-methods-use-this
        public async exists(path: string): Promise<false | string> {
            return store.has(normalize(path)) ? "-" : false;
        }

        // eslint-disable-next-line class-methods-use-this
        public async list(): Promise<{ modifyTime: number; name: string; size: number; type: string }[]> {
            return [...store.entries()].map(([name, data]) => {
                return { modifyTime: Date.now(), name, size: data.length, type: "-" };
            });
        }
    }

    return { default: FakeSftpClient };
});

const makeStorage = (metaDirectory: string): SftpStorage =>
    new SftpStorage({
        ...(storageOptions as SftpStorageOptions),
        connection: { host: "localhost", password: "p", username: "u" },
        metaStorageConfig: { directory: metaDirectory },
        rootFolderPath: "uploads",
    });

const writePart = (storage: SftpStorage, id: string) =>
    storage.write({ body: Readable.from([testfile.asBuffer]), contentLength: testfile.asBuffer.length, id, size: testfile.asBuffer.length, start: 0 });

describe(SftpStorage, () => {
    let metaDirectory: string;
    let storage: SftpStorage;

    beforeEach(() => {
        store.clear();
        control.renameThrows = false;
        control.uploadThrows = false;
        metaDirectory = join(tmpdir(), `sftp-meta-${Math.random().toString(36).slice(2)}`);
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
});
