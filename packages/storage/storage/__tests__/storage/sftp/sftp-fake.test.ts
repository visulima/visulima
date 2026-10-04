import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import SftpStorage from "../../../src/storage/sftp/sftp-storage";
import type { SftpStorageOptions } from "../../../src/storage/sftp/types";

/**
 * In-memory SFTP server behind `ssh2-sftp-client`: paths are kept as given, so an absolute
 * "/srv/x" and a home-relative "srv/x" are different files, like on a real server. Missing
 * paths fail with SSH_FX_NO_SUCH_FILE (code 2); writes into a missing directory are refused.
 * `fail` makes one client method throw, to inject server/connection errors.
 */
const server = vi.hoisted(() => {
    return {
        dirs: new Set<string>(["", "/"]),
        fail: {},
        files: new Map<string, { body: Buffer; modifyTime: number }>(),
    };
});

vi.mock(import("ssh2-sftp-client"), () => {
    const parent = (path: string): string => {
        const index = path.lastIndexOf("/");

        return index === 0 ? "/" : path.slice(0, Math.max(0, index));
    };
    const noSuchFile = (path: string): Error => Object.assign(new Error(`No such file: ${path}`), { code: 2 });

    const check = (method: string): void => {
        const error = server.fail[method];

        if (error) {
            throw error;
        }
    };

    const read = (path: string): Buffer => {
        const file = server.files.get(path);

        if (!file) {
            throw noSuchFile(path);
        }

        return file.body;
    };

    class Client {
        // eslint-disable-next-line class-methods-use-this
        public async connect(): Promise<void> {
            check("connect");
        }

        // eslint-disable-next-line class-methods-use-this
        public async end(): Promise<boolean> {
            return true;
        }

        // eslint-disable-next-line class-methods-use-this
        public async mkdir(path: string): Promise<void> {
            for (let current = path; !server.dirs.has(current); current = parent(current)) {
                server.dirs.add(current);
            }
        }

        // eslint-disable-next-line class-methods-use-this
        public async put(body: Buffer, path: string): Promise<void> {
            check("put");

            if (!server.dirs.has(parent(path))) {
                throw noSuchFile(parent(path));
            }

            server.files.set(path, { body: Buffer.from(body), modifyTime: Date.now() });
        }

        // eslint-disable-next-line class-methods-use-this
        public async get(path: string, _destination?: unknown, options?: { readStreamOptions?: { end?: number; start?: number } }): Promise<Buffer> {
            check("get");

            const { end, start = 0 } = options?.readStreamOptions ?? {};

            return read(path).subarray(start, end === undefined ? undefined : end + 1);
        }

        // eslint-disable-next-line class-methods-use-this
        public async delete(path: string): Promise<void> {
            check("delete");
            read(path);
            server.files.delete(path);
        }

        // eslint-disable-next-line class-methods-use-this
        public async rename(from: string, to: string): Promise<void> {
            check("rename");

            const body = read(from);

            server.files.set(to, { body, modifyTime: Date.now() });
            server.files.delete(from);
        }

        // eslint-disable-next-line class-methods-use-this
        public async stat(path: string): Promise<{ size: number }> {
            check("stat");

            return { size: read(path).length };
        }

        // eslint-disable-next-line class-methods-use-this
        public async exists(path: string): Promise<false | "-" | "d"> {
            check("exists");

            if (server.files.has(path)) {
                return "-";
            }

            return server.dirs.has(path) ? "d" : false;
        }

        // eslint-disable-next-line class-methods-use-this
        public async list(path: string): Promise<{ modifyTime: number; name: string; size: number; type: string }[]> {
            check("list");

            const directory = path === "." ? "" : path;

            if (!server.dirs.has(directory)) {
                throw noSuchFile(directory);
            }

            const children = (name: string): boolean => name !== directory && name !== "/" && parent(name) === directory;
            const base = (name: string): string => name.slice(name.lastIndexOf("/") + 1);

            return [
                ...[...server.dirs].filter((name) => children(name)).map((name) => { return { modifyTime: 0, name: base(name), size: 0, type: "d" }; }),
                ...[...server.files]
                    .filter(([name]) => children(name))
                    .map(([name, file]) => { return { modifyTime: file.modifyTime, name: base(name), size: file.body.length, type: "-" }; }),
                { modifyTime: 0, name: "link", size: 0, type: "l" },
            ];
        }
    }

    return { default: Client };
});

describe("sftp storage against an in-memory SFTP server", () => {
    let metaDirectory: string;

    const createStorage = (options: Partial<SftpStorageOptions> = {}): SftpStorage =>
        new SftpStorage({
            connection: { host: "sftp.test" },
            metaStorageConfig: { directory: metaDirectory },
            rootFolderPath: "uploads/",
            ...options,
        });

    const upload = async (storage: SftpStorage, text: string, originalName = "a.txt"): Promise<string> => {
        const file = await storage.create({ contentType: "text/plain", metadata: { owner: "me" }, originalName, size: text.length });

        await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

        return file.id;
    };

    beforeEach(() => {
        server.files.clear();
        server.dirs = new Set(["", "/"]);
        server.fail = {};
        metaDirectory = join(tmpdir(), `sftp-fake-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(async () => {
        await rm(metaDirectory, { force: true, recursive: true });
    });

    it("should upload into a fresh directory tree and keep the metadata once completed", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        expect(server.files.get(`uploads/${id}`)?.body.toString()).toBe("hello");
        await expect(storage.getMeta(id)).resolves.toMatchObject({ bytesWritten: 5, metadata: { owner: "me" }, status: "completed" });
        await expect(storage.create({ contentType: "text/plain", id, metadata: {}, originalName: "a.txt", size: 5 })).resolves.toMatchObject({
            status: "completed",
        });
    });

    it("should keep an absolute root folder absolute", async () => {
        expect.assertions(2);

        const storage = createStorage({ rootFolderPath: "/srv/uploads" });
        const id = await upload(storage, "hello");

        const listed = await storage.list();

        expect([...server.files.keys()]).toStrictEqual([`/srv/uploads/${id}`]);
        expect(listed.map((file) => file.id)).toStrictEqual([id]);
    });

    it("should refuse a second chunk and accept the whole file again after an interrupted transfer", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

        await expect(storage.write({ body: Readable.from([Buffer.from("56789")]), contentLength: 5, id: file.id, start: 5 })).rejects.toMatchObject({
            UploadErrorCode: "MethodNotAllowed",
        });

        server.fail.put = Object.assign(new Error("connection reset"), { code: "ECONNRESET" });

        await expect(storage.write({ body: Readable.from([Buffer.from("0123456789")]), contentLength: 10, id: file.id, start: 0 }, { retries: 0 })).rejects.toThrow(
            "connection reset",
        );

        server.fail = {};

        await expect(
            storage.write({ body: Readable.from([Buffer.from("0123456789")]), contentLength: 10, id: file.id, start: 0 }),
        ).resolves.toMatchObject({ bytesWritten: 10, status: "completed" });
    });

    it("should read a byte range through get and getStream", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const id = await upload(storage, "0123456789");

        const ranged = await storage.get({ id }, { range: { end: 4, start: 2 } });

        expect(ranged.content.toString()).toBe("234");

        const { size, stream } = await storage.getStream({ id }, { range: { start: 7 } } as never);

        expect(size).toBe(3);
        await expect(text(stream)).resolves.toBe("789");
    });

    it("should tell a missing file from a failing server", async () => {
        expect.assertions(7);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        server.files.clear();

        await expect(storage.get({ id })).rejects.toMatchObject({ UploadErrorCode: "FileNotFound" });
        await expect(storage.exists({ id })).resolves.toBe(false);
        await expect(storage.exists({ id: "never-uploaded" })).resolves.toBe(false);
        await expect(storage.getCompletedFile("nope")).resolves.toBeUndefined();

        server.fail = { exists: new Error("Permission denied"), get: new Error("Permission denied"), stat: new Error("Permission denied") };

        await expect(storage.exists({ id })).rejects.toThrow("Permission denied");
        await expect(storage.getCompletedFile("nope")).rejects.toThrow("Permission denied");
        await expect(storage.get({ id })).rejects.toThrow("Permission denied");
    });

    it("should not report a directory as an existing file", async () => {
        expect.assertions(1);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        server.files.clear();
        server.dirs.add(`uploads/${id}`);

        await expect(storage.exists({ id })).resolves.toBe(false);
    });

    it("should copy and move a file and its metadata", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        await storage.copy(id, "copy");
        await storage.move("copy", "moved");

        expect([...server.files.keys()].toSorted()).toStrictEqual([`uploads/${id}`, "uploads/moved"].toSorted());
        await expect(storage.getMeta("moved")).resolves.toMatchObject({ path: "uploads/moved" });
        await expect(storage.getMeta("copy")).rejects.toMatchObject({ UploadErrorCode: "FileNotFound" });
    });

    it("should list nested files under the root only, without metadata files", async () => {
        expect.assertions(3);

        const storage = createStorage({ filename: (file) => `docs/${file.originalName}` });

        await upload(storage, "a", "a.txt");
        await upload(storage, "bb", "b.txt");

        server.files.set("outside.txt", { body: Buffer.from("x"), modifyTime: 0 });

        const listed = await storage.list();
        const unrooted = await createStorage({ rootFolderPath: undefined }).list();

        expect(listed.map((file) => [file.id, file.size])).toStrictEqual([
            ["docs/a.txt", 1],
            ["docs/b.txt", 2],
        ]);
        expect(unrooted.map((file) => file.id).toSorted()).toStrictEqual([
            "outside.txt",
            "uploads/docs/a.txt",
            "uploads/docs/b.txt",
        ]);
        await expect(createStorage({ rootFolderPath: "nowhere" }).list()).resolves.toStrictEqual([]);
    });

    it("should delete the object and metadata, and keep the metadata when the server fails", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        server.fail.delete = new Error("Permission denied");

        await expect(storage.delete({ id })).rejects.toThrow("Permission denied");
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

        server.fail.connect = new Error("connection refused");
        controller.abort(new DOMException("bye", "AbortError"));

        await expect(storage.exists({ id }, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    });

    it("should serve the REST handler lifecycle", async () => {
        expect.assertions(4);

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
        expect([...server.files.values()].map((file) => file.body.toString())).toStrictEqual(["next"]);

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect([deleted.status, server.files.size]).toStrictEqual([204, 0]);
        await expect(rest.fetch(new Request(location, { method: "HEAD" }))).resolves.toHaveProperty("status", 404);
    });
});
