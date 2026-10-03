import { describe, expect, it } from "vitest";

import MultipartFetch from "../../../../src/handler/multipart/multipart-fetch";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import type { File } from "../../../../src/storage/utils/file";

describe("fetch MultipartFetch GET", () => {
    const setup = async (): Promise<{ handler: MultipartFetch<File>; id: string; storage: MemoryStorage }> => {
        const storage = new MemoryStorage({ path: "/files" });
        const handler = new MultipartFetch({ storage });
        const formData = new FormData();

        formData.append("file", new Blob(["hello world"], { type: "text/plain" }), "hello.txt");

        const created = await handler.fetch(new Request("http://localhost/files", { body: formData, method: "POST" }));
        const { id } = (await created.json()) as { id: string };

        return { handler, id, storage };
    };

    it("should download an uploaded file", async () => {
        expect.assertions(2);

        const { handler, id } = await setup();

        const download = await handler.fetch(new Request(`http://localhost/files/${id}`));

        expect(download.status).toBe(200);
        await expect(download.text()).resolves.toBe("hello world");
    });

    it("should list uploaded files", async () => {
        expect.assertions(2);

        const { handler, id } = await setup();

        const list = await handler.fetch(new Request("http://localhost/files"));

        expect(list.status).toBe(200);
        expect(((await list.json()) as { id: string }[]).map((file) => file.id)).toContain(id);
    });

    it("should delete a file with a short caller-chosen id", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage({ path: "/files" });
        const handler = new MultipartFetch({ storage });

        await storage.create({ contentType: "text/plain", id: "asset01", metadata: {}, size: 0 });

        const response = await handler.fetch(new Request("http://localhost/files/asset01", { method: "DELETE" }));

        expect(response.status).toBe(204);
        await expect(storage.list()).resolves.toHaveLength(0);
    });
});
