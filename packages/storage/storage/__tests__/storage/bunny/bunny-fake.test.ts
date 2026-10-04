import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import BunnyStorage from "../../../src/storage/bunny/bunny-storage";
import type { BunnyStorageOptions } from "../../../src/storage/bunny/types";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import { ERRORS } from "../../../src/utils/errors";
import { createdAgo, HOUR } from "../../__helpers__/clock";

type Stored = { body: Buffer; contentType: string; created: Date };

/**
 * In-memory Bunny storage zone "zone" behind the `@bunny.net/storage-sdk` functions the adapter calls.
 * Error messages mirror the SDK's (`File not found: …`, `Unable to upload file. …`); `remove` answers
 * `false` for a missing object like the SDK's `(await fetch()).ok`. `fail` makes the next call of an
 * operation throw.
 */
const zone = vi.hoisted(() => {
    const objects = new Map<string, Stored>();
    const fail = new Map<"get" | "list" | "remove" | "upload", Error | "false">();

    const take = (operation: "get" | "list" | "remove" | "upload"): Error | "false" | undefined => {
        const failure = fail.get(operation);

        fail.delete(operation);

        return failure;
    };

    const entry = (path: string, stored: Stored) => {
        const slash = path.lastIndexOf("/");

        return {
            checksum: `sum-${String(stored.body.byteLength)}`,
            contentType: stored.contentType,
            data: async () => {
                return { length: stored.body.byteLength, stream: new Response(new Uint8Array(stored.body)).body };
            },
            dateCreated: stored.created,
            isDirectory: false,
            lastChanged: stored.created,
            length: stored.body.byteLength,
            objectName: path.slice(slash + 1),
            path: `/zone${path.slice(0, slash + 1)}`,
            storageZoneName: "zone",
        };
    };

    const sdk = {
        file: {
            get: async (_client: unknown, path: string) => {
                const failure = take("get");

                if (failure instanceof Error) {
                    throw failure;
                }

                const stored = objects.get(path);

                if (!stored) {
                    throw new Error(`File not found: ${path}`);
                }

                return entry(path, stored);
            },
            // Lists the direct entries of one directory ("/" or "/dir/"), subdirectories as directory entries.
            list: async (_client: unknown, directory: string) => {
                const failure = take("list");

                if (failure instanceof Error) {
                    throw failure;
                }

                const subdirectories = new Set<string>();
                const files = [];

                for (const [path, stored] of objects) {
                    if (path.startsWith(directory)) {
                        const rest = path.slice(directory.length);

                        if (rest.includes("/")) {
                            subdirectories.add(rest.slice(0, rest.indexOf("/")));
                        } else {
                            files.push(entry(path, stored));
                        }
                    }
                }

                return [
                    ...[...subdirectories].map((name) => { return { isDirectory: true, length: 0, objectName: name, path: `/zone${directory}`, storageZoneName: "zone" }; }),
                    ...files,
                ];
            },
            remove: async (_client: unknown, path: string) => {
                const failure = take("remove");

                if (failure instanceof Error) {
                    throw failure;
                }

                return failure === "false" ? false : objects.delete(path);
            },
            upload: async (_client: unknown, path: string, stream: ReadableStream<Uint8Array>, options?: { contentType?: string }) => {
                const failure = take("upload");

                if (failure instanceof Error) {
                    throw failure;
                }

                const body = Buffer.from(await new Response(stream).arrayBuffer());

                objects.set(path, { body, contentType: options?.contentType ?? "application/octet-stream", created: new Date() });

                return true;
            },
        },
        regions: { StorageRegion: { Falkenstein: "de" } },
        zone: { connect_with_accesskey: () => { return { name: "zone" }; }, name: () => "zone" },
    };

    return { fail, objects, sdk };
});

vi.mock(import("@bunny.net/storage-sdk"), () => zone.sdk as never);

const createStorage = (options: Partial<BunnyStorageOptions> = {}): BunnyStorage =>
    new BunnyStorage({ accessKey: "key", expiration: { maxAge: "1h" }, metaStorage: new MemoryMetaStorage(), region: "de", zone: "zone", ...options });

const twoHoursAgo = (): string => new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

const upload = async (storage: BunnyStorage, text: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: { kept: "yes" }, originalName: "a.txt", size: text.length });

    await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

    return file.id;
};

const readAll = async (stream: Readable): Promise<string> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk as Uint8Array));
    }

    return Buffer.concat(chunks).toString();
};

describe("bunny against an in-memory storage zone", () => {
    beforeEach(() => {
        zone.objects.clear();

        zone.fail.clear();
    });

    it("should store a whole-file upload and keep its metadata after completion", async () => {
        expect.assertions(5);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        expect(zone.objects.get(`/${id}`)?.body.toString()).toBe("hello");
        await expect(storage.getMeta(id)).resolves.toMatchObject({ bytesWritten: 5, metadata: { kept: "yes" }, status: "completed" });
        // A repeated create of the same id answers the stored upload instead of starting over.
        await expect(storage.create({ contentType: "text/plain", id, metadata: {}, originalName: "a.txt", size: 5 })).resolves.toMatchObject({
            status: "completed",
        });
        // A write to a completed upload is a no-op, not a second upload.
        await expect(storage.write({ body: Readable.from([Buffer.from("other")]), contentLength: 5, id, start: 0 })).resolves.toMatchObject({
            status: "completed",
        });
        expect(zone.objects.get(`/${id}`)?.body.toString()).toBe("hello");
    });

    it("should refuse a chunked upload, leave nothing stored and still accept the whole file afterwards", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

        await expect(storage.write({ body: Readable.from([Buffer.from("01234")]), contentLength: 5, id: file.id, start: 0 })).rejects.toMatchObject({
            UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED,
        });
        expect(zone.objects.size).toBe(0);

        await storage.write({ body: Readable.from([Buffer.from("0123456789")]), contentLength: 10, id: file.id, start: 0 });

        expect(zone.objects.get(`/${file.id}`)?.body.toString()).toBe("0123456789");
    });

    it("should keep the upload resumable when the upload request fails", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 2 });

        zone.fail.set("upload", new TypeError("fetch failed"));

        await expect(storage.write({ body: Readable.from([Buffer.from("hi")]), contentLength: 2, id: file.id, start: 0 })).rejects.toMatchObject({
            UploadErrorCode: ERRORS.STORAGE_ERROR,
        });
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ bytesWritten: 0 });

        await storage.write({ body: Readable.from([Buffer.from("hi")]), contentLength: 2, id: file.id, start: 0 });

        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ status: "completed" });
    });

    it("should read a finished upload back through get, getStream, exists and getCompletedFile", async () => {
        expect.assertions(6);

        const storage = createStorage();
        const id = await upload(storage, "payload");

        await expect(storage.get({ id })).resolves.toMatchObject({ contentType: "text/plain", metadata: { kept: "yes" }, size: 7 });
        await expect(storage.getStream({ id }).then(async ({ stream }) => readAll(stream))).resolves.toBe("payload");
        await expect(storage.exists({ id })).resolves.toBe(true);
        await expect(storage.getCompletedFile(id)).resolves.toMatchObject({ bytesWritten: 7, contentType: "text/plain", status: "completed" });
        await expect(storage.getCompletedFile("missing")).resolves.toBeUndefined();

        zone.fail.set("get", new Error("An unknown error has occurred during the request."));

        await expect(storage.getCompletedFile(id)).rejects.toThrow(/unknown error/);
    });

    it("should read an object without upload metadata by its key", async () => {
        expect.assertions(2);

        zone.objects.set("/raw.bin", { body: Buffer.from("raw"), contentType: "application/octet-stream", created: new Date() });

        const result = await createStorage().get({ id: "raw.bin" });

        expect(result.content.toString()).toBe("raw");
        expect(result).toMatchObject({ metadata: {}, name: "raw.bin", size: 3 });
    });

    it("should answer GONE for an expired upload instead of serving it", async () => {
        expect.assertions(1);

        const storage = createStorage();
        const id = await upload(storage, "stale");

        await storage.saveMeta(Object.assign(await storage.getMeta(id), { expiredAt: Date.now() - 1000 }));

        await expect(storage.get({ id })).rejects.toMatchObject({ UploadErrorCode: ERRORS.GONE });
    });

    it("should report a missing object as FILE_NOT_FOUND", async () => {
        expect.assertions(1);

        await expect(createStorage().get({ id: "nope" })).rejects.toMatchObject({ UploadErrorCode: ERRORS.FILE_NOT_FOUND });
    });

    it("should copy and move objects", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        await expect(storage.copy(id, "copy.txt")).resolves.toMatchObject({ id: "copy.txt", size: 5 });
        expect(zone.objects.get("/copy.txt")?.body.toString()).toBe("hello");

        await storage.move("copy.txt", "moved.txt");

        expect(zone.objects.has("/copy.txt")).toBe(false);
        expect(zone.objects.get("/moved.txt")?.contentType).toBe("text/plain");
    });

    it("should list stored objects of every directory by key", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        zone.objects.set("/nested/deep.txt", { body: Buffer.from("x"), contentType: "text/plain", created: new Date() });
        zone.objects.set("/user/123/file", { body: Buffer.from("y"), contentType: "text/plain", created: new Date() });

        const files = await storage.list();

        expect(files.map((file) => file.id).toSorted()).toStrictEqual([id, "nested/deep.txt", "user/123/file"].toSorted());
        expect(files.find((file) => file.id === "user/123/file")).toMatchObject({ bunnyPath: "/user/123/file", size: 1 });
        await expect(storage.list(2)).resolves.toHaveLength(2);
    });

    it("should wrap a list failure", async () => {
        expect.assertions(1);

        zone.fail.set("list", new Error("Unauthorized access to storage zone: zone"));

        await expect(createStorage().list()).rejects.toMatchObject({ UploadErrorCode: ERRORS.FORBIDDEN });
    });

    it("should delete the object and its metadata, and keep the metadata when the object survives", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const kept = await upload(storage, "keep");
        const gone = await upload(storage, "gone");

        zone.fail.set("remove", "false");

        await expect(storage.delete({ id: kept })).rejects.toMatchObject({ UploadErrorCode: ERRORS.STORAGE_ERROR });
        await expect(storage.getMeta(kept)).resolves.toMatchObject({ status: "completed" });

        await storage.delete({ id: gone });

        expect(zone.objects.has(`/${gone}`)).toBe(false);
        await expect(storage.getMeta(gone)).rejects.toMatchObject({ UploadErrorCode: ERRORS.FILE_NOT_FOUND });
    });

    it("should purge expired uploads by their metadata when the meta storage cannot list", async () => {
        expect.assertions(2);

        const metaStorage = new MemoryMetaStorage();

        metaStorage.list = async () => undefined as never;

        const storage = createStorage({ metaStorage });
        const id = await createdAgo(2 * HOUR, async () => upload(storage, "old"));
        const fresh = await upload(storage, "new");
        const purged = await storage.purge();

        expect(purged.items.map((item) => item.id)).toStrictEqual([id]);
        expect([...zone.objects.keys()]).toStrictEqual([`/${fresh}`]);
    });

    it("should purge an expired upload stored under a custom filename, object and metadata", async () => {
        expect.assertions(3);

        const storage = createStorage({ filename: (file) => `custom-${file.id}.txt` });
        const id = await upload(storage, "old");
        const fresh = await upload(storage, "new");

        await storage.saveMeta(Object.assign(await storage.getMeta(id), { createdAt: twoHoursAgo() }));

        const purged = await storage.purge();

        expect(purged.items.map((item) => item.id)).toStrictEqual([id]);
        expect([...zone.objects.keys()]).toStrictEqual([`/custom-${fresh}.txt`]);
        await expect(storage.getMeta(id)).rejects.toMatchObject({ UploadErrorCode: ERRORS.FILE_NOT_FOUND });
    });

    it("should serve the REST handler: single-request POST, HEAD, PUT replace, DELETE and refuse chunked PATCH", async () => {
        expect.assertions(6);

        const rest = new RestFetch({ storage: createStorage() });
        const endpoint = "https://app.local/upload";

        const created = await rest.fetch(new Request(endpoint, { body: "hello", headers: { "content-length": "5", "content-type": "text/plain" }, method: "POST" }));
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const head = await rest.fetch(new Request(location, { method: "HEAD" }));
        const put = await rest.fetch(new Request(location, { body: "replaced", headers: { "content-length": "8", "content-type": "text/plain" }, method: "PUT" }));
        const id = (location.split("/").pop() as string).replace(/\.[^.]*$/u, "");

        expect([created.status, head.status, put.status]).toStrictEqual([201, 200, 200]);
        expect(zone.objects.get(`/${id}`)?.body.toString()).toBe("replaced");

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

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect(deleted.status).toBeLessThan(300);
        expect(zone.objects.has(`/${id}`)).toBe(false);

        const gone = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect(gone.status).toBe(404);
    });
});
