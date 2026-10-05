import { createServer } from "node:http";

import supertest from "supertest";
import { describe, expect, it, vi } from "vitest";

import { Tus } from "../../../src/handler/tus/tus";
import { Tus as TusFetch, TUS_RESUMABLE } from "../../../src/handler/tus/tus-fetch";
import MemoryStorage from "../../../src/storage/memory/memory-storage";

const MISSING = "a1b2c3d4-e5f6-4789-abcd-1234567890ab";

/** TUS requires Tus-Resumable on every response, errors included, and a browser client must be able to read it. */
describe("tus error responses", () => {
    describe("node", () => {
        const server = (storage = new MemoryStorage()): ReturnType<typeof createServer> => {
            const tus = new Tus({ storage });

            return createServer((request, response) => {
                tus.handle(request, response).catch(() => undefined);
            });
        };

        it.each([
            ["a missing upload", async (agent: supertest.Agent) => agent.head(`/files/${MISSING}`).set("Tus-Resumable", TUS_RESUMABLE), 404],
            ["an unsupported method", async (agent: supertest.Agent) => agent.put("/files").set("Tus-Resumable", TUS_RESUMABLE), 405],
        ])("should carry and expose Tus-Resumable on %s", async (_name, send, status) => {
            expect.assertions(3);

            const response = await send(supertest.agent(server()));

            expect(response.status).toBe(status);
            expect(response.headers["tus-resumable"]).toBe(TUS_RESUMABLE);
            expect(response.headers["access-control-expose-headers"]).toContain("tus-resumable");
        });

        it("should hide an unexpected error's message and still answer as TUS", async () => {
            expect.assertions(3);

            const storage = new MemoryStorage();

            // The first storage call of a PATCH.
            vi.spyOn(storage, "claimWrite").mockRejectedValue(new Error("db password=hunter2"));

            const response = await supertest(server(storage))
                .patch(`/files/${MISSING}`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Offset", "0")
                .set("Content-Type", "application/offset+octet-stream")
                .send(Buffer.from("x"));

            expect(response.status).toBe(500);
            expect(response.headers["tus-resumable"]).toBe(TUS_RESUMABLE);
            expect(response.text).not.toContain("hunter2");
        });
    });

    describe("fetch", () => {
        it.each([
            ["a missing upload", new Request(`http://localhost/files/${MISSING}`, { headers: { "Tus-Resumable": TUS_RESUMABLE }, method: "HEAD" }), 404],
            ["an unsupported method", new Request("http://localhost/files", { headers: { "Tus-Resumable": TUS_RESUMABLE }, method: "PUT" }), 405],
        ])("should carry and expose Tus-Resumable on %s", async (_name, request, status) => {
            expect.assertions(3);

            const response = await new TusFetch({ storage: new MemoryStorage() }).fetch(request);

            expect(response.status).toBe(status);
            expect(response.headers.get("tus-resumable")).toBe(TUS_RESUMABLE);
            expect(response.headers.get("access-control-expose-headers")).toContain("tus-resumable");
        });

        it("should hide an unexpected error's message and still answer as TUS", async () => {
            expect.assertions(3);

            const storage = new MemoryStorage();

            // The first storage call of a PATCH.
            vi.spyOn(storage, "claimWrite").mockRejectedValue(new Error("db password=hunter2"));

            const response = await new TusFetch({ storage }).fetch(
                new Request(`http://localhost/files/${MISSING}`, { body: "", headers: { "Content-Type": "application/offset+octet-stream", "Tus-Resumable": TUS_RESUMABLE, "Upload-Offset": "0" }, method: "PATCH" }),
            );

            expect(response.status).toBe(500);
            expect(response.headers.get("tus-resumable")).toBe(TUS_RESUMABLE);
            await expect(response.text()).resolves.not.toContain("hunter2");
        });
    });
});
