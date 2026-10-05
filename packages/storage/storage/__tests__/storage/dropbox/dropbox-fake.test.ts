import { Readable } from "node:stream";
import { text } from "node:stream/consumers";

import { DropboxResponseError } from "dropbox";
import { describe, expect, it } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import type DropboxFile from "../../../src/storage/dropbox/dropbox-file";
import DropboxStorage from "../../../src/storage/dropbox/dropbox-storage";
import type { DropboxStorageOptions } from "../../../src/storage/dropbox/types";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import { ERRORS } from "../../../src/utils/errors";
import { describeStorageContract } from "../../__helpers__/storage-contract";

type Stored = { body: Buffer; modified: string; rev: string };

const PAGE_SIZE = 2;

const pathError = (tag: string): DropboxResponseError<unknown> =>
    new DropboxResponseError(409, {}, { error: { ".tag": "path", path: { ".tag": tag } }, error_summary: `path/${tag}/` });

/**
 * In-memory Dropbox answering the SDK calls DropboxStorage makes. Lookups of a path that is a folder
 * answer like Dropbox does; `failNext` makes the next call of the named method throw, `failing.all`
 * every call.
 */
const createDropbox = () => {
    const objects = new Map<string, Stored>();
    const folders = new Set<string>();
    const failNext = new Map<string>();
    const sessions = new Map<string, Buffer[]>();
    let revision = 0;

    const failing = { all: false };

    const guard = (method: string): void => {
        if (failing.all) {
            throw Object.assign(new Error("Internal Server Error"), { status: 500 });
        }

        const error = failNext.get(method);

        if (error !== undefined) {
            failNext.delete(method);

            throw error;
        }
    };

    const put = (path: string, body: Buffer) => {
        revision += 1;

        const stored = { body, modified: new Date().toISOString(), rev: `r${String(revision)}` };

        objects.set(path, stored);

        return { result: { ".tag": "file", name: path.split("/").pop(), path_display: path, rev: stored.rev, server_modified: stored.modified, size: body.length } };
    };

    const lookup = (path: string): Stored => {
        const stored = objects.get(path);

        if (!stored) {
            throw pathError("not_found");
        }

        return stored;
    };

    const page = (entries: unknown[], offset: number, limit: number) => {
        const size = Math.min(limit, PAGE_SIZE);

        return {
            result: {
                cursor: String(offset + size),
                entries: entries.slice(offset, offset + size),
                has_more: offset + size < entries.length,
            },
        };
    };

    let listing: unknown[] = [];
    let listLimit = PAGE_SIZE;

    const client = {
        auth: { getAccessToken: () => "token", setAccessToken: () => undefined },
        filesCopyV2: async ({ from_path, to_path }: { from_path: string; to_path: string }) => {
            guard("filesCopyV2");
            put(to_path, lookup(from_path).body);

            return { result: {} };
        },
        filesDeleteV2: async ({ path }: { path: string }) => {
            guard("filesDeleteV2");
            lookup(path);
            objects.delete(path);

            return { result: {} };
        },
        filesDownload: async ({ path }: { path: string }) => {
            guard("filesDownload");

            const stored = lookup(path);

            return { result: { fileBinary: new Uint8Array(stored.body), name: path.split("/").pop(), rev: stored.rev, server_modified: stored.modified, size: stored.body.length } };
        },
        filesGetMetadata: async ({ path }: { path: string }) => {
            guard("filesGetMetadata");

            if (folders.has(path)) {
                return { result: { ".tag": "folder", name: path.split("/").pop() } };
            }

            const stored = lookup(path);

            return { result: { ".tag": "file", name: path.split("/").pop(), rev: stored.rev, size: stored.body.length } };
        },
        filesListFolder: async ({ limit, path }: { limit: number; path: string }) => {
            guard("filesListFolder");

            // Dropbox accepts a limit of 1 to 2000 only.
            if (limit < 1 || limit > 2000) {
                throw new Error("Error in call to API function \"files/list_folder\": request body: limit: 4000 is not within range [1, 2000]");
            }

            listing = [
                ...[...folders].filter((folder) => folder.startsWith(`${path}/`)).map((folder) => { return { ".tag": "folder", path_display: folder }; }),
                ...[...objects]
                    .filter(([key]) => key.startsWith(`${path}/`))
                    .map(([key, stored]) => { return {
                        ".tag": "file",
                        name: key.split("/").pop(),
                        path_display: key,
                        rev: stored.rev,
                        server_modified: stored.modified,
                        size: stored.body.length,
                    }; }),
            ];
            listLimit = limit;

            return page(listing, 0, listLimit);
        },
        filesListFolderContinue: async ({ cursor }: { cursor: string }) => page(listing, Number(cursor), listLimit),
        filesMoveV2: async ({ from_path, to_path }: { from_path: string; to_path: string }) => {
            put(to_path, lookup(from_path).body);
            objects.delete(from_path);

            return { result: {} };
        },
        filesUpload: async ({ contents, path }: { contents: Buffer; path: string }) => {
            guard("filesUpload");

            return put(path, Buffer.from(contents));
        },
        filesUploadSessionAppendV2: async ({ contents, cursor }: { contents: Buffer; cursor: { offset: number; session_id: string } }) => {
            const chunks = sessions.get(cursor.session_id) as Buffer[];

            if (cursor.offset !== Buffer.concat(chunks).length) {
                throw pathError("incorrect_offset");
            }

            chunks.push(Buffer.from(contents));

            return { result: null };
        },
        filesUploadSessionFinish: async ({
            commit,
            contents,
            cursor,
        }: {
            commit: { path: string };
            contents: Buffer;
            cursor: { offset: number; session_id: string };
        }) => {
            const chunks = sessions.get(cursor.session_id) as Buffer[];

            if (cursor.offset !== Buffer.concat(chunks).length) {
                throw pathError("incorrect_offset");
            }

            sessions.delete(cursor.session_id);

            return put(commit.path, Buffer.concat([...chunks, Buffer.from(contents)]));
        },
        filesUploadSessionStart: async ({ contents }: { contents: Buffer }) => {
            const id = `s${String(sessions.size + 1)}`;

            sessions.set(id, [Buffer.from(contents)]);

            return { result: { session_id: id } };
        },
    };

    return { client, failing, failNext, folders, objects, put };
};

const createStorage = (dropbox: ReturnType<typeof createDropbox>, options: Partial<DropboxStorageOptions> = {}) => {
    const meta = new MemoryMetaStorage<DropboxFile>();
    const storage = new DropboxStorage({
        client: dropbox.client as unknown as DropboxStorageOptions["client"],
        metaStorage: meta,
        retryConfig: { maxRetries: 0 },
        rootFolderPath: "/apps/up/",
        ...options,
    });

    return { meta, storage };
};

const upload = async (storage: DropboxStorage, text: string, init: Partial<DropboxFile> = {}): Promise<DropboxFile> => {
    const file = await storage.create({ contentType: "text/plain", metadata: { owner: "me" }, originalName: "a.txt", size: text.length, ...init });

    return storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });
};

describe("dropbox against an in-memory Dropbox", () => {
    describeStorageContract(
        () => {
            const dropbox = createDropbox();

            return {
                createStorage: (options) => createStorage(dropbox, options).storage,
                failBackend: (failing) => {
                    dropbox.failing.all = failing;
                },
                hasObject: (key) => dropbox.objects.has(`/apps/up/${key}`),
                putObject: (key, content) => {
                    dropbox.put(`/apps/up/${key}`, Buffer.from(content));
                },
            };
        },
    );
    it("should refuse a partial chunk instead of storing it as the whole file", async () => {
        expect.assertions(4);

        const dropbox = createDropbox();
        const { storage } = createStorage(dropbox);
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

        await expect(storage.write({ body: Readable.from([Buffer.from("01234")]), contentLength: 5, id: file.id, start: 0 })).rejects.toMatchObject({
            UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED,
        });
        await expect(storage.write({ body: Readable.from([Buffer.from("56789")]), contentLength: 5, id: file.id, start: 5 })).rejects.toMatchObject({
            UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED,
        });

        expect(dropbox.objects.size).toBe(0);
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ bytesWritten: 0, status: "created" });
    });

    it("should resume after an interrupted upload and keep the metadata once completed", async () => {
        expect.assertions(6);

        const dropbox = createDropbox();
        const { storage } = createStorage(dropbox);
        const file = await storage.create({ contentType: "text/plain", metadata: { owner: "me" }, originalName: "a.txt", size: 5 });

        dropbox.failNext.set("filesUpload", new DropboxResponseError(503, {}, { error_summary: "too_many_write_operations/" }));

        await expect(storage.write({ body: Readable.from([Buffer.from("hello")]), contentLength: 5, id: file.id, start: 0 })).rejects.toBeInstanceOf(
            DropboxResponseError,
        );
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ bytesWritten: 0 });

        const written = await storage.write({ body: Readable.from([Buffer.from("hello")]), contentLength: 5, id: file.id, start: 0 });

        expect(written).toMatchObject({ bytesWritten: 5, path: `/apps/up/${file.name}`, status: "completed" });
        expect(dropbox.objects.get(`/apps/up/${file.name}`)?.body.toString()).toBe("hello");
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ ETag: written.ETag, metadata: { owner: "me" }, status: "completed" });
        // A write to a completed upload is a no-op.
        await expect(storage.write({ id: file.id })).resolves.toMatchObject({ status: "completed" });
    });

    // Pushes 159 MiB through the 150 MiB upload-session threshold: give slow CI runners room.
    it("should upload files above the simple-upload limit through an upload session", { timeout: 60_000 }, async () => {
        expect.assertions(2);

        const dropbox = createDropbox();
        const { storage } = createStorage(dropbox);
        const size = 150 * 1024 * 1024 + 9 * 1024 * 1024;
        const body = Buffer.alloc(size, 3);

        body[size - 1] = 9;

        const file = await storage.create({ contentType: "application/octet-stream", metadata: {}, originalName: "big.bin", size });

        await storage.write({ body: Readable.from([body]), contentLength: size, id: file.id, start: 0 });

        const stored = dropbox.objects.get(`/apps/up/${file.name}`)?.body;

        expect(stored?.length).toBe(size);
        expect(stored?.[size - 1]).toBe(9);
    });

    it("should read a finished upload back with its upload metadata", async () => {
        expect.assertions(4);

        const dropbox = createDropbox();
        const { storage } = createStorage(dropbox);
        const file = await upload(storage, "hello");

        await expect(storage.get({ id: file.id })).resolves.toMatchObject({ contentType: "text/plain", metadata: { owner: "me" }, originalName: "a.txt", size: 5 });

        const { headers, stream } = await storage.getStream({ id: file.id });

        expect(headers).toMatchObject({ "Content-Length": "5", "Content-Type": "text/plain" });
        await expect(text(stream)).resolves.toBe("hello");
        await expect(storage.get({ id: "missing" })).rejects.toBeInstanceOf(DropboxResponseError);
    });

    it("should read an object written by other means by its path", async () => {
        expect.assertions(1);

        const dropbox = createDropbox();
        const { storage } = createStorage(dropbox);

        dropbox.objects.set("/apps/up/external.txt", { body: Buffer.from("outside"), modified: "2026-01-01T00:00:00Z", rev: "x1" });

        await expect(storage.get({ id: "external.txt" })).resolves.toMatchObject({
            content: Buffer.from("outside"),
            contentType: "application/octet-stream",
            ETag: "x1",
            size: 7,
        });
    });

    it("should describe stored objects, report missing ones as undefined and throw other failures", async () => {
        expect.assertions(6);

        const dropbox = createDropbox();
        const { storage } = createStorage(dropbox);
        const file = await upload(storage, "hello");

        dropbox.folders.add("/apps/up/dir");

        await expect(storage.getCompletedFile(file.name)).resolves.toMatchObject({ bytesWritten: 5, id: file.name, size: 5, status: "completed" });
        await expect(storage.getCompletedFile("missing")).resolves.toBeUndefined();
        await expect(storage.getCompletedFile("dir")).resolves.toBeUndefined();

        dropbox.failNext.set("filesGetMetadata", new DropboxResponseError(401, {}, { error_summary: "invalid_access_token/" }));

        await expect(storage.getCompletedFile(file.name)).rejects.toMatchObject({ status: 401 });
        await expect(storage.exists({ id: file.id })).resolves.toBe(true);
        await expect(storage.exists({ id: "missing" })).resolves.toBe(false);
    });

    it("should copy and move objects", async () => {
        expect.assertions(4);

        const dropbox = createDropbox();
        const { storage } = createStorage(dropbox);
        const file = await upload(storage, "hello");

        await expect(storage.copy(file.name, "copy.txt")).resolves.toMatchObject({ id: "copy.txt", path: "/apps/up/copy.txt" });

        await storage.move("copy.txt", "nested/moved.txt");

        expect(dropbox.objects.has("/apps/up/copy.txt")).toBe(false);
        expect(dropbox.objects.get("/apps/up/nested/moved.txt")?.body.toString()).toBe("hello");
        await expect(storage.copy("missing", "x")).rejects.toBeInstanceOf(DropboxResponseError);
    });

    it("should list every page of the root folder as keys, skipping folders", async () => {
        expect.assertions(3);

        const dropbox = createDropbox();
        const { storage } = createStorage(dropbox);

        dropbox.folders.add("/apps/up/nested");

        for (const name of ["a", "b", "c", "nested/d", "e"]) {
            dropbox.objects.set(`/apps/up/${name}`, { body: Buffer.from(name), modified: "2026-01-01T00:00:00Z", rev: name });
        }

        dropbox.objects.set("/elsewhere/z", { body: Buffer.from("z"), modified: "2026-01-01T00:00:00Z", rev: "z" });

        const listed = await storage.list();

        expect(listed.map((file) => file.id).toSorted()).toStrictEqual(["a", "b", "c", "e", "nested/d"]);
        await expect(storage.list(3)).resolves.toHaveLength(3);
        // A limit above Dropbox's per-request maximum still lists (Files.listAll asks for growing limits).
        await expect(storage.list(4000)).resolves.toHaveLength(5);
    });

    it("should refuse an expired upload and purge old uploads by upload id", async () => {
        expect.assertions(5);

        const dropbox = createDropbox();
        const { meta, storage } = createStorage(dropbox, { expiration: { maxAge: "1h" }, filename: (file) => `named/${file.originalName}` });
        const expired = await upload(storage, "old");

        await meta.save(expired.id, { ...(await meta.get(expired.id)), expiredAt: Date.now() - 1000 });

        await expect(storage.get({ id: expired.id })).rejects.toMatchObject({ UploadErrorCode: ERRORS.GONE });

        const stale = await upload(storage, "stale", { originalName: "stale.txt" });
        const fresh = await upload(storage, "fresh", { originalName: "fresh.txt" });
        const record = await meta.get(stale.id);

        await meta.save(stale.id, { ...record, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() });

        const purged = await storage.purge();

        expect(purged.items.map((item) => item.id)).toContain(stale.id);
        expect(dropbox.objects.has("/apps/up/named/stale.txt")).toBe(false);
        await expect(meta.get(stale.id)).rejects.toThrow("Meta not found");
        await expect(storage.getMeta(fresh.id)).resolves.toMatchObject({ status: "completed" });
    });

    it("should serve a chunked REST upload, HEAD, PUT replace and DELETE", async () => {
        expect.assertions(7);

        const dropbox = createDropbox();
        const { storage } = createStorage(dropbox);
        const rest = new RestFetch({ storage });
        const endpoint = "https://app.local/upload";
        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "text/plain", "x-chunked-upload": "true", "x-total-size": "10" },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const patch = async (body: string, offset: number): Promise<Response> =>
            rest.fetch(
                new Request(location, {
                    body,
                    headers: { "content-length": String(body.length), "content-type": "application/octet-stream", "x-chunk-offset": String(offset) },
                    method: "PATCH",
                }),
            );

        // Dropbox stores a file in one request, so a partial chunk is refused rather than stored as the whole file.
        const partial = await patch("01234", 0);

        expect(partial.status).toBe(405);

        const completed = await patch("0123456789", 0);

        expect([completed.status, completed.headers.get("x-upload-complete")]).toStrictEqual([200, "true"]);

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect([head.status, head.headers.get("x-upload-complete")]).toStrictEqual([200, "true"]);

        const id = (location.split("/").pop() as string).replace(/\.[^.]*$/u, "");
        const { name } = await storage.getMeta(id);

        expect(dropbox.objects.get(`/apps/up/${name}`)?.body.toString()).toBe("0123456789");

        const put = await rest.fetch(new Request(location, { body: "next", headers: { "content-length": "4", "content-type": "text/plain" }, method: "PUT" }));

        expect([put.status, dropbox.objects.get(`/apps/up/${name}`)?.body.toString()]).toStrictEqual([200, "next"]);

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect(deleted.status).toBe(204);
        expect(dropbox.objects.size).toBe(0);
    });
});
