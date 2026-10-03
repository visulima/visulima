import { describe, expect, it } from "vitest";

import RestFetch from "../../../../src/handler/rest/rest-fetch";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";

describe("fetch RestFetch chunked uploads", () => {
    const basePath = "http://localhost/files/";

    const initChunkedUpload = (totalSize: number): Request =>
        new Request(basePath, {
            headers: {
                "content-type": "application/octet-stream",
                "x-chunked-upload": "true",
                "x-total-size": String(totalSize),
            },
            method: "POST",
        });

    const patchChunk = (id: string, offset: number, chunk: Uint8Array): Request =>
        new Request(`${basePath}${id}`, {
            body: chunk,
            headers: {
                "content-length": String(chunk.byteLength),
                "content-type": "application/octet-stream",
                "x-chunk-offset": String(offset),
            },
            method: "PATCH",
        });

    it("should store chunk tracking metadata when initializing a chunked upload", async () => {
        expect.assertions(4);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const response = await restHandler.fetch(initChunkedUpload(10));

        expect(response.status).toBe(201);
        expect(response.headers.get("x-chunked-upload")).toBe("true");

        const id = response.headers.get("x-upload-id") as string;

        expect(id).not.toBeNull();

        const file = await storage.getMeta(id);

        expect(file.metadata).toStrictEqual(expect.objectContaining({ _chunkedUpload: true, _chunks: [], _totalSize: 10 }));
    });

    it("should accept PATCH chunks and report progress via HEAD", async () => {
        expect.assertions(7);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const createResponse = await restHandler.fetch(initChunkedUpload(10));
        const id = createResponse.headers.get("x-upload-id") as string;

        const firstPatch = await restHandler.fetch(patchChunk(id, 0, new Uint8Array(5).fill(65)));

        expect(firstPatch.status).toBe(202);
        expect(firstPatch.headers.get("x-upload-offset")).toBe("5");

        const headResponse = await restHandler.fetch(new Request(`${basePath}${id}`, { method: "HEAD" }));

        expect(headResponse.status).toBe(200);
        expect(headResponse.headers.get("x-chunked-upload")).toBe("true");
        expect(headResponse.headers.get("x-upload-offset")).toBe("5");

        const secondPatch = await restHandler.fetch(patchChunk(id, 5, new Uint8Array(5).fill(66)));

        expect(secondPatch.status).toBe(200);
        expect(secondPatch.headers.get("x-upload-complete")).toBe("true");
    });

    it("should not mark a POST as chunked without a valid total size", async () => {
        expect.assertions(3);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const response = await restHandler.fetch(
            new Request(basePath, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": "abc" },
                method: "POST",
            }),
        );

        expect(response.status).toBe(201);

        const file = await storage.getMeta(response.headers.get("x-upload-id") as string);

        expect(file.metadata._chunkedUpload).toBeUndefined();
        expect(Number.isNaN(file.size)).toBe(false);
    });

    it.each(["null", "[1,2]", "42", '"text"'])("should ignore non-object X-File-Metadata %s on chunked init", async (metadataHeader) => {
        expect.assertions(2);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const request = initChunkedUpload(10);

        request.headers.set("x-file-metadata", metadataHeader);

        const response = await restHandler.fetch(request);

        expect(response.status).toBe(201);

        const file = await storage.getMeta(response.headers.get("x-upload-id") as string);

        expect(file.metadata).toStrictEqual({ _chunkedUpload: true, _chunks: [], _totalSize: 10 });
    });

    it("should reject PATCH with a non-numeric Content-Length", async () => {
        expect.assertions(1);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const createResponse = await restHandler.fetch(initChunkedUpload(10));
        const id = createResponse.headers.get("x-upload-id") as string;

        const response = await restHandler.fetch(
            new Request(`${basePath}${id}`, {
                body: new Uint8Array(5),
                headers: { "content-length": "abc", "x-chunk-offset": "0" },
                method: "PATCH",
            }),
        );

        expect(response.status).toBe(400);
    });

    it("should answer 413 for an oversized batch-delete body instead of deleting the URL id", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const createResponse = await restHandler.fetch(initChunkedUpload(10));
        const id = createResponse.headers.get("x-upload-id") as string;

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
});
