import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createStorageHandler } from "../../../src/handler/http/hono";
import MemoryStorage from "../../../src/storage/memory/memory-storage";

describe("hono createStorageHandler", () => {
    it("should route preflights and /:id/metadata to the REST handler", async () => {
        expect.assertions(3);

        const app = new Hono();

        createStorageHandler(app, { path: "/files", storage: new MemoryStorage(), type: "rest" });

        const created = await app.request("/files", { body: "hello", headers: { "content-length": "5", "content-type": "text/plain" }, method: "POST" });
        const { id } = (await created.json()) as { id: string };

        const preflight = await app.request(`/files/${id}`, { method: "OPTIONS" });
        const metadata = await app.request(`/files/${id}/metadata`);

        expect(preflight.status).toBe(204);
        expect(metadata.status).toBe(200);
        await expect(metadata.json()).resolves.toMatchObject({ id });
    });
});
