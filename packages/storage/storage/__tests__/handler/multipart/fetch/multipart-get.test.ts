import { describe, expect, it } from "vitest";

import MultipartFetch from "../../../../src/handler/multipart/multipart-fetch";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";

describe("fetch MultipartFetch GET", () => {
    it("should download an uploaded file and list files", async () => {
        expect.assertions(4);

        const storage = new MemoryStorage({ path: "/files" });
        const handler = new MultipartFetch({ storage });
        const formData = new FormData();

        formData.append("file", new Blob(["hello world"], { type: "text/plain" }), "hello.txt");

        const created = await handler.fetch(new Request("http://localhost/files", { body: formData, method: "POST" }));
        const { id } = (await created.json()) as { id: string };

        const download = await handler.fetch(new Request(`http://localhost/files/${id}`));

        expect(download.status).toBe(200);
        await expect(download.text()).resolves.toBe("hello world");

        const list = await handler.fetch(new Request("http://localhost/files"));

        expect(list.status).toBe(200);
        expect(((await list.json()) as { id: string }[]).map((file) => file.id)).toContain(id);
    });
});
