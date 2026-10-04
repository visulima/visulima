import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Writable } from "node:stream";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import FtpStorage from "../../../src/storage/ftp/ftp-storage";
import type { FtpStorageOptions } from "../../../src/storage/ftp/types";

/**
 * In-memory FTP server behind `basic-ftp`'s Client: a tree of files and directories, uploads
 * into a missing directory are refused like a real server, missing paths answer 550. `fail`
 * makes one client method throw, to inject server/connection errors.
 */
const server = vi.hoisted(() => {
    return {
        dirs: new Set<string>([""]),
        fail: {},
        files: new Map<string, { body: Buffer; modifiedAt: Date }>(),
    };
});

vi.mock(import("basic-ftp"), () => {
    const normalize = (path: string): string => path.replaceAll(/^\/+|\/+$/gu, "");
    const parent = (path: string): string => path.split("/").slice(0, -1).join("/");
    const ftpError = (code: number, message: string): Error => Object.assign(new Error(`${String(code)} ${message}`), { code });

    const check = (method: string): void => {
        const error = server.fail[method];

        if (error) {
            throw error;
        }
    };

    const read = (path: string): Buffer => {
        const file = server.files.get(normalize(path));

        if (!file) {
            throw ftpError(550, "File unavailable");
        }

        return file.body;
    };

    class Client {
        // eslint-disable-next-line class-methods-use-this
        public async access(): Promise<void> {
            check("access");
        }

        // eslint-disable-next-line class-methods-use-this
        public close(): void {}

        // eslint-disable-next-line class-methods-use-this
        public async cd(): Promise<void> {}

        // eslint-disable-next-line class-methods-use-this
        public async ensureDir(path: string): Promise<void> {
            let current = "";

            for (const segment of normalize(path).split("/")) {
                current = current ? `${current}/${segment}` : segment;
                server.dirs.add(current);
            }
        }

        // eslint-disable-next-line class-methods-use-this
        public async uploadFrom(source: Readable, path: string): Promise<void> {
            check("uploadFrom");

            if (!server.dirs.has(parent(normalize(path)))) {
                throw ftpError(553, "Could not create file");
            }

            const chunks: Buffer[] = [];

            for await (const chunk of source) {
                chunks.push(Buffer.from(chunk as Uint8Array));
            }

            server.files.set(normalize(path), { body: Buffer.concat(chunks), modifiedAt: new Date() });
        }

        // eslint-disable-next-line class-methods-use-this
        public async downloadTo(destination: Writable, path: string, startAt = 0): Promise<void> {
            check("downloadTo");

            const body = read(path).subarray(startAt);

            await new Promise<void>((resolve, reject) => {
                destination.on("error", reject);
                destination.on("finish", resolve);
                destination.end(body);
            });
        }

        // eslint-disable-next-line class-methods-use-this
        public async remove(path: string): Promise<void> {
            check("remove");
            read(path);
            server.files.delete(normalize(path));
        }

        // eslint-disable-next-line class-methods-use-this
        public async rename(from: string, to: string): Promise<void> {
            check("rename");

            const file = server.files.get(normalize(from));

            if (!file) {
                throw ftpError(550, "File unavailable");
            }

            server.files.set(normalize(to), file);
            server.files.delete(normalize(from));
        }

        // eslint-disable-next-line class-methods-use-this
        public async size(path: string): Promise<number> {
            check("size");

            return read(path).length;
        }

        // eslint-disable-next-line class-methods-use-this
        public async list(path: string): Promise<{ isDirectory: boolean; isFile: boolean; modifiedAt?: Date; name: string; size: number }[]> {
            check("list");

            const directory = normalize(path === "." ? "" : path);

            if (!server.dirs.has(directory)) {
                throw ftpError(550, "No such directory");
            }

            const children = (name: string): boolean => name !== directory && parent(name) === directory;
            const base = (name: string): string => name.split("/").pop() as string;

            return [
                ...[...server.dirs].filter((name) => children(name)).map((name) => { return { isDirectory: true, isFile: false, name: base(name), size: 0 }; }),
                ...[...server.files]
                    .filter(([name]) => children(name))
                    .map(([name, file]) => { return { isDirectory: false, isFile: true, modifiedAt: file.modifiedAt, name: base(name), size: file.body.length }; }),
                // A symlink-like entry that is neither file nor directory is skipped.
                { isDirectory: false, isFile: false, name: "link", size: 0 },
            ];
        }
    }

    return { Client };
});

const readAll = async (stream: Readable): Promise<string> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk as Uint8Array));
    }

    return Buffer.concat(chunks).toString();
};

describe("ftp storage against an in-memory FTP server", () => {
    let metaDirectory: string;

    const createStorage = (options: Partial<FtpStorageOptions> = {}): FtpStorage =>
        new FtpStorage({
            connection: { host: "ftp.test" },
            metaStorageConfig: { directory: metaDirectory },
            rootFolderPath: "/uploads/",
            ...options,
        });

    const upload = async (storage: FtpStorage, text: string, originalName = "a.txt"): Promise<string> => {
        const file = await storage.create({ contentType: "text/plain", metadata: { owner: "me" }, originalName, size: text.length });

        await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

        return file.id;
    };

    beforeEach(() => {
        server.files.clear();
        server.dirs = new Set([""]);
        server.fail = {};
        metaDirectory = join(tmpdir(), `ftp-fake-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(async () => {
        await rm(metaDirectory, { force: true, recursive: true });
    });

    it("should upload into a fresh directory tree and keep the metadata once completed", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        expect(server.files.get(`uploads/${id}`)?.body.toString()).toBe("hello");
        await expect(storage.getMeta(id)).resolves.toMatchObject({ bytesWritten: 5, metadata: { owner: "me" }, status: "completed" });

        // Creating it again returns the finished upload instead of resetting it.
        await expect(storage.create({ contentType: "text/plain", id, metadata: {}, originalName: "a.txt", size: 5 })).resolves.toMatchObject({
            id,
            status: "completed",
        });
        // Writing to a completed upload is a no-op.
        await expect(storage.write({ body: Readable.from([Buffer.from("x")]), contentLength: 1, id, start: 0 })).resolves.toMatchObject({
            size: 5,
        });
    });

    it("should refuse a second chunk and keep the first part resumable from offset 0", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

        await expect(storage.write({ body: Readable.from([Buffer.from("56789")]), contentLength: 5, id: file.id, start: 5 })).rejects.toMatchObject({
            UploadErrorCode: "MethodNotAllowed",
        });

        // An interrupted transfer leaves nothing behind; the client resends the whole file.
        server.fail.uploadFrom = Object.assign(new Error("connection reset"), { code: "ECONNRESET" });

        await expect(storage.write({ body: Readable.from([Buffer.from("0123456789")]), contentLength: 10, id: file.id, start: 0 }, { retries: 0 })).rejects.toThrow(
            "connection reset",
        );

        server.fail = {};

        await expect(
            storage.write({ body: Readable.from([Buffer.from("0123456789")]), contentLength: 10, id: file.id, start: 0 }),
        ).resolves.toMatchObject({ bytesWritten: 10, status: "completed" });
    });

    it("should read a byte range through get and getStream", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const id = await upload(storage, "0123456789");

        const ranged = await storage.get({ id }, { range: { end: 4, start: 2 } });

        expect(ranged.size).toBe(3);
        expect(ranged.content.toString()).toBe("234");

        const { size, stream } = await storage.getStream({ id }, { range: { start: 7 } } as never);

        expect(size).toBe(3);
        await expect(readAll(stream)).resolves.toBe("789");
    });

    it("should tell a missing file from a failing server", async () => {
        expect.assertions(6);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        server.files.clear();

        await expect(storage.get({ id })).rejects.toMatchObject({ UploadErrorCode: "FileNotFound" });
        await expect(storage.exists({ id })).resolves.toBe(false);
        await expect(storage.getCompletedFile("nope")).resolves.toBeUndefined();

        server.fail.size = Object.assign(new Error("421 Service not available"), { code: 421 });

        await expect(storage.exists({ id })).rejects.toThrow("421");
        await expect(storage.getCompletedFile("nope")).rejects.toThrow("421");

        server.fail = { downloadTo: new Error("426 Connection closed; transfer aborted") };

        await expect(storage.get({ id })).rejects.toThrow("426");
    });

    it("should copy and move a file and its metadata", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        await storage.copy(id, "copy");

        expect(server.files.get("uploads/copy")?.body.toString()).toBe("hello");

        await storage.move("copy", "moved");

        expect([...server.files.keys()].toSorted()).toStrictEqual([`uploads/${id}`, "uploads/moved"].toSorted());
        await expect(storage.getMeta("moved")).resolves.toMatchObject({ path: "/uploads/moved" });
        await expect(storage.getMeta("copy")).rejects.toMatchObject({ UploadErrorCode: "FileNotFound" });
    });

    it("should list nested files under the root only, without metadata files", async () => {
        expect.assertions(3);

        const storage = createStorage({ filename: (file) => `docs/${file.originalName}` });

        await upload(storage, "a", "a.txt");
        await upload(storage, "bb", "b.txt");

        server.files.set("outside.txt", { body: Buffer.from("x"), modifiedAt: new Date() });

        const listed = await storage.list();
        const unrooted = await createStorage({ rootFolderPath: undefined }).list();

        expect(listed.map((file) => [file.id, file.size])).toStrictEqual([
            ["docs/a.txt", 1],
            ["docs/b.txt", 2],
        ]);
        // Without a root folder the keys are the server paths.
        expect(unrooted.map((file) => file.id).toSorted()).toStrictEqual([
            "outside.txt",
            "uploads/docs/a.txt",
            "uploads/docs/b.txt",
        ]);
        // A missing root lists as empty.
        await expect(createStorage({ rootFolderPath: "nowhere" }).list()).resolves.toStrictEqual([]);
    });

    it("should delete the object and metadata, and keep the metadata when the server fails", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        server.fail.remove = new Error("421 Service not available");

        await expect(storage.delete({ id })).rejects.toThrow("421");
        await expect(storage.getMeta(id)).resolves.toMatchObject({ status: "completed" });

        server.fail = {};

        await expect(storage.delete({ id })).resolves.toMatchObject({ status: "deleted" });
        expect(server.files.size).toBe(0);
    });

    it("should purge expired uploads", async () => {
        expect.assertions(3);

        const storage = createStorage({ expiration: { maxAge: "1h" }, filename: (file) => `docs/${file.originalName}` });
        const id = await upload(storage, "old");

        vi.useFakeTimers({ now: Date.now() + 2 * 60 * 60 * 1000 });

        try {
            const purged = await storage.purge();

            expect(purged.items.map((item) => item.id)).toStrictEqual([id]);
            expect(server.files.size).toBe(0);
            await expect(storage.getMeta(id)).rejects.toMatchObject({ UploadErrorCode: "FileNotFound" });
        } finally {
            vi.useRealTimers();
        }
    });

    it("should turn a cancelled operation into an AbortError", async () => {
        expect.assertions(2);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        await expect(storage.get({ id }, { signal: AbortSignal.abort("stop") })).rejects.toMatchObject({ name: "AbortError" });

        const controller = new AbortController();

        server.fail.access = new Error("connection refused");
        controller.abort(new DOMException("bye", "AbortError"));

        await expect(storage.exists({ id }, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    });

    it("should serve the REST handler lifecycle", async () => {
        expect.assertions(5);

        const rest = new RestFetch({ storage: createStorage() });
        const endpoint = "https://app.local/upload";
        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": "10" },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const patched = await rest.fetch(
            new Request(location, {
                body: "0123456789",
                headers: { "content-length": "10", "content-type": "application/octet-stream", "x-chunk-offset": "0" },
                method: "PATCH",
            }),
        );
        const head = await rest.fetch(new Request(location, { method: "HEAD" }));
        const put = await rest.fetch(
            new Request(location, { body: "next", headers: { "content-length": "4", "content-type": "text/plain" }, method: "PUT" }),
        );

        expect([created.status, patched.status, head.status, head.headers.get("x-upload-complete"), put.status]).toStrictEqual([
            201,
            200,
            200,
            "true",
            200,
        ]);

        const [key] = [...server.files.keys()];

        expect(server.files.get(key as string)?.body.toString()).toBe("next");

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect(deleted.status).toBe(204);
        expect(server.files.size).toBe(0);
        await expect(rest.fetch(new Request(location, { method: "HEAD" }))).resolves.toHaveProperty("status", 404);
    });
});
