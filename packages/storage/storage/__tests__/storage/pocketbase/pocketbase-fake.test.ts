import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import PocketBaseStorage from "../../../src/storage/pocketbase/pocketbase-storage";
import type { PocketBaseClientLike, PocketBaseRecord, PocketBaseStorageOptions } from "../../../src/storage/pocketbase/types";
import { ERRORS } from "../../../src/utils/errors";

type Row = PocketBaseRecord & { created: string; file: string; key: string; updated: string };

const pbDate = (date: Date): string => date.toISOString().replace("T", " ");

/**
 * In-memory PocketBase collection "uploads" (key field `key`, file field `file`) plus the file server
 * behind `files.getURL`, answered through a stubbed global fetch. `fail` makes the next call of a
 * collection operation throw.
 */
const createPocketBase = () => {
    const records = new Map<string, Row>();
    const blobs = new Map<string, { body: Buffer; type: string }>();
    const fail = new Map<"delete" | "getFirstListItem" | "getList", Error>();
    let counter = 0;

    const notFound = (): Error => Object.assign(new Error("The requested resource wasn't found."), { status: 404 });
    const take = (operation: "delete" | "getFirstListItem" | "getList"): void => {
        const failure = fail.get(operation);

        if (failure) {
            fail.delete(operation);

            throw failure;
        }
    };

    const store = async (existing: Row, form: FormData): Promise<Row> => {
        const blob = form.get("file") as Blob;

        counter += 1;

        const row: Row = { ...existing, file: `upload_${String(counter)}.bin`, key: String(form.get("key")), updated: pbDate(new Date()) };

        blobs.set(`${row.id}/${row.file}`, { body: Buffer.from(await blob.arrayBuffer()), type: blob.type });
        records.set(row.id, row);

        return row;
    };

    const collection = {
        authWithPassword: async () => { return {}; },
        create: async (form: unknown) => {
            const now = pbDate(new Date());

            return store({ created: now, file: "", id: `r${String(records.size + 1)}`, key: "", updated: now }, form as FormData);
        },
        delete: async (id: string) => {
            take("delete");

            if (!records.delete(id)) {
                throw notFound();
            }

            return true;
        },
        getFirstListItem: async (filter: string) => {
            take("getFirstListItem");

            const row = [...records.values()].find((record) => record.key === filter);

            if (!row) {
                throw notFound();
            }

            return row;
        },
        // The server caps a page at two records (PocketBase caps `perPage`), so listing must walk pages.
        getList: async (page: number, perPage: number) => {
            take("getList");

            const size = Math.min(perPage, 2);
            const all = [...records.values()];

            return { items: all.slice((page - 1) * size, page * size), totalPages: Math.ceil(all.length / size) };
        },
        update: async (id: string, form: unknown) => store(records.get(id) as Row, form as FormData),
    };

    const client: PocketBaseClientLike = {
        authStore: { isValid: true, save: () => undefined },
        collection: () => collection,
        files: {
            getToken: async () => "file-token",
            getURL: (record, filename, options) =>
                `https://pb.test/api/files/uploads/${record.id}/${filename}${options?.token ? `?token=${options.token}` : ""}`,
        },
        // The fake matches on the bound key itself rather than parsing PocketBase's filter syntax.
        filter: (_raw, parameters) => String(parameters?.k),
    };

    const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = input instanceof Request ? input : new Request(input, init);
        const blob = blobs.get(new URL(request.url).pathname.slice("/api/files/uploads/".length));

        if (!blob) {
            return new Response(null, { status: 404 });
        }

        return new Response(request.method === "HEAD" ? null : new Uint8Array(blob.body), {
            headers: { "content-length": String(blob.body.byteLength), "content-type": blob.type },
        });
    };

    return { blobs, client, fail, fetch, records };
};

let pb: ReturnType<typeof createPocketBase>;

const createStorage = (options: Partial<PocketBaseStorageOptions> = {}): PocketBaseStorage =>
    new PocketBaseStorage({ client: pb.client, collection: "uploads", expiration: { maxAge: "1h" }, metaStorage: new MemoryMetaStorage(), ...options });

const twoHoursAgo = (): Date => new Date(Date.now() - 2 * 60 * 60 * 1000);

const content = (key: string): string | undefined => {
    const row = [...pb.records.values()].find((record) => record.key === key);

    return row ? pb.blobs.get(`${row.id}/${row.file}`)?.body.toString() : undefined;
};

const upload = async (storage: PocketBaseStorage, text: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: { kept: "yes" }, originalName: "a.txt", size: text.length });

    await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

    return file.id;
};

describe("pocketbase against an in-memory collection", () => {
    beforeEach(() => {
        pb = createPocketBase();
        vi.stubGlobal("fetch", pb.fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should store a whole-file upload as one record and keep its metadata after completion", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        expect(content(id)).toBe("hello");
        expect(pb.records.size).toBe(1);
        await expect(storage.getMeta(id)).resolves.toMatchObject({ bytesWritten: 5, metadata: { kept: "yes" }, status: "completed" });
        await expect(storage.create({ contentType: "text/plain", id, metadata: {}, originalName: "a.txt", size: 5 })).resolves.toMatchObject({
            status: "completed",
        });
    });

    it("should refuse a chunked upload and accept the whole file afterwards", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

        await expect(storage.write({ body: Readable.from([Buffer.from("01234")]), contentLength: 5, id: file.id, start: 0 })).rejects.toMatchObject({
            UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED,
        });
        expect(pb.records.size).toBe(0);

        await storage.write({ body: Readable.from([Buffer.from("0123456789")]), contentLength: 10, id: file.id, start: 0 });

        expect(content(file.id)).toBe("0123456789");
    });

    it("should keep the upload resumable when the record lookup fails", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 2 });

        pb.fail.set("getFirstListItem", Object.assign(new Error("Something went wrong."), { status: 500 }));

        await expect(storage.write({ body: Readable.from([Buffer.from("hi")]), contentLength: 2, id: file.id, start: 0 })).rejects.toThrow(
            /went wrong/,
        );
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ bytesWritten: 0 });

        await storage.write({ body: Readable.from([Buffer.from("hi")]), contentLength: 2, id: file.id, start: 0 });

        expect(content(file.id)).toBe("hi");
    });

    it("should read a finished upload back through get, getStream, exists and getCompletedFile", async () => {
        expect.assertions(7);

        const storage = createStorage();
        const id = await upload(storage, "payload");
        const { stream } = await storage.getStream({ id });
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk as Uint8Array));
        }

        await expect(storage.get({ id })).resolves.toMatchObject({ contentType: "text/plain", metadata: { kept: "yes" }, size: 7 });
        expect(Buffer.concat(chunks).toString()).toBe("payload");
        await expect(storage.exists({ id })).resolves.toBe(true);
        await expect(storage.exists({ id: "missing" })).resolves.toBe(false);
        await expect(storage.getCompletedFile(id)).resolves.toMatchObject({ bytesWritten: 7, contentType: "text/plain", status: "completed" });
        await expect(storage.getCompletedFile("missing")).resolves.toBeUndefined();

        pb.fail.set("getFirstListItem", Object.assign(new Error("Only superusers can perform this action."), { status: 403 }));

        await expect(storage.exists({ id })).rejects.toThrow(/superusers/);
    });

    it("should answer getCompletedFile undefined for a record whose file is gone, and throw on other HEAD failures", async () => {
        expect.assertions(2);

        const storage = createStorage();
        const id = await upload(storage, "payload");

        pb.blobs.clear();

        await expect(storage.getCompletedFile(id)).resolves.toBeUndefined();

        vi.stubGlobal("fetch", async () => new Response(null, { status: 503 }));

        await expect(storage.getCompletedFile(id)).rejects.toThrow(/answered 503/);
    });

    it("should answer GONE for an expired upload instead of serving it", async () => {
        expect.assertions(1);

        const storage = createStorage();
        const id = await upload(storage, "stale");

        await storage.saveMeta(Object.assign(await storage.getMeta(id), { expiredAt: Date.now() - 1000 }));

        await expect(storage.get({ id })).rejects.toMatchObject({ UploadErrorCode: ERRORS.GONE });
    });

    it("should report a record without a downloadable file as FILE_NOT_FOUND", async () => {
        expect.assertions(1);

        const storage = createStorage();
        const id = await upload(storage, "payload");

        pb.blobs.clear();

        await expect(storage.get({ id })).rejects.toMatchObject({ UploadErrorCode: ERRORS.FILE_NOT_FOUND });
    });

    it("should copy, replace on a second copy, and move records", async () => {
        expect.assertions(5);

        const storage = createStorage();
        const id = await upload(storage, "hello");
        const other = await upload(storage, "world");

        await expect(storage.copy(id, "copy.txt")).resolves.toMatchObject({ contentType: "text/plain", id: "copy.txt", size: 5 });

        // A second copy onto the same key updates that record instead of adding another.
        await storage.copy(other, "copy.txt");

        expect(content("copy.txt")).toBe("world");
        expect(pb.records.size).toBe(3);

        await storage.move("copy.txt", "moved.txt");

        expect(content("copy.txt")).toBeUndefined();
        expect(content("moved.txt")).toBe("world");
    });

    it("should list records by key across pages, honouring the limit", async () => {
        expect.assertions(2);

        const storage = createStorage();
        const ids = [await upload(storage, "a"), await upload(storage, "b"), await upload(storage, "c")];

        await expect(storage.list().then((files) => files.map((file) => file.id))).resolves.toStrictEqual(ids);
        await expect(storage.list(1).then((files) => files.map((file) => file.id))).resolves.toStrictEqual([ids[0]]);
    });

    it("should delete the record and its metadata, and keep the metadata when the delete fails", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const kept = await upload(storage, "keep");
        const gone = await upload(storage, "gone");

        pb.fail.set("delete", Object.assign(new Error("Something went wrong."), { status: 500 }));

        await expect(storage.delete({ id: kept })).rejects.toThrow(/went wrong/);
        await expect(storage.getMeta(kept)).resolves.toMatchObject({ status: "completed" });

        await storage.delete({ id: gone });

        expect(content(gone)).toBeUndefined();
        await expect(storage.getMeta(gone)).rejects.toMatchObject({ UploadErrorCode: ERRORS.FILE_NOT_FOUND });
    });

    it("should delete a key without metadata and treat an already-missing record as deleted", async () => {
        expect.assertions(2);

        const storage = createStorage();

        await storage.copy(await upload(storage, "x"), "loose.txt");

        await expect(storage.delete({ id: "loose.txt" })).resolves.toMatchObject({ id: "loose.txt", status: "deleted" });
        await expect(storage.delete({ id: "loose.txt" })).resolves.toMatchObject({ status: "deleted" });
    });

    it("should purge expired records by their creation date when the meta storage cannot list", async () => {
        expect.assertions(2);

        const metaStorage = new MemoryMetaStorage();

        metaStorage.list = async () => undefined as never;

        const storage = createStorage({ metaStorage });
        const id = await upload(storage, "old");
        const fresh = await upload(storage, "new");

        ([...pb.records.values()].find((record) => record.key === id) as Row).created = pbDate(twoHoursAgo());

        const purged = await storage.purge();

        expect(purged.items.map((item) => item.id)).toStrictEqual([id]);
        expect([...pb.records.values()].map((record) => record.key)).toStrictEqual([fresh]);
    });

    it("should purge an expired upload stored under a custom filename, record and metadata", async () => {
        expect.assertions(3);

        const storage = createStorage({ filename: (file) => `custom-${file.id}.txt` });
        const id = await upload(storage, "old");
        const fresh = await upload(storage, "new");

        await storage.saveMeta(Object.assign(await storage.getMeta(id), { createdAt: twoHoursAgo().toISOString() }));

        const purged = await storage.purge();

        expect(purged.items.map((item) => item.id)).toStrictEqual([id]);
        expect([...pb.records.values()].map((record) => record.key)).toStrictEqual([`custom-${fresh}.txt`]);
        await expect(storage.getMeta(id)).rejects.toMatchObject({ UploadErrorCode: ERRORS.FILE_NOT_FOUND });
    });

    it("should hand out a tokenized file URL", async () => {
        expect.assertions(1);

        const storage = createStorage();
        const id = await upload(storage, "x");

        await expect(storage.getReadUrl(id)).resolves.toMatch(/^https:\/\/pb\.test\/api\/files\/uploads\/r1\/upload_1\.bin\?token=file-token$/u);
    });

    it("should serve the REST handler: single-request POST, HEAD, PUT replace, DELETE and refuse chunked PATCH", async () => {
        expect.assertions(5);

        const rest = new RestFetch({ storage: createStorage() });
        const endpoint = "https://app.local/upload";

        const created = await rest.fetch(
            new Request(endpoint, { body: "hello", headers: { "content-length": "5", "content-type": "text/plain" }, method: "POST" }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const head = await rest.fetch(new Request(location, { method: "HEAD" }));
        const put = await rest.fetch(new Request(location, { body: "replaced", headers: { "content-length": "8", "content-type": "text/plain" }, method: "PUT" }));
        const id = (location.split("/").pop() as string).replace(/\.[^.]*$/u, "");

        expect([created.status, head.status, put.status]).toStrictEqual([201, 200, 200]);
        expect(content(id)).toBe("replaced");

        const chunked = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": "10" },
                method: "POST",
            }),
        );
        const patch = await rest.fetch(
            new Request(new URL(chunked.headers.get("location") as string, endpoint).href, {
                body: "01234",
                headers: { "content-length": "5", "content-type": "application/octet-stream", "x-chunk-offset": "0" },
                method: "PATCH",
            }),
        );

        expect(patch.status).toBe(405);

        await rest.fetch(new Request(location, { method: "DELETE" }));

        expect(content(id)).toBeUndefined();

        const gone = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect(gone.status).toBe(404);
    });
});
