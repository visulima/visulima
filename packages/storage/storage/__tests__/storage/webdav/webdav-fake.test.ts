import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Files } from "../../../src/files";
import RestFetch from "../../../src/handler/rest/rest-fetch";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import type { WebdavStorageOptions } from "../../../src/storage/webdav/types";
import WebdavStorage from "../../../src/storage/webdav/webdav-storage";
import { ERRORS } from "../../../src/utils/errors";
import { describeStorageContract } from "../../__helpers__/storage-contract";

const BASE = "https://dav.test/remote.php/dav/files/alice";
const BASE_PATH = "/remote.php/dav/files/alice";

/**
 * In-memory WebDAV server behind a `fetch` stub: a tree of collections and files that answers
 * the RFC 4918 verbs the adapter uses. PUT/COPY/MOVE into a missing collection answer 409 like
 * a real server, MKCOL on an existing collection 405. `fail` forces a status for one method,
 * `ignoreRange` makes GET answer 200 with the whole body. `If-Match` / `If-None-Match`,
 * `Overwrite: F` and tagged `If` headers answer 412 when they do not hold.
 */
const server = {
    auth: `Basic ${Buffer.from("alice:secret").toString("base64")}`,
    dirs: new Set<string>([""]),
    fail: {} as Record<string, number>,
    files: new Map<string, { body: Buffer; contentType: string; etag?: string; modifiedAt: Date }>(),
    generation: 0,
    ignoreRange: false,
    requests: [] as string[],
};

const etagOf = (path: string): string => server.files.get(path)?.etag ?? `"e-${path}"`;

const nextETag = (): string => {
    server.generation += 1;

    return `"g${String(server.generation)}"`;
};

/** Whether an `If-Match` / `If-None-Match` predicate fails for what `path` stores. */
const failsCondition = (path: string, ifMatch: string | null, ifNoneMatch: string | null): boolean =>
    (ifNoneMatch === "*" && server.files.has(path)) || (ifMatch !== null && (!server.files.has(path) || etagOf(path) !== ifMatch));

const parent = (path: string): string => path.split("/").slice(0, -1).join("/");
const toPath = (url: string): string => decodeURIComponent(new URL(url).pathname.slice(BASE_PATH.length)).replaceAll(/^\/+|\/+$/gu, "");
const encode = (path: string): string => path.split("/").map((segment) => encodeURIComponent(segment)).join("/");

const propResponse = (path: string): string => {
    const file = server.files.get(path);
    const href = `${BASE_PATH}/${encode(path)}${file ? "" : "/"}`.replace(/\/\/$/u, "/");
    const props = file
        ? `<D:resourcetype/><D:getcontentlength>${String(file.body.length)}</D:getcontentlength><D:getcontenttype>${file.contentType}</D:getcontenttype><D:getlastmodified>${file.modifiedAt.toUTCString()}</D:getlastmodified><D:getetag>${etagOf(path)}</D:getetag>`
        : "<D:resourcetype><D:collection/></D:resourcetype>";

    return `<D:response><D:href>${href}</D:href><D:propstat><D:prop>${props}</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`;
};

const handle = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    const path = toPath(url);

    server.requests.push(`${method} ${path}`);

    if (headers.get("authorization") !== server.auth) {
        return new Response(null, { status: 401 });
    }

    if (server.fail[method]) {
        return new Response("boom", { status: server.fail[method], statusText: "Failure" });
    }

    switch (method) {
        case "COPY":
        case "MOVE": {
            const source = server.files.get(path);
            const target = toPath(headers.get("destination") as string);
            const tagged = /^<([^>]+)> \(\[("[^"]*")\]\)$/u.exec(headers.get("if") ?? "");

            if (!source) {
                return new Response(null, { status: failsCondition(path, headers.get("if-match"), null) ? 412 : 404 });
            }

            if (
                failsCondition(path, headers.get("if-match"), null) ||
                (headers.get("overwrite") === "F" && server.files.has(target)) ||
                (tagged !== null && failsCondition(toPath(tagged[1] as string), tagged[2] as string, null))
            ) {
                return new Response(null, { status: 412 });
            }

            if (!server.dirs.has(parent(target))) {
                return new Response(null, { status: 409 });
            }

            server.files.set(target, { ...source, etag: method === "COPY" ? nextETag() : source.etag });

            if (method === "MOVE") {
                server.files.delete(path);
            }

            return new Response(null, { status: 201 });
        }
        case "DELETE": {
            if (server.files.has(path) && failsCondition(path, headers.get("if-match"), null)) {
                return new Response(null, { status: 412 });
            }

            return new Response(null, { status: server.files.delete(path) ? 204 : 404 });
        }
        case "GET": {
            const file = server.files.get(path);

            if (!file) {
                return new Response(null, { status: 404 });
            }

            if (failsCondition(path, headers.get("if-match"), null)) {
                return new Response(null, { status: 412 });
            }

            const range = /^bytes=(\d+)-(\d*)$/u.exec(headers.get("range") ?? "");

            if (range && !server.ignoreRange) {
                const end = range[2] ? Number(range[2]) + 1 : undefined;

                return new Response(new Uint8Array(file.body.subarray(Number(range[1]), end)), { headers: { etag: etagOf(path) }, status: 206 });
            }

            return new Response(new Uint8Array(file.body), { headers: { "content-length": String(file.body.length), etag: etagOf(path) }, status: 200 });
        }
        case "MKCOL": {
            if (server.dirs.has(path) || server.files.has(path)) {
                return new Response(null, { status: 405 });
            }

            if (!server.dirs.has(parent(path))) {
                return new Response(null, { status: 409 });
            }

            server.dirs.add(path);

            return new Response(null, { status: 201 });
        }
        case "PROPFIND": {
            if (!server.dirs.has(path) && !server.files.has(path)) {
                return new Response(null, { status: 404 });
            }

            const children =
                headers.get("depth") === "1" && server.dirs.has(path)
                    ? [...server.dirs, ...server.files.keys()].filter((name) => name !== path && parent(name) === path)
                    : [];
            const body = `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:">${[path, ...children].map((name) => propResponse(name)).join("")}</D:multistatus>`;

            return new Response(body, { headers: { "content-type": "application/xml" }, status: 207 });
        }
        case "PUT": {
            if (!server.dirs.has(parent(path))) {
                return new Response(null, { status: 409 });
            }

            if (failsCondition(path, headers.get("if-match"), headers.get("if-none-match"))) {
                return new Response(null, { status: 412 });
            }

            const body = Buffer.from(await new Response(init.body).arrayBuffer());

            // Like Apache mod_dav, no ETag on the PUT response: the adapter asks with PROPFIND.
            server.files.set(path, { body, contentType: headers.get("content-type") ?? "application/octet-stream", etag: nextETag(), modifiedAt: new Date() });

            return new Response(null, { status: 201 });
        }
        default: {
            return new Response(null, { status: 405 });
        }
    }
};

const readAll = async (stream: Readable): Promise<string> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk as Uint8Array));
    }

    return Buffer.concat(chunks).toString();
};

describe("webdav storage against an in-memory WebDAV server", () => {
    const createStorage = (options: Partial<WebdavStorageOptions> = {}): WebdavStorage =>
        new WebdavStorage({
            metaStorage: new MemoryMetaStorage(),
            password: "secret",
            rootFolderPath: "/uploads/",
            url: BASE,
            username: "alice",
            ...options,
        });

    const upload = async (storage: WebdavStorage, text: string, originalName = "a.txt"): Promise<string> => {
        const file = await storage.create({ contentType: "text/plain", metadata: { owner: "me" }, originalName, size: text.length });

        await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

        return file.id;
    };

    beforeEach(() => {
        server.dirs = new Set([""]);
        server.fail = {};
        server.files.clear();
        server.ignoreRange = false;
        server.requests = [];
        vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => handle(url, init)));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describeStorageContract(() => {
        return {
            createStorage: (options) => createStorage({ conditional: true, retryConfig: { maxRetries: 0 }, ...options }),
            failBackend: (failing) => {
                server.fail = failing ? Object.fromEntries(["COPY", "DELETE", "GET", "HEAD", "MKCOL", "MOVE", "PROPFIND", "PUT"].map((method) => [method, 500])) : {};
            },
            hasObject: (key) => server.files.has(`uploads/${key}`),
            putObject: (key, content) => {
                server.dirs.add("uploads");
                server.files.set(`uploads/${key}`, { body: Buffer.from(content), contentType: "text/plain", modifiedAt: new Date() });
            },
        };
    });

    it("should run the full lifecycle: nested write, read, range, copy, move, list, delete", async () => {
        expect.assertions(14);

        const storage = createStorage({ filename: (file) => `docs/${file.originalName}` });
        const id = await upload(storage, "0123456789", "a b.txt");

        // The missing collections were created before the retried PUT.
        expect(server.files.get("uploads/docs/a b.txt")?.body.toString()).toBe("0123456789");
        expect([...server.dirs].toSorted()).toStrictEqual(["", "uploads", "uploads/docs"]);
        await expect(storage.getMeta(id)).resolves.toMatchObject({ bytesWritten: 10, metadata: { owner: "me" }, status: "completed" });
        // Creating it again returns the finished upload instead of resetting it.
        await expect(storage.create({ contentType: "text/plain", id, metadata: {}, originalName: "a b.txt", size: 10 })).resolves.toMatchObject({
            status: "completed",
        });

        const ranged = await storage.get({ id }, { range: { end: 4, start: 2 } });

        expect(ranged.content.toString()).toBe("234");

        const { size, stream } = await storage.getStream({ id }, { range: { start: 7 } });

        expect(size).toBe(3);
        await expect(readAll(stream)).resolves.toBe("789");

        // A server that ignores Range still yields the requested bytes.
        server.ignoreRange = true;

        const sliced = await storage.get({ id }, { range: { end: 4, start: 2 } });
        const tail = await storage.getStream({ id }, { range: { start: 8 } });

        expect(sliced.content.toString()).toBe("234");
        await expect(readAll(tail.stream)).resolves.toBe("89");

        await storage.copy(id, "copies/copy.txt");
        await storage.move("copies/copy.txt", "moved.txt");

        await expect(storage.getMeta("copies/copy.txt")).rejects.toMatchObject({ UploadErrorCode: ERRORS.FILE_NOT_FOUND });

        // Meta-suffixed records and files outside the root never surface; keys are root-relative.
        server.files.set("uploads/stray.META", { body: Buffer.from("{}"), contentType: "application/json", modifiedAt: new Date() });
        server.files.set("outside.txt", { body: Buffer.from("x"), contentType: "text/plain", modifiedAt: new Date() });

        const listed = await storage.list();

        expect(listed.map((file) => [file.id, file.size]).toSorted()).toStrictEqual([
            ["docs/a b.txt", 10],
            ["moved.txt", 10],
        ]);
        await expect(storage.list(1)).resolves.toHaveLength(1);

        await storage.delete({ id });

        await expect(storage.exists({ id })).resolves.toBe(false);
        expect(server.files.has("uploads/docs/a b.txt")).toBe(false);
    });

    it("should reject chunked and partial writes", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

        await expect(storage.write({ body: Readable.from([Buffer.from("56789")]), contentLength: 5, id: file.id, start: 5 })).rejects.toMatchObject({
            UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED,
        });
        await expect(storage.write({ body: Readable.from([Buffer.from("01234")]), contentLength: 5, id: file.id, start: 0 })).rejects.toMatchObject({
            UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED,
        });

        expect(server.files.size).toBe(0);
    });

    it("should tell a missing file from a failing server", async () => {
        expect.assertions(7);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        server.files.clear();

        await expect(storage.get({ id })).rejects.toMatchObject({ UploadErrorCode: ERRORS.FILE_NOT_FOUND });
        await expect(storage.exists({ id })).resolves.toBe(false);
        await expect(storage.getCompletedFile("nope")).resolves.toBeUndefined();
        await expect(storage.getCompletedFile("../escape")).rejects.toMatchObject({ UploadErrorCode: ERRORS.INVALID_FILE_NAME });

        server.fail.PROPFIND = 500;

        await expect(storage.exists({ id }, { retries: 0 })).rejects.toThrow("500");
        await expect(storage.getCompletedFile("nope", { retries: 0 })).rejects.toThrow("500");

        server.fail = { GET: 502 };

        await expect(storage.get({ id }, { retries: 0 })).rejects.toThrow("502");
    });

    it("should only send conditions when told to, and condition a copy destination with a tagged If header", async () => {
        expect.assertions(4);

        expect(new Files({ adapter: createStorage() }).capabilities.conditional).toStrictEqual({
            copy: false,
            create: false,
            delete: false,
            read: false,
            replace: false,
        });

        const files = new Files({ adapter: createStorage({ conditional: true }) });

        await files.upload("source.txt", "source");
        await files.upload("taken.txt", "taken");

        const { etag } = await files.download("taken.txt");

        await expect(files.copy("source.txt", "taken.txt", { ifMatch: "stale" })).rejects.toMatchObject({ UploadErrorCode: ERRORS.PRECONDITION_FAILED });

        await files.copy("source.txt", "taken.txt", { ifMatch: etag as string });

        expect(server.files.get("uploads/taken.txt")?.body.toString()).toBe("source");
        // The copy is a new generation: its record carries the server's new validator.
        await expect(files.head("taken.txt")).resolves.toHaveProperty("etag", etagOf("uploads/taken.txt"));
    });

    it("should not create over an upload whose metadata it cannot read", async () => {
        expect.assertions(2);

        const metaStorage = new MemoryMetaStorage();
        const storage = createStorage({ metaStorage });
        const id = await upload(storage, "hello");

        vi.spyOn(metaStorage, "get").mockRejectedValueOnce(new Error("meta store down"));

        await expect(storage.create({ contentType: "text/plain", id, metadata: {}, originalName: "a.txt", size: 5 })).rejects.toThrow("meta store down");
        await expect(storage.getMeta(id)).resolves.toMatchObject({ status: "completed" });
    });

    it("should describe a file written by other means", async () => {
        expect.assertions(2);

        const storage = createStorage();

        server.dirs.add("uploads");
        server.dirs.add("uploads/dir");
        server.files.set("uploads/raw.bin", { body: Buffer.from("abc"), contentType: "image/png", modifiedAt: new Date(0) });

        await expect(storage.getCompletedFile("raw.bin")).resolves.toMatchObject({
            contentType: "image/png",
            id: "raw.bin",
            modifiedAt: new Date(0).toISOString(),
            size: 3,
            status: "completed",
        });
        await expect(storage.getCompletedFile("dir")).resolves.toBeUndefined();
    });

    it("should send basic or bearer credentials and surface auth failures", async () => {
        expect.assertions(3);

        await expect(upload(createStorage({ password: "wrong" }), "x")).rejects.toThrow("401");

        server.auth = "Bearer t0k";

        try {
            await expect(upload(createStorage({ token: "t0k" }), "x")).resolves.toBeTypeOf("string");
            expect(server.files.size).toBe(1);
        } finally {
            server.auth = `Basic ${Buffer.from("alice:secret").toString("base64")}`;
        }
    });

    it("should keep the metadata when the server fails to delete, and treat a missing file as deleted", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        server.fail.DELETE = 500;

        await expect(storage.delete({ id }, { retries: 0 })).rejects.toThrow("500");
        await expect(storage.getMeta(id)).resolves.toMatchObject({ status: "completed" });

        server.fail = {};
        server.files.clear();

        await expect(storage.delete({ id })).resolves.toMatchObject({ status: "deleted" });
        await expect(storage.getMeta(id)).rejects.toMatchObject({ UploadErrorCode: ERRORS.FILE_NOT_FOUND });
    });

    it("should purge expired uploads", async () => {
        expect.assertions(3);

        const storage = createStorage({ expiration: { maxAge: "1h" } });
        const id = await upload(storage, "old");

        vi.useFakeTimers({ now: Date.now() + 2 * 60 * 60 * 1000 });

        try {
            const purged = await storage.purge();

            expect(purged.items.map((item) => item.id)).toStrictEqual([id]);
            expect(server.files.size).toBe(0);
            await expect(storage.getMeta(id)).rejects.toMatchObject({ UploadErrorCode: ERRORS.FILE_NOT_FOUND });
        } finally {
            vi.useRealTimers();
        }
    });

    it("should serve the REST handler: POST, HEAD, GET, PUT replace, DELETE", async () => {
        expect.assertions(5);

        const rest = new RestFetch({ storage: createStorage() });
        const endpoint = "https://app.local/upload";

        const created = await rest.fetch(new Request(endpoint, { body: "hello", headers: { "content-length": "5", "content-type": "text/plain" }, method: "POST" }));
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const head = await rest.fetch(new Request(location, { method: "HEAD" }));
        const got = await rest.fetch(new Request(location, { method: "GET" }));
        const put = await rest.fetch(new Request(location, { body: "replaced", headers: { "content-length": "8", "content-type": "text/plain" }, method: "PUT" }));

        expect([created.status, head.status, got.status, put.status]).toStrictEqual([201, 200, 200, 200]);
        await expect(got.text()).resolves.toBe("hello");
        expect([...server.files.values()].map((file) => file.body.toString())).toStrictEqual(["replaced"]);

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect(deleted.status).toBeLessThan(300);
        await expect(rest.fetch(new Request(location, { method: "HEAD" }))).resolves.toHaveProperty("status", 404);
    });
});
