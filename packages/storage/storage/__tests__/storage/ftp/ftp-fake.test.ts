import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import FtpStorage from "../../../src/storage/ftp/ftp-storage";
import type { FtpStorageOptions } from "../../../src/storage/ftp/types";
import { resetServer, server } from "../../__helpers__/fakes/ftp";
import { describeStorageContract } from "../../__helpers__/storage-contract";

vi.mock(import("basic-ftp"), async () => import("../../__helpers__/fakes/ftp") as never);

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
        resetServer();
        metaDirectory = join(tmpdir(), `ftp-fake-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(async () => {
        await rm(metaDirectory, { force: true, recursive: true });
    });

    describeStorageContract(
        () => {
            return {
                createStorage: (options) => createStorage({ retryConfig: { maxRetries: 0 }, ...options }),
                failBackend: (failing) => {
                    server.fail = failing ? { "*": Object.assign(new Error("421 Service not available"), { code: 421 }) } : {};
                },
                hasObject: (key) => server.files.has(`uploads/${key}`),
                putObject: (key, content) => {
                    server.files.set(`uploads/${key}`, { body: Buffer.from(content), modifiedAt: new Date() });
                },
            };
        },
    );

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

    it.each([
        [undefined, "home/ftp"],
        ["uploads/", "home/ftp/uploads"],
        ["/srv/uploads/", "srv/uploads"],
    ])("should resolve rootFolderPath %s against the login directory for write, read, list and delete", async (rootFolderPath, directory) => {
        expect.assertions(5);

        // A server that doesn't chroot the user logs it into its home directory.
        server.home = "home/ftp";
        server.dirs.add("home").add("home/ftp");

        const storage = createStorage({ rootFolderPath });
        const id = await upload(storage, "hello");

        expect([...server.files.keys()]).toStrictEqual([`${directory}/${id}`]);
        await expect(storage.get({ id })).resolves.toHaveProperty("content", Buffer.from("hello"));
        await expect(storage.list()).resolves.toStrictEqual([expect.objectContaining({ id })]);

        await storage.delete({ id });

        expect(server.files.size).toBe(0);
        await expect(storage.exists({ id })).resolves.toBe(false);
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
        await expect(text(stream)).resolves.toBe("789");
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
