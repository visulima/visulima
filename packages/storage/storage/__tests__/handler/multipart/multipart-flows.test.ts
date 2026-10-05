import { rm } from "node:fs/promises";
import type { Server } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { temporaryDirectory } from "tempy";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import Multipart from "../../../src/handler/multipart/multipart";
import MultipartFetch from "../../../src/handler/multipart/multipart-fetch";
import DiskStorage from "../../../src/storage/local/disk-storage";
import MemoryStorage from "../../../src/storage/memory/memory-storage";
import type { BaseStorage } from "../../../src/storage/storage";
import type { Send } from "../../__helpers__/handler/flows";
import { MULTIPART_FLOW_ASSERTIONS, multipartFlow } from "../../__helpers__/handler/flows";

type Mount = (storage: BaseStorage, options?: { maxFileSize?: number }) => Promise<Send>;

let server: Server | undefined;

const mounts: Record<string, Mount> = {
    fetch: async (storage, options) => {
        const handler = new MultipartFetch({ storage, ...options });

        return async (path, init) => handler.fetch(new Request(`http://localhost${path}`, init));
    },
    node: async (storage, options) => {
        const handler = new Multipart({ storage, ...options });

        server = createServer((request, response) => {
            void handler.handle(request, response);
        });

        await new Promise<void>((resolve) => {
            server?.listen(0, "127.0.0.1", resolve);
        });

        const { port } = server.address() as AddressInfo;

        return async (path, init) => fetch(`http://127.0.0.1:${String(port)}${path}`, init);
    },
};

const upload = async (send: Send, parts: Record<string, Blob | string>, file = new Blob(["hello world"], { type: "text/plain" })): Promise<Response> => {
    const form = new FormData();

    form.append("file", file, "hello.txt");

    for (const [name, value] of Object.entries(parts)) {
        form.append(name, value);
    }

    return send("/files", { body: form, method: "POST" });
};

describe.each(Object.entries(mounts))("multipart %s handler", (_name, mount) => {
    let directory: string;

    beforeAll(() => {
        directory = temporaryDirectory();
    });

    afterEach(async () => {
        await new Promise((resolve) => {
            if (server) {
                server.close(resolve);
            } else {
                resolve(undefined);
            }
        });
        server = undefined;
    });

    afterAll(async () => {
        await rm(directory, { force: true, recursive: true });
    });

    it("should run the multipart flow on memory storage", async () => {
        expect.assertions(MULTIPART_FLOW_ASSERTIONS);

        await multipartFlow(await mount(new MemoryStorage()), "/files");
    });

    it("should run the multipart flow on disk storage", async () => {
        expect.assertions(MULTIPART_FLOW_ASSERTIONS);

        await multipartFlow(await mount(new DiskStorage({ directory })), "/files");
    });

    it("should ignore a metadata part that is not valid JSON", async () => {
        expect.assertions(2);

        const response = await upload(await mount(new MemoryStorage()), { label: "kept", metadata: "{not json" });
        const body = (await response.json()) as { metadata: Record<string, unknown> };

        expect(response.status).toBe(200);
        expect(body.metadata).toStrictEqual({ label: "kept" });
    });

    it.each([
        ["memory", () => new MemoryStorage()],
        ["disk", () => new DiskStorage({ directory })],
    ])("should keep the file part's filename over name-like fields on %s storage", async (_storage, createStorage) => {
        expect.assertions(4);

        const storage = createStorage();
        const response = await upload(await mount(storage), { metadata: JSON.stringify({ name: "from-json.txt" }), title: "My title" });
        const body = (await response.json()) as { id: string; metadata: Record<string, unknown>; originalName: string };

        expect(response.status).toBe(200);
        expect(body.originalName).toBe("hello.txt");
        expect(body.metadata).toStrictEqual({ name: "from-json.txt", title: "My title" });
        await expect(storage.getMeta(body.id)).resolves.toHaveProperty("originalName", "hello.txt");
    });

    it("should reject a request that is not multipart", async () => {
        expect.assertions(2);

        const response = await (
            await mount(new MemoryStorage())
        )("/files", {
            body: JSON.stringify({ file: "x" }),
            headers: { "content-type": "application/json" },
            method: "POST",
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ error: { message: "Invalid content-type" } });
    });

    it("should reject a form without a file part", async () => {
        expect.assertions(2);

        const form = new FormData();

        form.append("label", "no file");

        const response = await (await mount(new MemoryStorage()))("/files", { body: form, method: "POST" });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ error: { message: "No file found in multipart request" } });
    });

    it("should reject a malformed multipart body", async () => {
        expect.assertions(1);

        const response = await (
            await mount(new MemoryStorage())
        )("/files", {
            body: "garbage without boundaries",
            headers: { "content-type": "multipart/form-data; boundary=abc" },
            method: "POST",
        });

        expect(response.status).toBe(400);
    });

    it("should answer 413 when the file exceeds maxFileSize", async () => {
        expect.assertions(1);

        const response = await upload(await mount(new MemoryStorage(), { maxFileSize: 4 }), {});

        expect(response.status).toBe(413);
    });

    it("should reject a file type the storage does not allow", async () => {
        expect.assertions(1);

        const response = await upload(await mount(new MemoryStorage({ allowMIME: ["image/*"] })), {});

        expect(response.status).toBe(415);
    });

    it("should answer 404 when deleting an unknown file", async () => {
        expect.assertions(1);

        const response = await (await mount(new DiskStorage({ directory })))("/files/unknown-file-id.txt", { method: "DELETE" });

        expect(response.status).toBe(404);
    });

    it("should answer 404 when deleting the collection", async () => {
        expect.assertions(1);

        const response = await (await mount(new MemoryStorage()))("/files", { method: "DELETE" });

        expect(response.status).toBe(404);
    });

    it("should reject an unsafe id", async () => {
        expect.assertions(1);

        const response = await (await mount(new MemoryStorage()))("/files/..%2F..%2Fetc", { method: "DELETE" });

        expect(response.status).toBe(400);
    });

    it("should advertise the served methods on OPTIONS", async () => {
        expect.assertions(2);

        const response = await (await mount(new MemoryStorage()))("/files", { method: "OPTIONS" });

        expect(response.status).toBe(204);
        expect(response.headers.get("access-control-allow-methods")).toBe("DELETE, GET, OPTIONS, POST");
    });

    it("should answer 404 for GET on an unknown uuid-like id", async () => {
        expect.assertions(1);

        const response = await (await mount(new MemoryStorage()))("/files/aaaa-bbbb-cccc-dddd");

        expect(response.status).toBe(404);
    });
});
