import { Readable } from "node:stream";

import { instance } from "gaxios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import GCStorage from "../../../src/storage/gcs/gcs-storage";
import { describeStorageContract } from "../../__helpers__/storage-contract";

type Stored = { body: Uint8Array; contentType: string; generation: number; updated: Date };

/**
 * In-memory GCS JSON API at https://gcs.test, bucket "uploads", installed as gaxios' fetch.
 * `override` answers a request before the fake does, to inject failures.
 */
const createGcs = () => {
    const objects = new Map<string, Stored>();
    const sessions = new Map<string, { contentType: string; name: string; received: Uint8Array; size?: number }>();
    const requests: { method: string; url: string }[] = [];
    const state: { generation: number; override?: (method: string, url: URL) => Response | undefined; pageSize?: number } = { generation: 0 };

    const json = (data: unknown, init?: ResponseInit): Response => Response.json(data, init);
    const missing = (): Response => json({ error: { code: 404, message: "No such object" } }, { status: 404 });

    const readBody = async (body: unknown): Promise<Uint8Array> => {
        if (body === undefined || body === null) {
            return new Uint8Array(0);
        }

        if (typeof body === "string") {
            return new TextEncoder().encode(body);
        }

        if (body instanceof Uint8Array) {
            return body;
        }

        const chunks: Buffer[] = [];

        for await (const chunk of body as AsyncIterable<Uint8Array>) {
            chunks.push(Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
    };

    const put = (name: string, body: Uint8Array, contentType: string): Stored => {
        state.generation += 1;

        const stored = { body, contentType, generation: state.generation, updated: new Date() };

        objects.set(name, stored);

        return stored;
    };

    const resource = (name: string, stored: Stored) => {
        return {
            contentType: stored.contentType,
            etag: `e${String(stored.generation)}`,
            generation: String(stored.generation),
            mediaLink: `https://gcs.test/download/storage/v1/b/uploads/o/${encodeURIComponent(name)}?alt=media`,
            name,
            size: String(stored.body.byteLength),
            timeCreated: stored.updated.toISOString(),
            updated: stored.updated.toISOString(),
        };
    };

    const fetch = async (input: string, init: { body?: unknown; headers?: Headers; method?: string } = {}): Promise<Response> => {
        const url = new URL(input);
        const method = init.method ?? "GET";
        const headers = new Headers(init.headers);

        requests.push({ method, url: url.href });

        const overridden = state.override?.(method, url);

        if (overridden) {
            return overridden;
        }

        const { pathname, searchParams } = url;

        if (pathname.startsWith("/session/")) {
            const session = sessions.get(pathname);

            if (!session) {
                return missing();
            }

            if (method === "DELETE") {
                sessions.delete(pathname);

                return new Response(null, { status: 499 });
            }

            const chunk = await readBody(init.body);
            // GCS takes "bytes FIRST-LAST/TOTAL" for a chunk and "bytes */TOTAL" without one.
            const contentRange = headers.get("content-range") ?? "";
            const range = /^bytes (\d+)-(\d+)\/(\d+|\*)$/u.exec(contentRange);
            const status = /^bytes \*\/(\d+|\*)$/u.exec(contentRange);

            if (!range && !status) {
                return json({ error: { code: 400, message: `Invalid Content-Range "${contentRange}"` } }, { status: 400 });
            }

            if (range && Number(range[1]) === session.received.byteLength) {
                session.received = Buffer.concat([session.received, chunk]);
            }

            // A session started without a length learns it from the last request's range.
            const total = range?.[3] ?? status?.[1];

            if (total !== undefined && total !== "*") {
                session.size ??= Number(total);
            }

            if (session.size !== undefined && session.received.byteLength >= session.size) {
                sessions.delete(pathname);

                return json(resource(session.name, put(session.name, session.received, session.contentType)));
            }

            return new Response(null, {
                headers: session.received.byteLength > 0 ? { range: `bytes=0-${String(session.received.byteLength - 1)}` } : {},
                status: 308,
            });
        }

        if (pathname === "/upload/storage/v1/b/uploads/o" && method === "POST") {
            const name = searchParams.get("name") as string;

            if (searchParams.get("uploadType") === "resumable") {
                const location = `/session/${String(sessions.size + 1)}-${encodeURIComponent(name)}`;

                sessions.set(location, {
                    contentType: headers.get("x-upload-content-type") ?? "application/octet-stream",
                    name,
                    received: new Uint8Array(0),
                    size: headers.has("x-upload-content-length") ? Number(headers.get("x-upload-content-length")) : undefined,
                });

                return new Response(null, { headers: { location: `https://gcs.test${location}`, "x-goog-upload-status": "active" } });
            }

            const ifGenerationMatch = searchParams.get("ifGenerationMatch");

            if (ifGenerationMatch !== null && String(objects.get(name)?.generation) !== ifGenerationMatch) {
                return json({ error: { code: 412 } }, { status: 412 });
            }

            return json(resource(name, put(name, await readBody(init.body), "application/json")));
        }

        const prefix = "/storage/v1/b/uploads/o";

        if (!pathname.startsWith(prefix)) {
            return json({ name: "uploads" });
        }

        if (pathname === prefix) {
            const delimiter = searchParams.get("delimiter");
            const namePrefix = searchParams.get("prefix") ?? "";
            const max = Math.min(Number(searchParams.get("maxResults") ?? 1000), state.pageSize ?? 1000);
            const offset = Number(searchParams.get("pageToken") ?? 0);
            const prefixes = new Set<string>();
            const names = [...objects.keys()]
                .filter((name) => name.startsWith(namePrefix))
                .toSorted()
                .filter((name) => {
                    const rest = name.slice(namePrefix.length);
                    const index = delimiter ? rest.indexOf(delimiter) : -1;

                    if (index !== -1) {
                        prefixes.add(namePrefix + rest.slice(0, index + (delimiter as string).length));

                        return false;
                    }

                    return true;
                });
            const page = names.slice(offset, offset + max);

            return json({
                items: page.map((name) => resource(name, objects.get(name) as Stored)),
                ...(offset + max < names.length && { nextPageToken: String(offset + max) }),
                ...(prefixes.size > 0 && { prefixes: [...prefixes] }),
            });
        }

        const rewrite = /^\/([^/]+)\/rewriteTo\/b\/([^/]+)\/o\/([^/]+)$/u.exec(pathname.slice(prefix.length));

        if (rewrite && method === "POST") {
            const source = objects.get(decodeURIComponent(rewrite[1] as string));

            if (!source) {
                return missing();
            }

            // The first call answers with a token, so the adapter has to keep rewriting.
            const token = await readBody(init.body);

            if (token.byteLength === 0) {
                return json({ done: false, rewriteToken: "t1", totalBytesRewritten: 0 });
            }

            const destination = decodeURIComponent(rewrite[3] as string);

            return json({ done: true, resource: resource(destination, put(destination, source.body, source.contentType)) });
        }

        const segment = pathname.slice(prefix.length + 1);

        // The object name is one path segment: an unencoded "/" addresses something else.
        if (segment.includes("/")) {
            return missing();
        }

        const name = decodeURIComponent(segment);
        const stored = objects.get(name);

        if (method === "DELETE") {
            return objects.delete(name) ? new Response(null, { status: 204 }) : missing();
        }

        if (!stored) {
            return missing();
        }

        if (method === "HEAD") {
            return new Response(null, { status: 200 });
        }

        if (searchParams.has("generation") && searchParams.get("generation") !== String(stored.generation)) {
            return missing();
        }

        if (searchParams.get("alt") === "media") {
            return new Response(stored.body, { headers: { "content-type": stored.contentType, "x-goog-generation": String(stored.generation) } });
        }

        return json(resource(name, stored));
    };

    return { fetch, objects, requests, sessions, state };
};

const createStorage = (options: Partial<ConstructorParameters<typeof GCStorage>[0]> = {}): GCStorage =>
    new GCStorage({
        bucket: "uploads",
        projectId: "test",
        retryOptions: { retry: 0 },
        storageAPI: "https://gcs.test/storage/v1/b",
        uploadAPI: "https://gcs.test/upload/storage/v1/b",
        ...options,
    });

const chunk = (text: string): Readable => Readable.from([Buffer.from(text)]);

const upload = async (storage: GCStorage, text: string, originalName = "a.txt"): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: { owner: "me" }, originalName, size: text.length });

    await storage.write({ body: chunk(text), contentLength: text.length, id: file.id, start: 0 });

    return file.id;
};

describe("gcs against an in-memory GCS", () => {
    let gcs: ReturnType<typeof createGcs>;

    beforeEach(() => {
        gcs = createGcs();
        instance.defaults = { fetchImplementation: gcs.fetch as never };
    });

    afterEach(() => {
        instance.defaults = {};
    });

    describeStorageContract(
        () => {
            return {
                createStorage,
                failBackend: (failing) => {
                    gcs.state.override = failing ? () => new Response("forbidden", { status: 403 }) : undefined;
                },
                hasObject: (key) => gcs.objects.has(key),
                putObject: (key, content) => {
                    gcs.objects.set(key, { body: Buffer.from(content), contentType: "text/plain", generation: 1, updated: new Date() });
                },
            };
        },
    );

    it("should upload in several chunks and keep the metadata once complete", async () => {
        expect.assertions(5);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: { owner: "me" }, originalName: "a.txt", size: 10 });

        const first = await storage.write({ body: chunk("01234"), contentLength: 5, id: file.id, start: 0 });

        expect(first).toMatchObject({ bytesWritten: 5, status: "part" });

        const last = await storage.write({ body: chunk("56789"), contentLength: 5, id: file.id, start: 5 });

        expect(last).toMatchObject({ bytesWritten: 10, status: "completed" });
        expect(Buffer.from(gcs.objects.get(file.name)?.body ?? []).toString()).toBe("0123456789");
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ metadata: { owner: "me" }, status: "completed" });
        expect(gcs.sessions.size).toBe(0);
    });

    it("should start an upload whose length is deferred and finish it once the length is known", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt" });

        expect(file).toMatchObject({ bytesWritten: 0, status: "created" });

        await storage.update({ id: file.id }, { size: 5 });

        await expect(storage.write({ body: chunk("hello"), contentLength: 5, id: file.id, start: 0 })).resolves.toMatchObject({ status: "completed" });
        expect(Buffer.from(gcs.objects.get(file.name)?.body ?? []).toString()).toBe("hello");
    });

    it("should finish a deferred-length upload with an empty last request", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt" });

        await expect(storage.write({ body: chunk("hello"), contentLength: 5, id: file.id, start: 0 })).resolves.toMatchObject({ bytesWritten: 5, status: "part" });

        // TUS: the final PATCH declares the length and carries no bytes; GCS takes "bytes */5" for it.
        await storage.update({ id: file.id }, { size: 5 });

        await expect(storage.write({ body: chunk(""), contentLength: 0, id: file.id, start: 5 })).resolves.toMatchObject({ status: "completed" });
        expect(Buffer.from(gcs.objects.get(file.name)?.body ?? []).toString()).toBe("hello");
    });

    it("should read the media of the generation whose metadata it read", async () => {
        expect.assertions(2);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 5 });

        await storage.write({ body: chunk("hello"), contentLength: 5, id: file.id, start: 0 });

        // The object is replaced between the metadata and the media request.
        gcs.state.override = (method, url) => {
            if (url.searchParams.get("alt") === "json" && url.pathname.endsWith(`/o/${file.name}`)) {
                gcs.state.override = undefined;

                return Response.json({ etag: "e-old", generation: "0", size: "5" });
            }

            return undefined;
        };

        await expect(storage.get({ id: file.id })).rejects.toBeDefined();
        expect(gcs.requests.at(-1)?.url).toContain("generation=0");
    });

    it("should save the metadata and fire onCreate for a clientDirectUpload", async () => {
        expect.assertions(3);

        const onCreate = vi.fn();
        const storage = createStorage({ clientDirectUpload: true, onCreate });
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 5 });

        expect(file.GCSUploadURI).toMatch(/^https:\/\/gcs\.test\/session\//u);
        expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ id: file.id }));
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ GCSUploadURI: file.GCSUploadURI });
    });

    it("should resume an interrupted upload at the offset GCS confirmed", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

        await storage.write({ body: chunk("0123"), contentLength: 4, id: file.id, start: 0 });

        // The connection drops while the next chunk is in flight.
        gcs.state.override = (method) => (method === "PUT" ? new Response("reset", { status: 503 }) : undefined);

        await expect(storage.write({ body: chunk("456789"), contentLength: 6, id: file.id, start: 4 })).rejects.toThrow();

        gcs.state.override = undefined;

        // A fresh storage (server restart) asks the session where it stands before writing.
        const resumed = createStorage();

        await expect(resumed.create({ contentType: "text/plain", id: file.id, metadata: {}, originalName: "a.txt", size: 10 })).resolves.toMatchObject({
            bytesWritten: 4,
        });
        await expect(resumed.write({ body: chunk("456789"), contentLength: 6, id: file.id, start: 4 })).resolves.toMatchObject({ status: "completed" });
        expect(Buffer.from(gcs.objects.get(file.name)?.body ?? []).toString()).toBe("0123456789");
    });

    it("should report a missing object as absent and other failures as errors", async () => {
        expect.assertions(5);

        const storage = createStorage();
        const id = await upload(storage, "x");

        await expect(storage.exists({ id })).resolves.toBe(true);
        await expect(storage.exists({ id: "nope" })).resolves.toBe(false);
        await expect(storage.getCompletedFile(id)).resolves.toMatchObject({ bytesWritten: 1, contentType: "text/plain", status: "completed" });
        await expect(storage.getCompletedFile("nope")).resolves.toBeUndefined();

        gcs.state.override = () => new Response("boom", { status: 500 });

        await expect(storage.getCompletedFile(id)).rejects.toMatchObject({ status: 500 });
    });

    it("should copy and move a finished upload", async () => {
        expect.assertions(5);

        const storage = createStorage();
        const id = await upload(storage, "copy me");

        await expect(storage.copy(id, "copied.txt")).resolves.toMatchObject({ id: "copied.txt", name: "copied.txt" });
        expect(Buffer.from(gcs.objects.get("copied.txt")?.body ?? []).toString()).toBe("copy me");

        await storage.move(id, "moved.txt");

        expect(Buffer.from(gcs.objects.get("moved.txt")?.body ?? []).toString()).toBe("copy me");
        expect(gcs.objects.has(id)).toBe(false);
        // The moved upload's metadata goes with the source object.
        expect(gcs.objects.has(`${id}.META`)).toBe(false);
    });

    it("should read, copy and move an upload stored under a custom filename by its id", async () => {
        expect.assertions(6);

        const storage = createStorage({ filename: (file) => `user/123/${file.originalName}` });
        const id = await upload(storage, "named", "n.txt");

        expect(gcs.objects.has("user/123/n.txt")).toBe(true);
        await expect(storage.exists({ id })).resolves.toBe(true);
        await expect(storage.get({ id })).resolves.toMatchObject({ content: Buffer.from("named") });

        await storage.copy(id, "copied.txt");

        expect(Buffer.from(gcs.objects.get("copied.txt")?.body ?? []).toString()).toBe("named");

        await storage.move(id, "moved.txt");

        expect(gcs.objects.has("user/123/n.txt")).toBe(false);
        expect(Buffer.from(gcs.objects.get("moved.txt")?.body ?? []).toString()).toBe("named");
    });

    it("should address nested object names as one encoded path segment", async () => {
        expect.assertions(5);

        const storage = createStorage({ filename: (file) => `a/${file.originalName}` });
        const id = await upload(storage, "nested", "b.txt");
        const { name } = await storage.getMeta(id);

        expect(name).toBe("a/b.txt");
        await expect(storage.get({ id: name })).resolves.toMatchObject({ content: Buffer.from("nested") });
        await expect(storage.getCompletedFile(name)).resolves.toMatchObject({ size: 6 });

        await storage.copy(name, "c/d.txt");

        expect(Buffer.from(gcs.objects.get("c/d.txt")?.body ?? []).toString()).toBe("nested");

        await storage.delete({ id });

        expect(gcs.objects.has("a/b.txt")).toBe(false);
    });

    it("should page through the bucket without listing the metadata sidecars", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const ids = [await upload(storage, "a"), await upload(storage, "b"), await upload(storage, "c")];

        gcs.state.pageSize = 2;

        const listed = await storage.list();

        expect(listed.map(({ id }) => id).toSorted()).toStrictEqual(ids.toSorted());
        await expect(storage.list(2)).resolves.toHaveLength(2);
        expect(gcs.requests.filter(({ url }) => url.includes("pageToken=")).length).toBeGreaterThan(0);
    });

    it("should collapse keys under a prefix with a delimiter", async () => {
        expect.assertions(1);

        const storage = createStorage({ filename: (file) => `dir/${file.originalName}` });

        await upload(storage, "a", "one.txt");
        await upload(storage, "b", "two.txt");
        gcs.objects.set("dir/sub/three.txt", { body: new Uint8Array(1), contentType: "text/plain", generation: 99, updated: new Date() });

        await expect(storage.listDirectory({ delimiter: "/", prefix: "dir/" })).resolves.toStrictEqual({
            files: [expect.objectContaining({ id: "dir/one.txt" }), expect.objectContaining({ id: "dir/two.txt" })],
            prefixes: ["dir/sub/"],
        });
    });

    it("should cancel the session of an unfinished upload on delete", async () => {
        expect.assertions(2);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

        await storage.write({ body: chunk("01"), contentLength: 2, id: file.id, start: 0 });
        await storage.delete({ id: file.id });

        expect(gcs.sessions.size).toBe(0);
        expect(gcs.objects.size).toBe(0);
    });

    describe("retries", () => {
        const failing = (status: number, times: number, reason?: string) => {
            let calls = 0;

            gcs.state.override = (method, url) => {
                if (url.pathname.endsWith("/o/target") && calls < times) {
                    calls += 1;

                    return Response.json(reason ? { error: { errors: [{ reason }] } } : { error: {} }, { status });
                }

                return undefined;
            };

            return () => calls;
        };

        const retrying = (): GCStorage => createStorage({ retryOptions: { retry: 2, retryBackoff: async () => undefined } });

        it("should give up on a rate limit after the configured retries", async () => {
            expect.assertions(2);

            const calls = failing(429, 50, "rateLimitExceeded");

            await expect(retrying().getCompletedFile("target")).rejects.toMatchObject({ status: 429 });
            expect(calls()).toBe(3);
        });

        it("should retry a server error and succeed", async () => {
            expect.assertions(2);

            gcs.objects.set("target", { body: new Uint8Array(3), contentType: "text/plain", generation: 1, updated: new Date() });

            const calls = failing(503, 1);

            await expect(retrying().getCompletedFile("target")).resolves.toMatchObject({ size: 3 });
            expect(calls()).toBe(1);
        });

        it("should not retry a client error or a streamed upload", async () => {
            expect.assertions(4);

            const storage = retrying();
            const calls = failing(403, 50);

            await expect(storage.getCompletedFile("target")).rejects.toMatchObject({ status: 403 });
            expect(calls()).toBe(1);

            const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 4 });
            let puts = 0;

            gcs.state.override = (method) => {
                if (method === "PUT") {
                    puts += 1;

                    return new Response("unavailable", { status: 503 });
                }

                return undefined;
            };

            // The body is single-use: re-sending it would PUT an empty, drained stream.
            await expect(storage.write({ body: chunk("abcd"), contentLength: 4, id: file.id, start: 0 })).rejects.toMatchObject({ status: 503 });
            expect(puts).toBe(1);
        });
    });

    it("should serve a chunked upload through the REST handler", async () => {
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
        const statuses: number[] = [];

        for (const [start, text] of [
            [0, "01234"],
            [5, "56789"],
        ] as const) {
            const response = await rest.fetch(
                new Request(location, {
                    body: text,
                    headers: { "content-length": "5", "content-type": "application/octet-stream", "x-chunk-offset": String(start) },
                    method: "PATCH",
                }),
            );

            statuses.push(response.status);
        }

        const id = (location.split("/").pop() as string).replace(/\.[^.]*$/u, "");

        expect(statuses).toStrictEqual([202, 200]);
        expect(Buffer.from(gcs.objects.get(id)?.body ?? []).toString()).toBe("0123456789");

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));
        const put = await rest.fetch(new Request(location, { body: "next", headers: { "content-length": "4", "content-type": "text/plain" }, method: "PUT" }));

        expect([head.status, head.headers.get("x-upload-complete"), put.status]).toStrictEqual([200, "true", 200]);

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect([deleted.status, gcs.objects.size]).toStrictEqual([204, 0]);
    });
});
