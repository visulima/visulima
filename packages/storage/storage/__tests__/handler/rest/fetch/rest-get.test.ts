import { describe, expect, it } from "vitest";

import RestFetch from "../../../../src/handler/rest/rest-fetch";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import type { File } from "../../../../src/storage/utils/file";

describe("fetch RestFetch GET", () => {
    const basePath = "http://localhost/files/";
    const content = "0123456789abcdefghij";

    const setup = async (allowList = false): Promise<{ id: string; restHandler: RestFetch<File>; storage: MemoryStorage }> => {
        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ allowList, storage });

        const response = await restHandler.fetch(
            new Request(basePath, {
                body: content,
                headers: { "content-length": String(content.length), "content-type": "text/plain" },
                method: "POST",
            }),
        );
        const { id } = (await response.json()) as { id: string };

        return { id, restHandler, storage };
    };

    it("should download a file", async () => {
        expect.assertions(3);

        const { id, restHandler } = await setup();

        const response = await restHandler.fetch(new Request(`${basePath}${id}`));

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/plain");
        await expect(response.text()).resolves.toBe(content);
    });

    it("should serve a byte range with 206", async () => {
        expect.assertions(4);

        const { id, restHandler } = await setup();

        const response = await restHandler.fetch(new Request(`${basePath}${id}`, { headers: { range: "bytes=2-5" } }));

        expect(response.status).toBe(206);
        expect(response.headers.get("content-range")).toBe(`bytes 2-5/${content.length}`);
        expect(response.headers.get("content-length")).toBe("4");
        await expect(response.text()).resolves.toBe("2345");
    });

    it("should return file metadata as JSON", async () => {
        expect.assertions(3);

        const { id, restHandler } = await setup();

        const response = await restHandler.fetch(new Request(`${basePath}${id}/metadata`));

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("application/json");
        await expect(response.json()).resolves.toStrictEqual(expect.objectContaining({ id, size: content.length }));
    });

    it.each([basePath, `${basePath}V1StGXR8_Z5jdHi6B-myT`, "http://localhost/api/attachments"])(
        "should answer 404 instead of listing files for GET %s by default",
        async (url) => {
            expect.assertions(2);

            const { restHandler } = await setup();

            const response = await restHandler.fetch(new Request(url));

            expect(response.status).toBe(404);
            await expect(response.text()).resolves.not.toContain("createdAt");
        },
    );

    it("should list files when listing is enabled", async () => {
        expect.assertions(3);

        const { id, restHandler } = await setup(true);

        const response = await restHandler.fetch(new Request(basePath));
        const list = (await response.json()) as { id: string }[];

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("application/json");
        expect(list.map((file) => file.id)).toContain(id);
    });

    it("should download a file below a nested mount path", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage({ path: "/api/files" });
        const restHandler = new RestFetch({ storage });

        const created = await restHandler.fetch(
            new Request("http://localhost/api/files", {
                body: content,
                headers: { "content-length": String(content.length), "content-type": "text/plain" },
                method: "POST",
            }),
        );
        const { id } = (await created.json()) as { id: string };

        const response = await restHandler.fetch(new Request(`http://localhost/api/files/${id}`));

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe(content);
    });

    it.each(["http://localhost/api/attachments", "http://localhost/api/files-rest"])(
        "should list files for a nested collection path %s when listing is enabled",
        async (url) => {
            expect.assertions(2);

            const storage = new MemoryStorage({});
            const restHandler = new RestFetch({ allowList: true, storage });

            const response = await restHandler.fetch(new Request(url));

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toStrictEqual([]);
        },
    );

    it("should download a single-segment id when mounted at the root", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage({});
        const restHandler = new RestFetch({ storage });

        await restHandler.fetch(
            new Request("http://localhost/mydocument", {
                body: "hello",
                headers: { "content-length": "5", "content-type": "text/plain" },
                method: "PUT",
            }),
        );

        const response = await restHandler.fetch(new Request("http://localhost/mydocument"));

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe("hello");
    });

    it.each(["..%2F..%2Fetc%2Fpasswd", "%2Fetc%2Fpasswd"])("should reject the encoded traversal id %s with 400", async (id) => {
        expect.assertions(1);

        const { restHandler } = await setup();

        const response = await restHandler.fetch(new Request(`${basePath}${id}`));

        expect(response.status).toBe(400);
    });

    it("should download a file via the /download suffix", async () => {
        expect.assertions(2);

        const { id, restHandler } = await setup();

        const response = await restHandler.fetch(new Request(`${basePath}${id}/download`));

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe(content);
    });

    it("should return 404 for a missing file", async () => {
        expect.assertions(1);

        const { restHandler } = await setup();

        const response = await restHandler.fetch(new Request(`${basePath}aaaa-bbbb-cccc-dddd`));

        expect(response.status).toBe(404);
    });
});

describe("fetch RestFetch ids", () => {
    const basePath = "http://localhost/files/";

    it("should create a file under the id from the URL on PUT", async () => {
        expect.assertions(3);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });
        const id = "my-custom-file-id";

        const response = await restHandler.fetch(
            new Request(`${basePath}${id}`, {
                body: "hello",
                headers: { "content-length": "5", "content-type": "text/plain" },
                method: "PUT",
            }),
        );

        expect(response.status).toBe(201);
        expect(response.headers.get("location")).toBe(`${basePath}${id}.txt`);
        await expect(storage.getMeta(id)).resolves.toStrictEqual(expect.objectContaining({ id }));
    });

    it.each(["victim-id.META.x", "name.with.dots", "a%2Fb"])("should refuse to create a file under the unsafe client id %s on PUT", async (urlId) => {
        expect.assertions(2);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const response = await restHandler.fetch(
            new Request(`${basePath}${urlId}`, {
                body: "hello",
                headers: { "content-length": "5", "content-type": "text/plain" },
                method: "PUT",
            }),
        );

        expect(response.status).toBe(400);
        await expect(storage.list()).resolves.toHaveLength(0);
    });

    it("should not treat the collection path as a file id on PUT", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const response = await restHandler.fetch(
            new Request("http://localhost/files", {
                body: "hello",
                headers: { "content-length": "5", "content-type": "text/plain" },
                method: "PUT",
            }),
        );

        expect(response.status).toBe(400);
        await expect(storage.list()).resolves.toHaveLength(0);
    });

    it.each(["http://localhost/files/upload", "http://localhost/files/3"])("should answer 404 for DELETE %s when no such file exists", async (url) => {
        expect.assertions(1);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const response = await restHandler.fetch(new Request(url, { method: "DELETE" }));

        expect(response.status).toBe(404);
    });

    it("should address short caller-chosen ids", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        await restHandler.fetch(
            new Request(`${basePath}asset01`, {
                body: "hello",
                headers: { "content-length": "5", "content-type": "text/plain" },
                method: "PUT",
            }),
        );

        const head = await restHandler.fetch(new Request(`${basePath}asset01`, { method: "HEAD" }));
        const deleted = await restHandler.fetch(new Request(`${basePath}asset01`, { method: "DELETE" }));

        expect(head.status).toBe(200);
        expect(deleted.status).toBe(204);
    });

    it("should accept a single-segment id when mounted at the root", async () => {
        expect.assertions(1);

        const storage = new MemoryStorage({});
        const restHandler = new RestFetch({ storage });

        const created = await restHandler.fetch(
            new Request("http://localhost/", {
                body: "hello",
                headers: { "content-length": "5", "content-type": "text/plain" },
                method: "POST",
            }),
        );
        const { id } = (await created.json()) as { id: string };

        const response = await restHandler.fetch(new Request(`http://localhost/${id}`, { method: "HEAD" }));

        expect(response.status).toBe(200);
    });
});
