import { describe, expect, it } from "vitest";

import RestFetch from "../../../../src/handler/rest/rest-fetch";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import type { File } from "../../../../src/storage/utils/file";

describe("fetch RestFetch DELETE", () => {
    const basePath = "http://localhost/files/";

    const setup = async (): Promise<{ id: string; restHandler: RestFetch<File>; storage: MemoryStorage }> => {
        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const response = await restHandler.fetch(
            new Request(basePath, {
                body: "hello",
                headers: { "content-length": "5", "content-type": "text/plain" },
                method: "POST",
            }),
        );
        const { id } = (await response.json()) as { id: string };

        return { id, restHandler, storage };
    };

    it("should batch delete files via a JSON body", async () => {
        expect.assertions(2);

        const { id, restHandler, storage } = await setup();

        const response = await restHandler.fetch(
            new Request(basePath, { body: JSON.stringify({ ids: [id] }), headers: { "content-type": "application/json" }, method: "DELETE" }),
        );

        expect(response.status).toBe(204);
        await expect(storage.list()).resolves.toHaveLength(0);
    });

    it("should answer 413 for an oversized batch-delete body instead of deleting the URL id", async () => {
        expect.assertions(2);

        const { id, restHandler, storage } = await setup();

        const response = await restHandler.fetch(
            new Request(`${basePath}${id}`, {
                body: JSON.stringify(["x".repeat(1_100_000)]),
                headers: { "content-type": "application/json" },
                method: "DELETE",
            }),
        );

        expect(response.status).toBe(413);
        await expect(storage.getMeta(id)).resolves.toBeDefined();
    });

    it("should answer 413 for an oversized streamed batch-delete body without a Content-Length", async () => {
        expect.assertions(2);

        const { id, restHandler, storage } = await setup();
        const chunk = new TextEncoder().encode(`"${"x".repeat(64 * 1024)}",`);
        let sent = 0;
        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                sent += chunk.byteLength;
                controller.enqueue(sent > 4 * 1024 * 1024 ? new TextEncoder().encode('""]') : chunk);

                if (sent > 4 * 1024 * 1024) {
                    controller.close();
                }
            },
            start(controller) {
                controller.enqueue(new TextEncoder().encode("["));
            },
        });

        const response = await restHandler.fetch(
            new Request(`${basePath}${id}`, { body, duplex: "half", headers: { "content-type": "application/json" }, method: "DELETE" } as RequestInit),
        );

        expect(response.status).toBe(413);
        await expect(storage.getMeta(id)).resolves.toBeDefined();
    });

    it("should fall back to a single delete for a JSON body that is not a batch payload", async () => {
        expect.assertions(2);

        const { id, restHandler, storage } = await setup();

        const response = await restHandler.fetch(
            new Request(`${basePath}${id}`, { body: JSON.stringify({ reason: "cleanup" }), headers: { "content-type": "application/json" }, method: "DELETE" }),
        );

        expect(response.status).toBe(204);
        await expect(storage.list()).resolves.toHaveLength(0);
    });
});
