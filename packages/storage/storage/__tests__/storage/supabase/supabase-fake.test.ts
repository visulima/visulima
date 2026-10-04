import { Readable } from "node:stream";
import { text } from "node:stream/consumers";

import { describe, expect, it } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import type SupabaseFile from "../../../src/storage/supabase/supabase-file";
import SupabaseStorage from "../../../src/storage/supabase/supabase-storage";
import { describeStorageContract } from "../../__helpers__/storage-contract";

type Stored = { body: Uint8Array; contentType: string; created: string; id: string };

/**
 * In-memory Supabase Storage API (bucket "media") behind the real `StorageClient`. A missing object
 * answers like the hosted API: HTTP 400 with `statusCode: "404"`. `override` answers a request
 * before the fake does, to inject failures.
 */
const createSupabase = () => {
    const objects = new Map<string, Stored>();
    const state: { override?: (request: Request, path: string) => Response | undefined } = {};
    let counter = 0;

    const json = (body: unknown, status = 200): Response => Response.json(body, { status });
    const missing = (): Response => json({ error: "not_found", message: "Object not found", statusCode: "404" }, 400);

    const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        const path = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\/object\//u, ""));
        const overridden = state.override?.(request, path);

        if (overridden) {
            return overridden;
        }

        if (path === "list/media") {
            // `prefix` names a folder; like the API, only its direct entries are listed.
            const { limit, offset, prefix } = (await request.json()) as { limit: number; offset: number; prefix: string };
            const folder = prefix ? `${prefix}/` : "";
            const entries = new Map<string>();

            for (const [key, object] of [...objects].toSorted(([a], [b]) => a.localeCompare(b))) {
                if (!key.startsWith(folder)) {
                    continue;
                }

                const [name, ...rest] = key.slice(folder.length).split("/");

                entries.set(
                    name as string,
                    rest.length > 0
                        ? { created_at: null, id: null, metadata: null, name, updated_at: null }
                        : {
                            created_at: object.created,
                            id: object.id,
                            metadata: { eTag: `"${object.id}"`, mimetype: object.contentType, size: object.body.byteLength },
                            name,
                            updated_at: object.created,
                        },
                );
            }

            return json([...entries.values()].slice(offset, offset + limit));
        }

        if (path === "copy" || path === "move") {
            const { destinationKey, sourceKey } = (await request.json()) as { destinationKey: string; sourceKey: string };
            const source = objects.get(sourceKey);

            if (!source) {
                return missing();
            }

            objects.set(destinationKey, source);

            if (path === "move") {
                objects.delete(sourceKey);

                return json({ message: "Successfully moved" });
            }

            return json({ Key: `media/${destinationKey}` });
        }

        if (request.method === "DELETE" && path === "media") {
            const { prefixes } = (await request.json()) as { prefixes: string[] };
            const removed = prefixes.filter((key) => objects.delete(key));

            return json(removed.map((name) => { return { name }; }));
        }

        if (path.startsWith("info/media/")) {
            const stored = objects.get(path.slice("info/media/".length));

            return stored ? json({ content_type: stored.contentType, etag: `"${stored.id}"`, id: stored.id, size: stored.body.byteLength }) : missing();
        }

        const key = path.slice("media/".length);

        if (request.method === "POST") {
            counter += 1;

            const id = `obj-${String(counter)}`;

            objects.set(key, {
                body: new Uint8Array(await request.arrayBuffer()),
                contentType: request.headers.get("content-type") ?? "application/octet-stream",
                created: new Date().toISOString(),
                id,
            });

            return json({ Id: id, Key: `media/${key}` });
        }

        const stored = objects.get(key);

        if (!stored) {
            return missing();
        }

        return new Response(request.method === "HEAD" ? null : stored.body, { headers: { "content-type": stored.contentType } });
    };

    return { fetch, objects, state };
};

const createStorage = (supabase: ReturnType<typeof createSupabase>, options: Partial<ConstructorParameters<typeof SupabaseStorage>[0]> = {}): SupabaseStorage =>
    new SupabaseStorage({
        bucket: "media",
        fetch: supabase.fetch,
        metaStorage: new MemoryMetaStorage<SupabaseFile>(),
        serviceKey: "service-key",
        url: "https://project.supabase.co",
        ...options,
    });

const upload = async (storage: SupabaseStorage, text: string, metadata: Record<string, string> = {}): Promise<SupabaseFile> => {
    const file = await storage.create({ contentType: "text/plain", metadata, originalName: "a.txt", size: text.length });

    return storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });
};

describe("supabase against an in-memory Storage API", () => {
    describeStorageContract(
        () => {
            const supabase = createSupabase();

            return {
                createStorage: (options) => createStorage(supabase, { retryConfig: { maxRetries: 0 }, ...options }),
                failBackend: (failing) => {
                    supabase.state.override = failing ? () => Response.json({ error: "forbidden", message: "Access denied", statusCode: "403" }, { status: 403 }) : undefined;
                },
                hasObject: (key) => supabase.objects.has(key),
                putObject: (key, content) => {
                    supabase.objects.set(key, { body: new TextEncoder().encode(content), contentType: "text/plain", created: new Date().toISOString(), id: key });
                },
            };
        },
    );
    it("should store a whole-file upload and keep its metadata after completion", async () => {
        expect.assertions(5);

        const supabase = createSupabase();
        const storage = createStorage(supabase);
        const file = await upload(storage, "hello world", { owner: "me" });

        expect(file.status).toBe("completed");
        expect(new TextDecoder().decode(supabase.objects.get(file.name)?.body)).toBe("hello world");
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ metadata: { owner: "me" }, status: "completed" });

        const read = await storage.get({ id: file.id });

        expect([read.content.toString(), read.contentType, read.metadata]).toStrictEqual(["hello world", "text/plain", { owner: "me" }]);

        const { stream } = await storage.getStream({ id: file.id });

        await expect(text(stream)).resolves.toBe("hello world");
    });

    it("should reject a chunked write without storing a partial object, then accept the whole file", async () => {
        expect.assertions(4);

        const supabase = createSupabase();
        const storage = createStorage(supabase);
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

        await expect(storage.write({ body: Readable.from([Buffer.from("01234")]), contentLength: 5, id: file.id, start: 0 })).rejects.toThrow(
            /does not support chunked/u,
        );
        await expect(storage.write({ body: Readable.from([Buffer.from("56789")]), contentLength: 5, id: file.id, start: 5 })).rejects.toThrow(
            /does not support chunked/u,
        );

        expect(supabase.objects.size).toBe(0);

        // Resuming means re-sending the whole file under the same upload.
        const done = await storage.write({ body: Readable.from([Buffer.from("0123456789")]), contentLength: 10, id: file.id, start: 0 });

        expect([done.status, new TextDecoder().decode(supabase.objects.get(file.name)?.body)]).toStrictEqual(["completed", "0123456789"]);
    });

    it("should answer exists and getCompletedFile from the stored object, and throw on other failures", async () => {
        expect.assertions(6);

        const supabase = createSupabase();
        const storage = createStorage(supabase);
        const file = await upload(storage, "hello");

        supabase.objects.set("foreign", { body: new Uint8Array(3), contentType: "image/png", created: new Date().toISOString(), id: "x" });

        await expect(storage.exists({ id: file.id })).resolves.toBe(true);
        await expect(storage.exists({ id: "nope" })).resolves.toBe(false);
        await expect(storage.getCompletedFile("foreign")).resolves.toMatchObject({ bytesWritten: 3, contentType: "image/png", size: 3, status: "completed" });
        await expect(storage.getCompletedFile("nope")).resolves.toBeUndefined();

        supabase.state.override = () => Response.json({ error: "forbidden", message: "Access denied", statusCode: "403" }, { status: 403 });

        await expect(storage.getCompletedFile("foreign")).rejects.toMatchObject({ status: 403 });
        await expect(storage.get({ id: "foreign" })).rejects.toThrow("Access denied");
    });

    it("should copy and move stored objects", async () => {
        expect.assertions(5);

        const supabase = createSupabase();
        const storage = createStorage(supabase);
        const file = await upload(storage, "hello");

        await expect(storage.copy(file.id, "copied.txt")).resolves.toMatchObject({ id: "copied.txt", path: "copied.txt" });
        await expect(storage.move("copied.txt", "moved.txt")).resolves.toMatchObject({ id: "moved.txt" });

        expect([...supabase.objects.keys()].toSorted()).toStrictEqual([file.name, "moved.txt"].toSorted());
        await expect(storage.copy("nope", "x")).rejects.toThrow("Object not found");
        await expect(storage.move("nope", "x")).rejects.toThrow("Object not found");
    });

    it("should list stored files in subfolders by their full key, without folder placeholders", async () => {
        expect.assertions(3);

        const supabase = createSupabase();
        const storage = createStorage(supabase);
        const file = await upload(storage, "hello");
        const stored = { body: new Uint8Array(1), contentType: "text/plain", created: new Date().toISOString(), id: "n" };

        supabase.objects.set("nested/deep.txt", stored);
        supabase.objects.set("user/123/file", stored);

        const listed = await storage.list();

        expect(listed.map((entry) => [entry.id, entry.size, entry.contentType]).toSorted()).toStrictEqual(
            [
                [file.name, 5, "text/plain"],
                ["nested/deep.txt", 1, "text/plain"],
                ["user/123/file", 1, "text/plain"],
            ].toSorted(),
        );
        await expect(storage.list(2)).resolves.toHaveLength(2);
        await expect(storage.list(0)).resolves.toStrictEqual([]);
    });

    it("should page through a folder holding more entries than one request returns", async () => {
        expect.assertions(1);

        const supabase = createSupabase();
        const storage = createStorage(supabase);
        const stored = { body: new Uint8Array(1), contentType: "text/plain", created: new Date().toISOString(), id: "o" };

        for (let index = 0; index < 1001; index += 1) {
            supabase.objects.set(`many/${String(index).padStart(4, "0")}`, stored);
        }

        await expect(storage.list(5000)).resolves.toHaveLength(1001);
    });

    it("should serve a REST upload end to end: POST, HEAD, PUT replace, DELETE, and refuse chunks", async () => {
        expect.assertions(7);

        const supabase = createSupabase();
        const rest = new RestFetch({ storage: createStorage(supabase) });
        const endpoint = "https://app.local/upload";

        const created = await rest.fetch(
            new Request(endpoint, { body: "hello", headers: { "content-length": "5", "content-type": "text/plain" }, method: "POST" }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const key = (): string | undefined => [...supabase.objects.keys()][0];

        expect([created.status, new TextDecoder().decode(supabase.objects.get(key() as string)?.body)]).toStrictEqual([201, "hello"]);

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect(head.status).toBe(200);

        const put = await rest.fetch(new Request(location, { body: "next", headers: { "content-length": "4", "content-type": "text/plain" }, method: "PUT" }));

        expect([put.status, new TextDecoder().decode(supabase.objects.get(key() as string)?.body)]).toStrictEqual([200, "next"]);

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect([deleted.status, supabase.objects.size]).toStrictEqual([204, 0]);

        const chunked = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": "10" },
                method: "POST",
            }),
        );
        const chunkLocation = new URL(chunked.headers.get("location") as string, endpoint).href;
        const patch = await rest.fetch(
            new Request(chunkLocation, {
                body: "01234",
                headers: { "content-length": "5", "content-type": "application/octet-stream", "x-chunk-offset": "0" },
                method: "PATCH",
            }),
        );

        expect(chunked.status).toBeLessThan(300);
        expect(patch.status).toBe(405);
        expect(supabase.objects.size).toBe(0);
    });
});
