import { Readable } from "node:stream";
import { text } from "node:stream/consumers";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Files } from "../../../src/files";
import RestFetch from "../../../src/handler/rest/rest-fetch";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import type { File } from "../../../src/storage/utils/file";
import VercelBlobStorage from "../../../src/storage/vercel-blob/vercel-blob-storage";
import { describeStorageContract } from "../../__helpers__/storage-contract";

/**
 * In-memory Vercel Blob store at https://blob.test, keyed by pathname. Like the real service it
 * refuses to overwrite an existing pathname without `allowOverwrite`, serves private blobs only
 * through the SDK's `get`, and `head`/`del`/`get` take a pathname or a blob URL.
 * `failNext` makes the next call to an SDK function throw, `failing.all` every call, to inject failures.
 */
const blob = vi.hoisted(() => {
    class BlobNotFoundError extends Error {}

    const store = new Map<string, { access?: string; body: Uint8Array; contentType: string; uploadedAt: Date }>();
    const failNext = new Map<string, Error>();
    const base = "https://blob.test/";
    const toPathname = (urlOrPathname: string): string => (urlOrPathname.startsWith(base) ? urlOrPathname.slice(base.length) : urlOrPathname);
    const describeBlob = (pathname: string) => {
        const stored = store.get(pathname);

        if (!stored) {
            throw new BlobNotFoundError();
        }

        return {
            contentType: stored.contentType,
            downloadUrl: `${base}${pathname}?download=1`,
            etag: `"${pathname}"`,
            pathname,
            size: stored.body.byteLength,
            uploadedAt: stored.uploadedAt,
            url: `${base}${pathname}`,
        };
    };
    const failing = { all: false };
    const failure = (name: string): void => {
        if (failing.all) {
            throw new Error("Vercel Blob: Access denied, please provide a valid token for this resource.");
        }

        const error = failNext.get(name);

        if (error) {
            failNext.delete(name);

            throw error;
        }
    };

    return {
        base,
        BlobNotFoundError,
        copy: async (from: string, to: string, options: { allowOverwrite?: boolean } = {}) => {
            failure("copy");

            const source = store.get(toPathname(from));

            if (!source) {
                throw new BlobNotFoundError();
            }

            if (store.has(to) && !options.allowOverwrite) {
                throw new Error("Vercel Blob: This blob already exists");
            }

            store.set(to, { ...source, uploadedAt: new Date() });

            return describeBlob(to);
        },
        del: async (urlOrPathname: string) => {
            failure("del");

            store.delete(toPathname(urlOrPathname));
        },
        failing,
        failNext,
        get: async (urlOrPathname: string, options: { access: string }) => {
            failure("get");

            const stored = store.get(toPathname(urlOrPathname));

            if (!stored || (stored.access ?? "public") !== options.access) {
                return null;
            }

            return { blob: describeBlob(toPathname(urlOrPathname)), headers: new Headers(), statusCode: 200, stream: new Blob([stored.body]).stream() };
        },
        head: async (urlOrPathname: string) => {
            failure("head");

            return describeBlob(toPathname(urlOrPathname));
        },
        // A page holds at most two blobs (the service caps pages at 1000), so a listing must follow the cursor.
        list: async ({ cursor, limit = 1000 }: { cursor?: string; limit?: number } = {}) => {
            failure("list");

            const blobs = [...store.keys()].toSorted().map((pathname) => describeBlob(pathname));
            const start = Number(cursor ?? 0);
            const end = start + Math.min(limit, 2);

            return { blobs: blobs.slice(start, end), cursor: end < blobs.length ? String(end) : undefined, hasMore: end < blobs.length };
        },
        put: async (pathname: string, body: Blob, options: { access?: string; allowOverwrite?: boolean } = {}) => {
            failure("put");

            if (store.has(pathname) && !options.allowOverwrite) {
                throw new Error("Vercel Blob: This blob already exists");
            }

            store.set(pathname, { access: options.access, body: new Uint8Array(await body.arrayBuffer()), contentType: body.type, uploadedAt: new Date() });

            return describeBlob(pathname);
        },
        store,
    };
});

vi.mock(import("@vercel/blob"), () => ({ BlobNotFoundError: blob.BlobNotFoundError, copy: blob.copy, del: blob.del, get: blob.get, head: blob.head, list: blob.list, put: blob.put } as never));

const createStorage = (metaStore = new Map<string, File>()): VercelBlobStorage =>
    new VercelBlobStorage({
        filename: (file) => `uploads/${file.originalName}`,
        metaStorage: new MemoryMetaStorage({ store: metaStore }),
        retryConfig: { maxRetries: 0 },
        token: "vercel_blob_rw_test",
    });

const upload = async (storage: VercelBlobStorage, name: string, text: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: { tag: name }, originalName: name, size: text.length });

    await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

    return file.id;
};

describe("vercel-blob against an in-memory blob store", () => {
    beforeEach(() => {
        blob.store.clear();
        blob.failNext.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describeStorageContract(
        () => {
            return {
                // Stored under the upload id: the other tests' `filename` would give every upload the same pathname.
                createStorage: (options) =>
                    new VercelBlobStorage({ metaStorage: new MemoryMetaStorage(), retryConfig: { maxRetries: 0 }, token: "vercel_blob_rw_test", ...options }),
                failBackend: (failing) => {
                    blob.failing.all = failing;
                },
                hasObject: (key) => blob.store.has(key),
                putObject: (key, content) => {
                    blob.store.set(key, { body: new TextEncoder().encode(content), contentType: "text/plain", uploadedAt: new Date() });
                },
            };
        },
        // Covered below: `get` reads only uploads, and a copied blob has no upload metadata.
        { "copy and move": "get reads only uploads with metadata" },
    );

    it("should replace a blob under a pathname another upload already wrote", async () => {
        expect.assertions(2);

        const storage = createStorage();

        await upload(storage, "a.txt", "first");
        const second = await upload(storage, "a.txt", "second");

        expect(new TextDecoder().decode(blob.store.get("uploads/a.txt")?.body)).toBe("second");

        await storage.copy(second, "uploads/a.txt");

        await expect(storage.get({ id: second })).resolves.toHaveProperty("content", Buffer.from("second"));
    });

    it("should store and read private blobs through the SDK", async () => {
        expect.assertions(3);

        const storage = new VercelBlobStorage({ access: "private", metaStorage: new MemoryMetaStorage(), token: "vercel_blob_rw_test" });
        const id = await upload(storage, "secret.txt", "hush");

        expect(blob.store.get(id)?.access).toBe("private");
        await expect(storage.get({ id })).resolves.toHaveProperty("content", Buffer.from("hush"));
        await expect(storage.exists({ id })).resolves.toBe(true);
    });

    it("should store a whole-file upload and keep its metadata once completed", async () => {
        expect.assertions(5);

        const storage = createStorage();
        const id = await upload(storage, "a.txt", "hello");

        expect(new TextDecoder().decode(blob.store.get("uploads/a.txt")?.body)).toBe("hello");
        await expect(storage.getMeta(id)).resolves.toMatchObject({
            bytesWritten: 5,
            metadata: { tag: "a.txt" },
            pathname: "uploads/a.txt",
            status: "completed",
            url: `${blob.base}uploads/a.txt`,
        });

        // A repeated write to a completed upload is a no-op, not a second put.
        await expect(storage.write({ body: Readable.from([Buffer.from("again")]), contentLength: 5, id, start: 0 })).resolves.toMatchObject({
            status: "completed",
        });
        expect(blob.store.size).toBe(1);
        // create() with the same id hands back the existing upload.
        await expect(storage.create({ contentType: "text/plain", id, metadata: {}, originalName: "a.txt", size: 5 })).resolves.toMatchObject({
            status: "completed",
        });
    });

    it("should reject chunked writes without storing a partial blob, and accept the whole file after", async () => {
        expect.assertions(5);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "c.txt", size: 10 });

        // First chunk only: storing it would complete the upload with half the data.
        await expect(storage.write({ body: Readable.from([Buffer.from("01234")]), contentLength: 5, id: file.id, start: 0 })).rejects.toMatchObject({
            UploadErrorCode: "MethodNotAllowed",
        });
        // Resuming at an offset is refused the same way.
        await expect(storage.write({ body: Readable.from([Buffer.from("56789")]), contentLength: 5, id: file.id, start: 5 })).rejects.toMatchObject({
            UploadErrorCode: "MethodNotAllowed",
        });
        // A body shorter than declared is caught after buffering.
        await expect(storage.write({ body: Readable.from([Buffer.from("0123")]), id: file.id, start: 0 })).rejects.toMatchObject({
            UploadErrorCode: "MethodNotAllowed",
        });

        expect(blob.store.size).toBe(0);

        await storage.write({ body: Readable.from([Buffer.from("01234"), Buffer.from("56789")]), contentLength: 10, id: file.id, start: 0 });

        expect(new TextDecoder().decode(blob.store.get("uploads/c.txt")?.body)).toBe("0123456789");
    });

    it("should keep the upload resumable when the put fails", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "r.txt", size: 3 });

        blob.failNext.set("put", new Error("Vercel Blob: service unavailable"));

        await expect(storage.write({ body: Readable.from([Buffer.from("abc")]), contentLength: 3, id: file.id, start: 0 })).rejects.toThrow("service unavailable");
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ bytesWritten: 0 });

        await storage.write({ body: Readable.from([Buffer.from("abc")]), contentLength: 3, id: file.id, start: 0 });

        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ status: "completed" });
    });

    it("should read a completed upload with get and getStream", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const id = await upload(storage, "g.txt", "content");

        await expect(storage.get({ id })).resolves.toMatchObject({ contentType: "text/plain", metadata: { tag: "g.txt" }, size: 7 });

        const { headers, stream } = await storage.getStream({ id });

        expect(headers).toMatchObject({ "Content-Length": "7", "Content-Type": "text/plain" });
        await expect(text(stream)).resolves.toBe("content");
    });

    it("should report a blob gone from the store as not found, not return the error page as content", async () => {
        expect.assertions(2);

        const storage = createStorage();
        const id = await upload(storage, "gone.txt", "bytes");

        blob.store.clear();

        await expect(storage.get({ id })).rejects.toMatchObject({ UploadErrorCode: "FileNotFound" });

        blob.failNext.set("get", new Error("Vercel Blob: bad gateway"));

        await expect(storage.get({ id })).rejects.toThrow("bad gateway");
    });

    it("should answer exists and getCompletedFile from the store", async () => {
        expect.assertions(6);

        const storage = createStorage();
        const id = await upload(storage, "e.txt", "exists");
        const pending = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "p.txt", size: 1 });

        await expect(storage.exists({ id })).resolves.toBe(true);
        await expect(storage.exists({ id: pending.id })).resolves.toBe(false);
        await expect(storage.exists({ id: "unknown" })).resolves.toBe(false);

        await expect(storage.getCompletedFile("uploads/e.txt")).resolves.toMatchObject({ bytesWritten: 6, size: 6, status: "completed" });
        await expect(storage.getCompletedFile("nope")).resolves.toBeUndefined();

        blob.failNext.set("head", new Error("Vercel Blob: rate limited"));

        await expect(storage.getCompletedFile("uploads/e.txt")).rejects.toThrow("rate limited");
    });

    it("should copy and move a completed upload", async () => {
        expect.assertions(5);

        const metaStore = new Map<string, File>();
        const storage = createStorage(metaStore);
        const id = await upload(storage, "m.txt", "moving");

        await expect(storage.copy(id, "copies/m.txt")).resolves.toMatchObject({ pathname: "copies/m.txt", url: `${blob.base}copies/m.txt` });
        expect(new TextDecoder().decode(blob.store.get("copies/m.txt")?.body)).toBe("moving");

        await expect(storage.move(id, "moved/m.txt")).resolves.toMatchObject({ pathname: "moved/m.txt" });
        expect([...blob.store.keys()].toSorted()).toStrictEqual(["copies/m.txt", "moved/m.txt"]);
        expect(metaStore.has(id)).toBe(false);
    });

    it("should list stored blobs only, across pages up to the limit", async () => {
        expect.assertions(3);

        const metaStore = new Map<string, File>();
        const storage = createStorage(metaStore);

        await upload(storage, "1.txt", "one");
        await upload(storage, "2.txt", "two");
        await upload(storage, "3.txt", "three");
        await storage.create({ contentType: "text/plain", metadata: {}, originalName: "pending.txt", size: 1 });

        const listed = await storage.list();

        expect(listed.map((file) => file.id)).toStrictEqual(["uploads/1.txt", "uploads/2.txt", "uploads/3.txt"]);
        expect(listed[2]).toMatchObject({ size: 5, url: `${blob.base}uploads/3.txt` });
        await expect(storage.list(2)).resolves.toHaveLength(2);
    });

    it("should let Files.listAll walk every blob past the provider's page cap", async () => {
        expect.assertions(1);

        const storage = createStorage();

        for (const name of ["1.txt", "2.txt", "3.txt", "4.txt", "5.txt"]) {
            await upload(storage, name, name);
        }

        const keys: string[] = [];

        for await (const { key } of new Files({ adapter: storage }).listAll({ limit: 1 })) {
            keys.push(key);
        }

        expect(keys).toStrictEqual(["uploads/1.txt", "uploads/2.txt", "uploads/3.txt", "uploads/4.txt", "uploads/5.txt"]);
    });

    it("should delete an upload that never received content", async () => {
        expect.assertions(2);

        const metaStore = new Map<string, File>();
        const storage = createStorage(metaStore);
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "empty.txt", size: 4 });

        await expect(storage.delete({ id: file.id })).resolves.toMatchObject({ status: "deleted" });
        expect(metaStore.has(file.id)).toBe(false);
    });

    it("should purge expired uploads, finished or not, together with their metadata", async () => {
        expect.assertions(3);

        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

        const metaStore = new Map<string, File>();
        const storage = createStorage(metaStore);
        const finished = await upload(storage, "old.txt", "old");
        const unfinished = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "stale.txt", size: 4 });

        vi.setSystemTime(new Date("2024-01-01T03:00:00Z"));

        const fresh = await upload(storage, "new.txt", "new");
        const purged = await storage.purge("1h");

        expect(purged.items.map((item) => item.id).toSorted()).toStrictEqual([finished, unfinished.id].toSorted());
        expect([...blob.store.keys()]).toStrictEqual(["uploads/new.txt"]);
        expect([...metaStore.keys()]).toStrictEqual([fresh]);
    });

    it("should expire an upload past its ttl on read", async () => {
        expect.assertions(2);

        vi.useFakeTimers({ toFake: ["Date"] });

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "ttl.txt", size: 1, ttl: "1m" });

        vi.setSystemTime(Date.now() + 120_000);

        await expect(storage.write({ body: Readable.from([Buffer.from("x")]), contentLength: 1, id: file.id, start: 0 })).rejects.toMatchObject({
            UploadErrorCode: "Gone",
        });
        expect(blob.store.size).toBe(0);
    });

    it("should serve a REST upload lifecycle: whole-file chunk, HEAD, PUT replace and DELETE", async () => {
        expect.assertions(9);

        const metaStore = new Map<string, File>();
        const rest = new RestFetch({ storage: createStorage(metaStore) });
        const endpoint = "https://app.local/upload";

        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "text/plain", "x-chunked-upload": "true", "x-total-size": "6" },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;

        // Vercel Blob stores each object in one request, so a partial chunk is refused.
        const partial = await rest.fetch(
            new Request(location, { body: "abc", headers: { "content-length": "3", "content-type": "application/octet-stream", "x-chunk-offset": "0" }, method: "PATCH" }),
        );

        expect(partial.status).toBe(405);

        const whole = await rest.fetch(
            new Request(location, { body: "abcdef", headers: { "content-length": "6", "content-type": "application/octet-stream", "x-chunk-offset": "0" }, method: "PATCH" }),
        );

        expect(whole.status).toBe(200);
        expect(blob.store.size).toBe(1);

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect(head.status).toBe(200);

        const replaced = await rest.fetch(new Request(location, { body: "replaced", headers: { "content-length": "8", "content-type": "text/plain" }, method: "PUT" }));

        expect(replaced.status).toBe(200);

        const [stored] = [...blob.store.values()];

        expect(new TextDecoder().decode(stored?.body)).toBe("replaced");

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect(deleted.status).toBe(204);
        expect(blob.store.size).toBe(0);
        expect(metaStore.size).toBe(0);
    });
});
