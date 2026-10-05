import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import RestFetch from "../../../../src/handler/rest/rest-fetch";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import type { FilePart, FileQuery, UploadFile } from "../../../../src/storage/utils/file";
import { ERRORS, throwErrorCode } from "../../../../src/utils/errors";

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
        expect.assertions(8);

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
        // Location addresses the file under the collection, not `<collection>/<id>/<id>`
        expect(secondPatch.headers.get("location")).toMatch(new RegExp(String.raw`^${basePath}${id}\.\w+$`, "u"));
    });

    it.each(["abc", "12garbage", "0"])("should refuse a chunked POST without a valid total size (%s)", async (totalSize) => {
        expect.assertions(1);

        const restHandler = new RestFetch({ storage: new MemoryStorage({ path: "/files" }) });
        const response = await restHandler.fetch(
            new Request(basePath, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": totalSize },
                method: "POST",
            }),
        );

        // No PATCH could ever be accepted for it.
        expect(response.status).toBe(400);
    });

    it("should verify X-Chunk-Checksum before storing the chunk", async () => {
        expect.assertions(4);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });
        const created = await restHandler.fetch(
            new Request(basePath, { headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": "10" }, method: "POST" }),
        );
        const id = created.headers.get("x-upload-id") as string;
        const patch = async (offset: number, body: string, checksum: string): Promise<number> =>
            restHandler
                .fetch(
                    new Request(`${basePath}${id}`, {
                        body,
                        headers: { "content-length": String(body.length), "content-type": "application/octet-stream", "x-chunk-checksum": checksum, "x-chunk-offset": String(offset) },
                        method: "PATCH",
                    }),
                )
                .then((response) => response.status);
        const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

        // Bare hex, as @visulima/storage-client sends it.
        await expect(patch(0, "hello", sha256("hello"))).resolves.toBe(202);
        await expect(patch(5, "world", sha256("WORLD"))).resolves.toBe(460);

        // The refused chunk was not recorded; base64 with an explicit algorithm works too.
        const afterMismatch = await storage.getMeta(id);

        expect(afterMismatch.metadata._chunks).toStrictEqual([expect.objectContaining({ length: 5, offset: 0 })]);
        await expect(patch(5, "world", `sha256 ${createHash("sha256").update("world").digest("base64")}`)).resolves.toBe(200);
    });

    it("should not let X-File-Metadata set internal chunk state", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage({ maxUploadSize: 100, path: "/files" });
        const restHandler = new RestFetch({ storage });
        const response = await restHandler.fetch(
            new Request(basePath, {
                headers: {
                    "content-type": "application/octet-stream",
                    "x-chunked-upload": "true",
                    "x-file-metadata": JSON.stringify({ _chunks: [{ length: 50, offset: 0 }], _totalSize: 10_000 }),
                    "x-total-size": "50",
                },
                method: "POST",
            }),
        );
        const file = await storage.getMeta(response.headers.get("x-upload-id") as string);

        expect(file.metadata._totalSize).toBe(50);
        expect(file.metadata._chunks).toStrictEqual([]);
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

    it.each(["-5", "5x"])("should reject PATCH with the malformed X-Chunk-Offset %s", async (offset) => {
        expect.assertions(1);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const createResponse = await restHandler.fetch(initChunkedUpload(10));
        const id = createResponse.headers.get("x-upload-id") as string;

        const request = patchChunk(id, 0, new Uint8Array(5));

        request.headers.set("x-chunk-offset", offset);

        const response = await restHandler.fetch(request);

        expect(response.status).toBe(400);
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

    it("should store out-of-order chunks at their offsets (#893)", async () => {
        expect.assertions(4);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const createResponse = await restHandler.fetch(initChunkedUpload(10));
        const id = createResponse.headers.get("x-upload-id") as string;

        const lastChunk = await restHandler.fetch(patchChunk(id, 5, new Uint8Array(5).fill(66)));

        expect(lastChunk.status).toBe(202);

        const firstChunk = await restHandler.fetch(patchChunk(id, 0, new Uint8Array(5).fill(65)));

        expect(firstChunk.status).toBe(200);
        expect(firstChunk.headers.get("x-upload-complete")).toBe("true");

        const file = await storage.get({ id });

        expect(Buffer.from(file.content).toString("latin1")).toBe("AAAAABBBBB");
    });

    it("should not record a chunk the provider refused (#892)", async () => {
        expect.assertions(6);

        const storage = new MemoryStorage({ path: "/files" });
        const write = storage.write.bind(storage);
        let refused = false;

        storage.write = async (part: FilePart | FileQuery) => {
            if ((part as FilePart).start === 5 && !refused) {
                refused = true;

                const error = new Error("simulated provider refusal") as Error & { statusCode: number };

                error.statusCode = 409;

                throw error;
            }

            return write(part);
        };

        const restHandler = new RestFetch({ storage });

        const createResponse = await restHandler.fetch(initChunkedUpload(10));
        const id = createResponse.headers.get("x-upload-id") as string;

        const refusedResponse = await restHandler.fetch(patchChunk(id, 5, new Uint8Array(5).fill(66)));

        expect(refusedResponse.ok).toBe(false);

        const firstChunk = await restHandler.fetch(patchChunk(id, 0, new Uint8Array(5).fill(65)));

        expect(firstChunk.status).toBe(202);
        expect(firstChunk.headers.get("x-upload-complete")).toBe("false");
        expect(firstChunk.headers.get("x-upload-offset")).toBe("5");

        const headResponse = await restHandler.fetch(new Request(`${basePath}${id}`, { method: "HEAD" }));

        expect(headResponse.headers.get("x-upload-complete")).toBe("false");

        const retried = await restHandler.fetch(patchChunk(id, 5, new Uint8Array(5).fill(66)));

        expect(retried.headers.get("x-upload-complete")).toBe("true");
    });

    it("should retry a busy chunk lock instead of dropping a stored chunk", async () => {
        expect.assertions(3);

        const storage = new MemoryStorage({ path: "/files" });
        const withLock = storage.withLock.bind(storage);
        let busy = true;

        storage.withLock = async <R>(key: string, function_: () => Promise<R>): Promise<R> => {
            if (busy) {
                busy = false;

                return throwErrorCode(ERRORS.FILE_LOCKED);
            }

            return withLock(key, function_);
        };

        const restHandler = new RestFetch({ storage });

        const createResponse = await restHandler.fetch(initChunkedUpload(10));
        const id = createResponse.headers.get("x-upload-id") as string;

        const lastChunk = await restHandler.fetch(patchChunk(id, 5, new Uint8Array(5).fill(66)));

        expect(lastChunk.status).toBe(202);

        const file = await storage.getMeta(id);

        expect(file.metadata._chunks).toStrictEqual([expect.objectContaining({ length: 5, offset: 5 })]);
        expect(file.status).toBe("part");
    });

    it("should reopen a stale completed status instead of swallowing missing chunks", async () => {
        expect.assertions(4);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });

        const createResponse = await restHandler.fetch(initChunkedUpload(10));
        const id = createResponse.headers.get("x-upload-id") as string;

        await restHandler.fetch(patchChunk(id, 5, new Uint8Array(5).fill(66)));
        // Simulate the window where the provider marked the upload completed before the handler reverted it.
        await storage.update({ id }, { status: "completed" });

        const firstChunk = await restHandler.fetch(patchChunk(id, 0, new Uint8Array(5).fill(65)));

        expect(firstChunk.status).toBe(200);
        expect(firstChunk.headers.get("x-upload-complete")).toBe("true");

        const file = await storage.get({ id });

        expect(Buffer.from(file.content).toString("latin1")).toBe("AAAAABBBBB");
        expect(file.size).toBe(10);
    });

    it("should complete an upload whose chunks are PATCHed concurrently (#902)", async () => {
        expect.assertions(6);

        const storage = new MemoryStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });
        const bytes = new Uint8Array(40_000).map((_, index) => index % 251);

        const createResponse = await restHandler.fetch(initChunkedUpload(bytes.byteLength));
        const id = createResponse.headers.get("x-upload-id") as string;

        const responses = await Promise.all(
            [0, 10_000, 20_000, 30_000].map(async (offset) => restHandler.fetch(patchChunk(id, offset, bytes.slice(offset, offset + 10_000)))),
        );

        expect(responses.map((response) => response.status).toSorted()).toStrictEqual([200, 202, 202, 202]);
        expect(responses.filter((response) => response.headers.get("x-upload-complete") === "true")).toHaveLength(1);

        const meta = await storage.getMeta(id);

        expect(meta.metadata._chunks).toHaveLength(4);
        expect(meta.status).toBe("completed");

        const file = await storage.get({ id });

        expect(Buffer.from(file.content).equals(Buffer.from(bytes))).toBe(true);
        expect(file.size).toBe(bytes.byteLength);
    });

    it("should keep chunk records a slow concurrent write would overwrite (#902)", async () => {
        expect.assertions(4);

        let releaseFirstChunk!: () => void;
        const firstChunkGate = new Promise<void>((resolve) => {
            releaseFirstChunk = resolve;
        });

        // The write for offset 0 reads the file record, then stalls until the other chunks are
        // recorded, so the record it saves afterwards carries a stale (empty) `_chunks`.
        class SlowFirstChunkStorage extends MemoryStorage {
            public override async write(part: FilePart | FileQuery): Promise<UploadFile> {
                if ("start" in part && part.start === 0 && part.body) {
                    const { body } = part;

                    return super.write({
                        ...part,
                        body: (async function* gated() {
                            await firstChunkGate;
                            yield* body as AsyncIterable<Uint8Array>;
                        })() as unknown as FilePart["body"],
                    });
                }

                return super.write(part);
            }
        }

        const storage = new SlowFirstChunkStorage({ path: "/files" });
        const restHandler = new RestFetch({ storage });
        const bytes = new Uint8Array(30).map((_, index) => 65 + (index % 26));

        const createResponse = await restHandler.fetch(initChunkedUpload(bytes.byteLength));
        const id = createResponse.headers.get("x-upload-id") as string;

        const first = restHandler.fetch(patchChunk(id, 0, bytes.slice(0, 10)));
        const others = await Promise.all([10, 20].map(async (offset) => restHandler.fetch(patchChunk(id, offset, bytes.slice(offset, offset + 10)))));

        releaseFirstChunk();

        const firstResponse = await first;

        expect(others.map((response) => response.status)).toStrictEqual([202, 202]);
        expect(firstResponse.headers.get("x-upload-complete")).toBe("true");

        const meta = await storage.getMeta(id);

        expect(meta.metadata._chunks).toHaveLength(3);
        expect(meta.status).toBe("completed");
    });
});
