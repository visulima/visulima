import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Multipart as MultipartFetch, Rest as RestFetch, Tus as TusFetch } from "../../src/handler/http/fetch";
import { Multipart as MultipartNode, Rest as RestNode, Tus as TusNode } from "../../src/handler/http/node";
import MemoryMetaStorage from "../../src/storage/memory/memory-meta-storage";
import type MetaStorage from "../../src/storage/meta-storage";
import type { BaseStorage } from "../../src/storage/storage";
import type { ExpirationOptions } from "../../src/storage/types";
import type { File } from "../../src/storage/utils/file";
import { HOUR } from "./clock";
import type { Send } from "./handler/flows";
import { MULTIPART_FLOW_ASSERTIONS, multipartFlow, REST_FLOW_ASSERTIONS, restFlow, TUS_FLOW_ASSERTIONS, tusFlow } from "./handler/flows";

/** The options the matrix varies; a backend passes them on to its storage. */
export interface MatrixStorageOptions {
    expiration?: ExpirationOptions;
    filename?: (file: File) => string;
    metaStorage?: MemoryMetaStorage;
}

/** One provider's backend for a single test. */
export interface MatrixBackend {
    /** Called after the test, e.g. to remove a temp directory. */
    cleanup?: () => Promise<void> | void;
    createStorage: (options: MatrixStorageOptions) => BaseStorage;
    /** Whether the backend stores an object under `key`. */
    hasObject: (key: string) => Promise<boolean> | boolean;
    /** Stores an object under `key` as another app sharing the backend would: without upload metadata. */
    putObject: (key: string, content: string) => Promise<void> | void;
}

type Handler = "multipart" | "rest" | "tus";
type Runtime = "fetch" | "node";

export interface MatrixProvider {
    /**
     * Why purge can't find uploads stored under a custom `filename` with the provider's own meta
     * store, when it can't: such a store doesn't enumerate its records, and the listed object keys
     * don't map back to upload ids. Skips that combination.
     */
    customNamePurgeGap?: string;
    /** Size of every chunk but the last, for backends with a minimum part size (S3: 5 MiB). Default: 5 bytes. */
    minChunkSize?: number;
    /** Restricts dimensions, e.g. to keep a live run short. Unset: every value. */
    only?: { expirations?: string[]; handlers?: Handler[]; metas?: string[]; namings?: string[]; runtimes?: Runtime[] };
    /** Whether the provider assembles an object from several writes (`supportsResumableWrites`). */
    resumable: boolean;
    setup: () => MatrixBackend | Promise<MatrixBackend>;
}

const NAMINGS: Record<string, ((file: File) => string) | undefined> = {
    "custom filename": (file) => `user/42/${file.id}.bin`,
    "default id": undefined,
};

const EXPIRATIONS: Record<string, ExpirationOptions | undefined> = {
    maxAge: { maxAge: "1h" },
    "maxAge rolling": { maxAge: "1h", rolling: true },
    none: undefined,
};

const METAS = ["provider meta", "shared MemoryMetaStorage"];
const HANDLERS: Handler[] = ["rest", "tus", "multipart"];
const RUNTIMES: Runtime[] = ["fetch", "node"];

const FLOWS = { multipart: [multipartFlow, MULTIPART_FLOW_ASSERTIONS], rest: [restFlow, REST_FLOW_ASSERTIONS], tus: [tusFlow, TUS_FLOW_ASSERTIONS] } as const;

const BASE = "/files";
const TUS = { "Tus-Resumable": "1.0.0" };
const OFFSET_STREAM = "application/offset+octet-stream";

// Captured before a suite stubs the global (aws-light), so requests to the node server go out for real.
const realFetch = globalThis.fetch;

/** "0123456789012…" of `length` characters, so any byte range has a known content. */
const digits = (length: number): string => "0123456789".repeat(Math.ceil(length / 10)).slice(0, length);

const pick = <T extends string>(all: T[], only: T[] | undefined): T[] => all.filter((value) => only === undefined || only.includes(value));

const pathOf = (response: Response): string => new URL(response.headers.get("location") as string, "http://localhost").pathname;

const headerOf = async (response: Promise<Response>, name: string): Promise<string | null> => response.then(({ headers }) => headers.get(name));

const upload = async (storage: BaseStorage, content: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: content.length });

    await storage.write({ body: Readable.from([Buffer.from(content)]), contentLength: content.length, id: file.id, start: 0 });

    return file.id;
};

/** Ids of the uploads `purge` would see: a staged upload left behind shows up here. */
const uploadIds = async (storage: BaseStorage): Promise<string[]> => {
    const uploads = await (storage as unknown as { listUploads: () => Promise<{ id: string }[]> }).listUploads();

    return uploads.map(({ id }) => id).toSorted();
};

/** A body whose client goes away after three of the five bytes it announced. */
const brokenBody = (): ReadableStream<Uint8Array> =>
    new ReadableStream<Uint8Array>({
        pull(controller) {
            controller.error(new Error("client went away"));
        },
        start(controller) {
            controller.enqueue(new TextEncoder().encode("wor"));
        },
    });

/** PUTs `body` to `path`; resolves to the status, or 0 when the client itself fails the request (node runtime). */
const putBody = async (send: Send, path: string, body: ReadableStream<Uint8Array> | string, length: number): Promise<number> =>
    send(path, { body, duplex: "half", headers: { "content-length": String(length), "content-type": "text/plain" }, method: "PUT" } as RequestInit).then(
        ({ status }) => status,
        () => 0,
    );

const readText = async (send: Send, path: string): Promise<string> => send(path).then(async (response) => response.text());

/**
 * Moves an upload's timestamps `ms` into the past, as if it was created and last written then. The
 * record is rewritten rather than the clock faked: a real service refuses requests signed with a
 * clock hours off (RequestTimeTooSkewed).
 */
const age = async (storage: BaseStorage, id: string, ms: number): Promise<void> => {
    const { meta } = storage as unknown as { meta: MetaStorage };
    const file = await meta.get(id);
    const back = (date: File["createdAt"]): string | undefined => (date === undefined ? undefined : new Date(Number(new Date(date)) - ms).toISOString());

    await meta.save(id, { ...file, createdAt: back(file.createdAt), expiredAt: back(file.expiredAt), modifiedAt: back(file.modifiedAt) });
};

const listen = async (servers: Server[], handle: (request: IncomingMessage, response: ServerResponse) => Promise<void>): Promise<Send> => {
    const server = createServer((request, response) => {
        void handle(request, response);
    });

    servers.push(server);

    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const { port } = server.address() as AddressInfo;

    return async (path, init) => realFetch(`http://127.0.0.1:${String(port)}${path}`, init);
};

/** Mounts `handler` over `storage` at {@link BASE}: behind a node http server, or as a fetch handler. */
const mount = async (storage: BaseStorage, handler: Handler, runtime: Runtime, servers: Server[]): Promise<Send> => {
    if (runtime === "node") {
        const Node = { multipart: MultipartNode, rest: RestNode, tus: TusNode }[handler];

        return listen(servers, new Node({ storage }).handle);
    }

    const Fetch = { multipart: MultipartFetch, rest: RestFetch, tus: TusFetch }[handler];
    const instance = new Fetch({ storage });

    return async (path, init) => {
        const request = new Request(`http://localhost${path}`, init);

        // A runtime hands the handler the Content-Length its client sent; `new Request` sets none.
        if (typeof init?.body === "string" && !request.headers.has("content-length")) {
            request.headers.set("content-length", String(Buffer.byteLength(init.body)));
        }

        return instance.fetch(request);
    };
};

/** Uploads `content` through `handler`; resolves to the upload id and the path to address it by. */
const create = async (send: Send, handler: Handler, content: string): Promise<{ id: string; path: string }> => {
    if (handler === "tus") {
        const path = pathOf(
            await send(BASE, { body: content, headers: { ...TUS, "Content-Type": OFFSET_STREAM, "Upload-Length": String(content.length) }, method: "POST" }),
        );

        return { id: path.slice(BASE.length + 1), path };
    }

    let response: Response;

    if (handler === "multipart") {
        const form = new FormData();

        form.append("file", new Blob([content], { type: "text/plain" }), "a.txt");
        response = await send(BASE, { body: form, method: "POST" });
    } else {
        response = await send(BASE, { body: content, headers: { "content-type": "text/plain" }, method: "POST" });
    }

    const { id } = (await response.json()) as { id: string };

    return { id, path: `${BASE}/${id}` };
};

/**
 * Runs the core upload flows of every handler × runtime against a provider, for each naming ×
 * expiration × metadata storage combination: the handler flow end to end, a chunked/resumable upload
 * with a ranged read, stored names and DELETE of tracked and untracked objects, 410 for an expired
 * upload, and purge of expired uploads only.
 * @param provider The provider's backend factory and the dimensions to run
 */
export const describeMatrix = (provider: MatrixProvider): void => {
    const { minChunkSize: firstChunk = 5, only = {}, resumable } = provider;
    const runtimes = pick(RUNTIMES, only.runtimes);
    const combos = pick(HANDLERS, only.handlers).flatMap((handler) => runtimes.map((runtime) => [handler, runtime] as const));
    const cases = pick(Object.keys(NAMINGS), only.namings).flatMap((naming) =>
        pick(Object.keys(EXPIRATIONS), only.expirations).flatMap((expiration) => pick(METAS, only.metas).map((meta) => [naming, expiration, meta] as const)),
    );

    describe.each(cases)("naming: %s, expiration: %s, meta: %s", (naming, expirationName, metaName) => {
        const filename = NAMINGS[naming];
        const expiration = EXPIRATIONS[expirationName];
        const purgeGap = filename !== undefined && metaName === "provider meta" ? provider.customNamePurgeGap : undefined;
        const stored = (id: string): string => (filename ? filename({ id } as File) : id);

        let backend: MatrixBackend;
        let storage: BaseStorage;
        let servers: Server[] = [];

        const has = async (key: string): Promise<boolean> => backend.hasObject(key);

        beforeEach(async () => {
            backend = await provider.setup();
            storage = backend.createStorage({ expiration, filename, metaStorage: metaName === "provider meta" ? undefined : new MemoryMetaStorage() });
        });

        afterEach(async () => {
            await Promise.all(servers.map(async (server) => new Promise((resolve) => server.close(resolve))));
            servers = [];
            await storage.close();
            await backend.cleanup?.();
        });

        it.each(combos)("should run the %s flow end to end (%s)", async (handler, runtime) => {
            const [flow, assertions] = FLOWS[handler];

            expect.assertions(assertions);

            await flow(await mount(storage, handler, runtime, servers), BASE);
        });

        it.each(combos)("should store a %s upload under its name and DELETE only what it tracks (%s)", async (handler, runtime) => {
            expect.assertions(6);

            const send = await mount(storage, handler, runtime, servers);
            const { id, path } = await create(send, handler, "hello");

            await expect(has(stored(id))).resolves.toBe(true);

            await backend.putObject("foreign-object", "app data");

            // An object the route didn't create is neither served nor deleted through it.
            await expect(send(`${BASE}/foreign-object`, { headers: TUS, method: "DELETE" })).resolves.toHaveProperty("status", 404);
            await expect(has("foreign-object")).resolves.toBe(true);
            await expect(send(path, { headers: TUS, method: "DELETE" })).resolves.toHaveProperty("status", 204);
            await expect(has(stored(id))).resolves.toBe(false);
            // The multipart handler has no HEAD.
            await expect(send(path, { headers: TUS, method: handler === "multipart" ? "GET" : "HEAD" })).resolves.toHaveProperty("status", 404);
        });

        it.each(combos)("should store an empty %s upload (%s)", async (handler, runtime) => {
            expect.assertions(3);

            const send = await mount(storage, handler, runtime, servers);
            const { id, path } = await create(send, handler, "");

            await expect(has(stored(id))).resolves.toBe(true);
            await expect(storage.get({ id }).then(({ content }) => content.length)).resolves.toBe(0);
            // A TUS GET answers the upload's metadata, not its bytes.
            await expect(handler === "tus" ? Promise.resolve("") : readText(send, path)).resolves.toBe("");
        });

        it.each(runtimes)("should complete a TUS upload with Upload-Length 0 on creation (%s)", async (runtime) => {
            expect.assertions(6);

            const onComplete = vi.spyOn(storage, "onComplete");
            const send = await mount(storage, "tus", runtime, servers);
            const created = await send(BASE, { headers: { ...TUS, "Upload-Length": "0" }, method: "POST" });
            const id = pathOf(created).slice(BASE.length + 1);

            expect(created.status).toBe(201);
            expect(onComplete).toHaveBeenCalledTimes(1);
            await expect(has(stored(id))).resolves.toBe(true);
            await expect(storage.get({ id }).then(({ content }) => content.length)).resolves.toBe(0);

            const head = await send(pathOf(created), { headers: TUS, method: "HEAD" });

            expect([head.headers.get("upload-length"), head.headers.get("upload-offset")]).toStrictEqual(["0", "0"]);

            const patch = await send(pathOf(created), { body: "", headers: { ...TUS, "Content-Type": OFFSET_STREAM, "Upload-Offset": "0" }, method: "PATCH" });

            expect([patch.status, patch.headers.get("upload-offset")]).toStrictEqual([204, "0"]);
        });

        it.each(runtimes)("should complete a chunked REST upload with X-Total-Size 0 on creation (%s)", async (runtime) => {
            expect.assertions(5);

            const send = await mount(storage, "rest", runtime, servers);
            const created = await send(BASE, {
                headers: { "content-type": "text/plain", "x-chunked-upload": "true", "x-total-size": "0" },
                method: "POST",
            });
            const id = String(created.headers.get("x-upload-id"));

            expect(created.status).toBe(201);
            expect(created.headers.get("x-upload-complete")).toBe("true");
            await expect(has(stored(id))).resolves.toBe(true);
            await expect(readText(send, `${BASE}/${id}`)).resolves.toBe("");

            const head = await send(`${BASE}/${id}`, { method: "HEAD" });

            expect([head.headers.get("x-upload-complete"), head.headers.get("x-upload-offset")]).toStrictEqual(["true", "0"]);
        });

        it.runIf(resumable).each(runtimes)("should take a chunked REST upload and serve a byte range (%s)", async (runtime) => {
            expect.assertions(6);

            const send = await mount(storage, "rest", runtime, servers);
            const content = digits(firstChunk + 5);
            const created = await send(BASE, {
                headers: { "content-type": "text/plain", "x-chunked-upload": "true", "x-total-size": String(content.length) },
                method: "POST",
            });
            const path = `${BASE}/${String(created.headers.get("x-upload-id"))}`;
            const patch = async (offset: number, body: string): Promise<Response> =>
                send(path, { body, headers: { "content-type": "application/octet-stream", "x-chunk-offset": String(offset) }, method: "PATCH" });

            expect(created.status).toBe(201);
            await expect(patch(0, content.slice(0, firstChunk))).resolves.toHaveProperty("status", 202);
            await expect(headerOf(send(path, { method: "HEAD" }), "x-upload-offset")).resolves.toBe(String(firstChunk));
            await expect(patch(firstChunk, content.slice(firstChunk))).resolves.toHaveProperty("status", 200);

            const ranged = await send(path, { headers: { range: "bytes=2-5" } });

            expect(ranged.status).toBe(206);
            await expect(ranged.text()).resolves.toBe("2345");
        });

        it.runIf(resumable).each(runtimes)("should resume a TUS upload across PATCH requests (%s)", async (runtime) => {
            expect.assertions(4);

            const send = await mount(storage, "tus", runtime, servers);
            const content = digits(firstChunk + 5);
            const path = pathOf(await send(BASE, { headers: { ...TUS, "Upload-Length": String(content.length) }, method: "POST" }));
            const patch = async (start: number, body: string): Promise<string | null> =>
                headerOf(
                    send(path, { body, headers: { ...TUS, "Content-Type": OFFSET_STREAM, "Upload-Offset": String(start) }, method: "PATCH" }),
                    "upload-offset",
                );

            await expect(patch(0, content.slice(0, firstChunk))).resolves.toBe(String(firstChunk));
            await expect(headerOf(send(path, { headers: TUS, method: "HEAD" }), "upload-offset")).resolves.toBe(String(firstChunk));
            await expect(patch(firstChunk, content.slice(firstChunk))).resolves.toBe(String(content.length));

            const { content: stored } = await storage.get({ id: path.slice(BASE.length + 1) });

            // Compared as strings: a deep equality of a 5 MiB Buffer takes a second.
            expect(stored.toString()).toBe(content);
        });

        it.each(runtimes)("should store a TUS PATCH without Content-Length, or refuse it with 411 before reading it (%s)", async (runtime) => {
            expect.assertions(2);

            const send = await mount(storage, "tus", runtime, servers);
            const content = "hello world";
            const path = pathOf(await send(BASE, { headers: { ...TUS, "Upload-Length": String(content.length) }, method: "POST" }));
            // A stream body goes out with chunked transfer encoding: no Content-Length.
            const body = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(content));
                    controller.close();
                },
            });
            const response = await send(path, {
                body,
                duplex: "half",
                headers: { ...TUS, "Content-Type": OFFSET_STREAM, "Upload-Offset": "0" },
                method: "PATCH",
            } as RequestInit);
            // Adapters that need a chunk's length up front refuse it; the rest store every byte.
            const [status, offset] = storage.requiresContentLength ? [411, "0"] : [204, String(content.length)];

            expect(response.status).toBe(status);
            await expect(headerOf(send(path, { headers: TUS, method: "HEAD" }), "upload-offset")).resolves.toBe(offset);
        });

        it.each(runtimes)("should keep the file a REST PUT fails to replace and leave no staged upload behind (%s)", async (runtime) => {
            expect.assertions(7);

            const send = await mount(storage, "rest", runtime, servers);
            const { id, path } = await create(send, "rest", "hello");
            const before = await uploadIds(storage);

            await putBody(send, path, brokenBody(), 5);

            await expect(readText(send, path)).resolves.toBe("hello");
            // Over node http the client drops its own request, so the PUT can return before the server
            // has removed the staging upload: wait for that cleanup instead of racing it.
            await expect(
                vi.waitFor(async () => {
                    const after = await uploadIds(storage);

                    if (after.length !== before.length) {
                        throw new Error("staging upload not cleaned up yet");
                    }

                    return after;
                }),
            ).resolves.toStrictEqual(before);

            await expect(putBody(send, path, "world!", 6)).resolves.toBe(200);
            await expect(readText(send, path)).resolves.toBe("world!");
            await expect(has(stored(id))).resolves.toBe(true);
            await expect(uploadIds(storage)).resolves.toStrictEqual(before);
            await expect(storage.getMeta(id)).resolves.toMatchObject({ id, name: stored(id), size: 6, status: "completed" });
        });

        it.runIf(!resumable).each(runtimes)("should refuse a partial TUS chunk it can't assemble (%s)", async (runtime) => {
            expect.assertions(1);

            const send = await mount(storage, "tus", runtime, servers);
            const path = pathOf(await send(BASE, { headers: { ...TUS, "Upload-Length": "10" }, method: "POST" }));

            await expect(
                send(path, { body: "01234", headers: { ...TUS, "Content-Type": OFFSET_STREAM, "Upload-Offset": "0" }, method: "PATCH" }),
            ).resolves.toHaveProperty("status", 405);
        });

        it.runIf(!resumable).each(runtimes)("should serve a byte range of a whole-file REST upload (%s)", async (runtime) => {
            expect.assertions(2);

            const send = await mount(storage, "rest", runtime, servers);
            const { path } = await create(send, "rest", "0123456789");
            const ranged = await send(path, { headers: { range: "bytes=2-5" } });

            expect(ranged.status).toBe(206);
            await expect(ranged.text()).resolves.toBe("2345");
        });

        it.runIf(expiration !== undefined).each(combos)("should answer 410 for an expired %s upload (%s)", async (handler, runtime) => {
            expect.assertions(1);

            const send = await mount(storage, handler, runtime, servers);
            const id = await upload(storage, "hello");

            await age(storage, id, 2 * HOUR);

            await expect(send(`${BASE}/${id}`, { headers: TUS, method: handler === "tus" ? "HEAD" : "GET" })).resolves.toHaveProperty("status", 410);
        });

        it.runIf(expiration !== undefined && purgeGap === undefined)("should purge only its own expired uploads", async () => {
            expect.assertions(4);

            await backend.putObject("foreign-object", "app data");

            const old = await upload(storage, "old");
            const fresh = await upload(storage, "new");

            await age(storage, old, 2 * HOUR);

            const { items } = await storage.purge();

            expect(items.map((item) => item.id)).toStrictEqual([old]);
            await expect(has(stored(old))).resolves.toBe(false);
            await expect(has("foreign-object")).resolves.toBe(true);
            await expect(storage.exists({ id: fresh })).resolves.toBe(true);
        });
    });
};
