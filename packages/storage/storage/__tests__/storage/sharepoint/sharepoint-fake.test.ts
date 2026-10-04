import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import SharePointStorage from "../../../src/storage/sharepoint/sharepoint-storage";
import type { SharePointStorageOptions } from "../../../src/storage/sharepoint/types";
import { createGraph } from "../onedrive/graph-fake";

/** A Graph drive behind the site "contoso.sharepoint.com/sites/Marketing" with a renamed "Shared Documents" library. */
const createSite = () => {
    const graph = createGraph();

    graph.state.override = (method, url) => {
        const path = decodeURIComponent(url.pathname);

        if (path === "/v1.0/sites/contoso.sharepoint.com:/sites/Marketing") {
            return Response.json({ id: "site-1" });
        }

        if (path === "/v1.0/sites/site-1/drives") {
            return Response.json({
                value: [
                    { id: "drive-other", name: "Other" },
                    { id: "drive-docs", name: "Dokumente", webUrl: "https://contoso.sharepoint.com/sites/Marketing/Shared%20Documents" },
                ],
            });
        }

        return undefined;
    };

    return graph;
};

const createStorage = (graph: ReturnType<typeof createGraph>, options: Partial<SharePointStorageOptions> = {}): SharePointStorage =>
    new SharePointStorage({
        client: graph.client,
        documentLibrary: "Shared Documents",
        metaStorage: new MemoryMetaStorage(),
        rootFolderPath: "uploads",
        siteUrl: "https://contoso.sharepoint.com/sites/Marketing",
        ...options,
    });

const upload = async (storage: SharePointStorage, text: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: { team: "growth" }, originalName: "a.txt", size: text.length });

    await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

    return file.id;
};

describe("sharepoint against an in-memory Graph drive", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should resolve the library once and run an upload through its drive", async () => {
        expect.assertions(6);

        const graph = createSite();

        vi.stubGlobal("fetch", graph.fetch);

        const storage = createStorage(graph);
        const id = await upload(storage, "hello");

        expect(graph.requests.filter((request) => request.includes("/sites/"))).toHaveLength(2);
        expect(graph.requests).toContain(`PUT /v1.0/drives/drive-docs/root:/uploads/${id}:/content`);
        await expect(storage.getMeta(id)).resolves.toMatchObject({ metadata: { team: "growth" }, status: "completed" });

        const { stream } = await storage.getStream({ id });

        expect(Buffer.concat(await stream.toArray()).toString()).toBe("hello");

        await storage.copy(id, "copy.txt");
        await storage.move("copy.txt", "archive/moved.txt");

        expect([...graph.items.keys()].toSorted()).toStrictEqual([`uploads/${id}`, "uploads/archive/moved.txt"].toSorted());
        await expect(storage.list().then((files) => files.map((file) => file.id).toSorted())).resolves.toStrictEqual([id, "archive/moved.txt"].toSorted());
    });

    it("should answer getCompletedFile from the drive and delete object and metadata", async () => {
        expect.assertions(4);

        const graph = createSite();
        const storage = createStorage(graph);
        const id = await upload(storage, "bye");

        graph.put("uploads/foreign.txt", new Uint8Array(2), "text/plain");

        await expect(storage.getCompletedFile("foreign.txt")).resolves.toMatchObject({ size: 2, status: "completed" });
        await expect(storage.getCompletedFile("missing.txt")).resolves.toBeUndefined();

        await storage.delete({ id });

        expect(graph.items.has(`uploads/${id}`)).toBe(false);
        await expect(storage.exists({ id })).resolves.toBe(false);
    });

    it("should purge expired uploads together with their metadata", async () => {
        expect.assertions(2);

        const graph = createSite();
        const storage = createStorage(graph, { expiration: { maxAge: "1h" } });
        const old = await upload(storage, "old");

        await upload(storage, "fresh");
        await storage.update({ id: old }, { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() });

        const purged = await storage.purge();

        expect(purged.items.map((item) => item.id)).toStrictEqual([old]);
        expect(graph.items.has(`uploads/${old}`)).toBe(false);
    });

    it("should serve a REST upload lifecycle: POST + PATCH + HEAD + PUT replace + DELETE", async () => {
        expect.assertions(4);

        const graph = createSite();
        const rest = new RestFetch({ storage: createStorage(graph) });
        const endpoint = "https://app.local/upload";
        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": "4" },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const id = (location.split("/").pop() as string).replace(/\.[^.]*$/u, "");
        const patched = await rest.fetch(
            new Request(location, {
                body: "abcd",
                headers: { "content-length": "4", "content-type": "application/octet-stream", "x-chunk-offset": "0" },
                method: "PATCH",
            }),
        );
        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect([patched.status, head.status, head.headers.get("x-upload-complete")]).toStrictEqual([200, 200, "true"]);

        const replaced = await rest.fetch(
            new Request(location, { body: "next", headers: { "content-length": "4", "content-type": "application/octet-stream" }, method: "PUT" }),
        );

        expect(replaced.status).toBe(200);
        expect(Buffer.from(graph.items.get(`uploads/${id}`)?.body ?? []).toString()).toBe("next");

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect([deleted.status, graph.items.size]).toStrictEqual([204, 0]);
    });
});
