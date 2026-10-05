import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import OneDriveStorage from "../../../src/storage/onedrive/onedrive-storage";
import type { OneDriveStorageOptions } from "../../../src/storage/onedrive/types";
import { describeStorageContract } from "../../__helpers__/storage-contract";
import { createGraph } from "./graph-fake";

const createStorage = (graph: ReturnType<typeof createGraph>, options: Partial<OneDriveStorageOptions> = {}): OneDriveStorage =>
    new OneDriveStorage({ client: graph.client, metaStorage: new MemoryMetaStorage(), rootFolderPath: "uploads", ...options });

const upload = async (storage: OneDriveStorage, text: string, metadata: Record<string, string> = {}): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata, originalName: "a.txt", size: text.length });

    await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

    return file.id;
};

const text = (graph: ReturnType<typeof createGraph>, path: string): string | undefined => {
    const item = graph.items.get(path);

    return item && Buffer.from(item.body).toString();
};

describe("onedrive against an in-memory Graph drive", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describeStorageContract(
        () => {
            const graph = createGraph();

            vi.stubGlobal("fetch", graph.fetch);

            return {
                createStorage: (options) => createStorage(graph, { retryConfig: { maxRetries: 0 }, ...options }),
                failBackend: (failing) => {
                    graph.state.override = failing ? () => Response.json({ error: { code: "accessDenied", message: "denied" } }, { status: 403 }) : undefined;
                },
                hasObject: (key) => graph.items.has(`uploads/${key}`),
                putObject: (key, content) => {
                    graph.put(`uploads/${key}`, Buffer.from(content), "text/plain");
                },
            };
        },
    );

    it("should store an upload under the root folder and keep its metadata once completed", async () => {
        expect.assertions(5);

        const graph = createGraph();
        const storage = createStorage(graph);
        const id = await upload(storage, "hello", { owner: "me" });

        expect(text(graph, `uploads/${id}`)).toBe("hello");
        await expect(storage.getMeta(id)).resolves.toMatchObject({ bytesWritten: 5, metadata: { owner: "me" }, status: "completed" });
        await expect(storage.exists({ id })).resolves.toBe(true);

        const file = await storage.get({ id });

        expect(file).toMatchObject({ contentType: "text/plain", metadata: { owner: "me" }, size: 5 });
        expect(file.content.toString()).toBe("hello");
    });

    it("should reject a partial write and accept the whole file afterwards", async () => {
        expect.assertions(4);

        const graph = createGraph();
        const storage = createStorage(graph);
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

        await expect(storage.write({ body: Readable.from([Buffer.from("01234")]), contentLength: 5, id: file.id, start: 0 })).rejects.toMatchObject({
            UploadErrorCode: "MethodNotAllowed",
        });
        await expect(storage.write({ body: Readable.from([Buffer.from("56789")]), contentLength: 5, id: file.id, start: 5 })).rejects.toMatchObject({
            UploadErrorCode: "MethodNotAllowed",
        });

        expect(graph.items.size).toBe(0);

        await storage.write({ body: Readable.from([Buffer.from("0123456789")]), contentLength: 10, id: file.id, start: 0 });

        expect(text(graph, `uploads/${file.id}`)).toBe("0123456789");
    });

    // Pushes 250 MiB through the upload-session threshold: give slow CI runners room.
    it("should send a file above 250 MB through an upload session in 5 MiB chunks, and retry after an interrupted session", { timeout: 60_000 }, async () => {
        expect.assertions(5);

        const graph = createGraph();

        vi.stubGlobal("fetch", graph.fetch);

        const storage = createStorage(graph);
        const size = 250 * 1024 * 1024 + 7;
        const bytes = Buffer.alloc(size, 3);
        const file = await storage.create({ contentType: "application/octet-stream", metadata: {}, originalName: "big.bin", size });
        let chunks = 0;

        // The session dies on its third chunk.
        graph.state.override = (method, url) => {
            if (url.host !== "upload.test") {
                return undefined;
            }

            chunks += 1;

            return chunks === 3 ? new Response("gateway", { status: 502 }) : undefined;
        };

        await expect(storage.write({ body: Readable.from([bytes]), contentLength: size, id: file.id, start: 0 })).rejects.toThrow("gateway");
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ bytesWritten: 0 });

        chunks = 0;
        graph.state.override = (method, url) => {
            if (url.host === "upload.test") {
                chunks += 1;
            }

            return undefined;
        };

        await storage.write({ body: Readable.from([bytes]), contentLength: size, id: file.id, start: 0 });

        expect(chunks).toBe(Math.ceil(size / (5 * 1024 * 1024)));
        expect(graph.items.get(`uploads/${file.id}`)?.body.byteLength).toBe(size);
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ bytesWritten: size, status: "completed" });
    });

    it("should describe a stored object without metadata, return undefined when it is missing and throw on other failures", async () => {
        expect.assertions(4);

        const graph = createGraph();
        const storage = createStorage(graph);

        graph.put("uploads/foreign.txt", new TextEncoder().encode("abc"), "text/plain");

        await expect(storage.getCompletedFile("foreign.txt")).resolves.toMatchObject({ bytesWritten: 3, contentType: "text/plain", status: "completed" });
        await expect(storage.getCompletedFile("missing.txt")).resolves.toBeUndefined();

        graph.state.override = () => Response.json({ error: { code: "accessDenied", message: "denied" } }, { status: 403 });

        await expect(storage.getCompletedFile("foreign.txt")).rejects.toMatchObject({ statusCode: 403 });
        await expect(storage.get({ id: "foreign.txt" })).rejects.toMatchObject({ statusCode: 403 });
    });

    it("should stream the content and refuse an expired upload", async () => {
        expect.assertions(3);

        const graph = createGraph();
        const storage = createStorage(graph);
        const id = await upload(storage, "streamed");
        const { size, stream } = await storage.getStream({ id });

        expect(size).toBe(8);
        expect(Buffer.concat(await stream.toArray()).toString()).toBe("streamed");

        await storage.update({ id }, { expiredAt: Date.now() - 1000 });

        await expect(storage.get({ id })).rejects.toMatchObject({ UploadErrorCode: "Gone" });
    });

    it("should copy and move objects", async () => {
        expect.assertions(5);

        const graph = createGraph();

        vi.stubGlobal("fetch", graph.fetch);

        const storage = createStorage(graph);
        const id = await upload(storage, "payload");

        const copied = await storage.copy(id, "backup/copy.txt");

        expect(copied.driveItemId).toBe(graph.items.get("uploads/backup/copy.txt")?.id);
        expect(text(graph, "uploads/backup/copy.txt")).toBe("payload");

        const moved = await storage.move("backup/copy.txt", "moved.txt");

        expect(moved).toMatchObject({ id: "moved.txt", name: "moved.txt" });
        expect(graph.items.has("uploads/backup/copy.txt")).toBe(false);
        expect(text(graph, "uploads/moved.txt")).toBe("payload");
    });

    it("should list files of the root folder and its subfolders across pages, without folders or items outside it", async () => {
        expect.assertions(3);

        const graph = createGraph(2);
        const storage = createStorage(graph);

        for (const name of ["a", "b", "c", "d", "e"]) {
            graph.put(`uploads/${name}`, new Uint8Array(1), "text/plain");
        }

        graph.put("uploads/nested/x", new Uint8Array(1), "text/plain");
        graph.put("uploads/user/123/file", new Uint8Array(1), "text/plain");
        graph.put("elsewhere/y", new Uint8Array(1), "text/plain");

        const files = await storage.list();

        expect(files.map((file) => file.id).toSorted()).toStrictEqual(["a", "b", "c", "d", "e", "nested/x", "user/123/file"]);
        await expect(storage.list(3)).resolves.toHaveLength(3);

        // An upload under a nested custom filename is listed by the key it was stored under.
        const nested = createStorage(graph, { filename: () => "user/456/report.txt" });

        await upload(nested, "hi");

        await expect(nested.list().then((listed) => listed.map((file) => file.id))).resolves.toContain("user/456/report.txt");
    });

    it("should hand out read and upload-session URLs", async () => {
        expect.assertions(3);

        const graph = createGraph();
        const id = await upload(createStorage(graph), "x");

        await expect(createStorage(graph).getReadUrl(id)).resolves.toMatch(/^https:\/\/download\.test\//u);
        await expect(createStorage(graph, { publicByDefault: true }).getReadUrl(id)).resolves.toBe(`https://share.test/uploads/${id}`);
        await expect(createStorage(graph).getUploadUrl("next.bin", { contentType: "image/png" })).resolves.toMatch(/^https:\/\/upload\.test\//u);
    });

    it("should serve a REST upload lifecycle: POST chunked + PATCH + HEAD + PUT replace + DELETE", async () => {
        expect.assertions(7);

        const graph = createGraph();
        const rest = new RestFetch({ storage: createStorage(graph) });
        const endpoint = "https://app.local/upload";

        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": "10" },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const id = (location.split("/").pop() as string).replace(/\.[^.]*$/u, "");

        // Uploads land in one request, so a chunk that is not the whole file is refused.
        const partial = await rest.fetch(
            new Request(location, {
                body: "01234",
                headers: { "content-length": "5", "content-type": "application/octet-stream", "x-chunk-offset": "0" },
                method: "PATCH",
            }),
        );

        expect(partial.status).toBe(405);

        const whole = await rest.fetch(
            new Request(location, {
                body: "0123456789",
                headers: { "content-length": "10", "content-type": "application/octet-stream", "x-chunk-offset": "0" },
                method: "PATCH",
            }),
        );

        expect([whole.status, whole.headers.get("x-upload-complete")]).toStrictEqual([200, "true"]);
        expect(text(graph, `uploads/${id}`)).toBe("0123456789");

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect([head.status, head.headers.get("x-upload-complete")]).toStrictEqual([200, "true"]);

        const replaced = await rest.fetch(
            new Request(location, { body: "next", headers: { "content-length": "4", "content-type": "application/octet-stream" }, method: "PUT" }),
        );

        expect(replaced.status).toBe(200);
        expect(text(graph, `uploads/${id}`)).toBe("next");

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect([deleted.status, graph.items.size]).toStrictEqual([204, 0]);
    });
});
