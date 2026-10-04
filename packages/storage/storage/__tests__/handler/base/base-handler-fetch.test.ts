import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import DiskStorage from "../../../src/storage/local/disk-storage";
import MemoryStorage from "../../../src/storage/memory/memory-storage";
import type MediaTransformer from "../../../src/transformer/media-transformer";
import { ERRORS, throwErrorCode } from "../../../src/utils/errors";
import { waitForStorageReady } from "../../__helpers__/utils";

const ID = "a1b2c3d4-e5f6-4789-abcd-1234567890ab";
const BODY = "0123456789".repeat(10);

const setup = (options: ConstructorParameters<typeof MemoryStorage>[0] = {}) => {
    const storage = new MemoryStorage({ initial: { [ID]: BODY }, ...options });
    const handler = new RestFetch({ storage });

    return { handler, storage };
};

const exposed = (response: Response): string[] => (response.headers.get("access-control-expose-headers") ?? "").split(",").map((name) => name.trim());

describe("baseHandlerFetch", () => {
    describe("range requests", () => {
        it("should answer a satisfiable range with 206 and the requested bytes", async () => {
            expect.assertions(4);

            const { handler } = setup();
            const response = await handler.fetch(new Request(`http://localhost/files/${ID}`, { headers: { range: "bytes=10-19" } }));

            expect(response.status).toBe(206);
            expect(response.headers.get("content-range")).toBe("bytes 10-19/100");
            expect(exposed(response)).toContain("content-range");
            await expect(response.text()).resolves.toBe(BODY.slice(10, 20));
        });

        it("should stream a range spanning several chunks of a larger file", async () => {
            expect.assertions(2);

            const large = Buffer.from(Array.from({ length: 300 * 1024 }, (_, index) => (index * 7) % 256));
            const directory = temporaryDirectory();
            const storage = new DiskStorage({ directory });

            await waitForStorageReady(storage);

            const handler = new RestFetch({ storage });
            const created = await handler.fetch(
                new Request("http://localhost/files", { body: large, headers: { "content-length": String(large.length), "content-type": "application/octet-stream" }, method: "POST" }),
            );
            const { id } = (await created.json()) as { id: string };
            const response = await handler.fetch(new Request(`http://localhost/files/${id}`, { headers: { range: "bytes=1000-300000" } }));

            expect(response.status).toBe(206);
            expect(Buffer.compare(Buffer.from(await response.arrayBuffer()), large.subarray(1000, 300_001))).toBe(0);

            await rm(directory, { force: true, recursive: true });
        });

        it("should answer 416 with Content-Range for a range past the end", async () => {
            expect.assertions(3);

            const { handler } = setup();
            const response = await handler.fetch(new Request(`http://localhost/files/${ID}`, { headers: { range: "bytes=100-" } }));

            expect(response.status).toBe(416);
            expect(response.headers.get("content-range")).toBe("bytes */100");
            expect(exposed(response)).toContain("content-range");
        });

        it("should honour If-Range only when it matches the current ETag", async () => {
            expect.assertions(5);

            const { handler } = setup();
            const head = await handler.fetch(new Request(`http://localhost/files/${ID}`, { method: "HEAD" }));
            const etag = head.headers.get("etag") as string;

            expect(etag).toMatch(/^"/u);

            const current = await handler.fetch(new Request(`http://localhost/files/${ID}`, { headers: { "if-range": etag, range: "bytes=0-4" } }));

            expect(current.status).toBe(206);
            await expect(current.text()).resolves.toBe("01234");

            const stale = await handler.fetch(new Request(`http://localhost/files/${ID}`, { headers: { "if-range": "\"stale\"", range: "bytes=0-4" } }));

            expect(stale.status).toBe(200);
            await expect(stale.text()).resolves.toBe(BODY);
        });

        it("should never honour a weak If-Range validator", async () => {
            expect.assertions(1);

            const { handler } = setup();
            const head = await handler.fetch(new Request(`http://localhost/files/${ID}`, { method: "HEAD" }));
            const response = await handler.fetch(
                new Request(`http://localhost/files/${ID}`, { headers: { "if-range": `W/${head.headers.get("etag") as string}`, range: "bytes=0-4" } }),
            );

            expect(response.status).toBe(200);
        });

        it("should honour an If-Range date taken from the Last-Modified of HEAD", async () => {
            expect.assertions(3);

            const { handler } = setup();
            const head = await handler.fetch(new Request(`http://localhost/files/${ID}`, { method: "HEAD" }));
            const lastModified = head.headers.get("last-modified") as string;

            // An HTTP-date (RFC 9110 §5.6.7), not an ISO string
            expect(lastModified).toMatch(/GMT$/u);

            const response = await handler.fetch(new Request(`http://localhost/files/${ID}`, { headers: { "if-range": lastModified, range: "bytes=0-4" } }));

            expect(response.status).toBe(206);
            expect(response.headers.get("last-modified")).toBe(lastModified);
        });
    });

    describe("error responses", () => {
        it("should answer an unregistered method with 405", async () => {
            expect.assertions(2);

            const { handler } = setup();
            const response = await handler.fetch(new Request("http://localhost/files", { method: "PROPFIND" }));

            expect(response.status).toBe(405);
            await expect(response.json()).resolves.toStrictEqual({ error: { code: "MethodNotAllowed", message: "Method not allowed", name: "Error" } });
        });

        it("should answer 503 when the storage never becomes ready", async () => {
            expect.assertions(2);

            const { handler, storage } = setup();

            storage.isReady = false;
            vi.spyOn(storage, "ensureReady").mockRejectedValue(new Error("bucket unreachable"));

            const response = await handler.fetch(new Request(`http://localhost/files/${ID}`));

            expect(response.status).toBe(503);
            await expect(response.json()).resolves.toStrictEqual({ error: { code: "StorageError", message: "Storage error", name: "Error" } });
        });

        it("should hide the message of an unexpected error from the client, but not from onError and error listeners", async () => {
            expect.assertions(4);

            const onError = vi.fn();
            const { handler, storage } = setup({ onError });
            const listener = vi.fn();

            handler.on("error", listener);
            vi.spyOn(storage, "getMeta").mockRejectedValue(new Error("ENOENT /srv/secret/path"));

            const response = await handler.fetch(new Request(`http://localhost/files/${ID}`, { headers: { "x-test": "1" } }));

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toStrictEqual({ error: { code: "Error", message: "Something went wrong", name: "Error" } });
            expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("/srv/secret/path") }));
            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({ message: "ENOENT /srv/secret/path", request: expect.objectContaining({ headers: expect.objectContaining({ "x-test": "1" }), method: "GET" }) }),
            );
        });

        it("should answer an UploadErrorCode without a mapped response as an unknown error", async () => {
            expect.assertions(2);

            const { handler, storage } = setup();

            vi.spyOn(storage, "getMeta").mockRejectedValue(Object.assign(new Error("custom"), { UploadErrorCode: "SomethingCustom" }));

            const response = await handler.fetch(new Request(`http://localhost/files/${ID}`));

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toStrictEqual({ error: { code: "UnknownError", message: "Something went wrong", name: "Error" } });
        });

        it("should use a mapped UploadErrorCode as is", async () => {
            expect.assertions(1);

            const { handler, storage } = setup();

            vi.spyOn(storage, "getMeta").mockImplementation(async () => throwErrorCode(ERRORS.FILE_LOCKED));

            const response = await handler.fetch(new Request(`http://localhost/files/${ID}`));

            expect(response.status).toBe(423);
        });

        it("should wrap a string body set by onError and send an object body as is", async () => {
            expect.assertions(4);

            const { handler, storage } = setup();

            vi.spyOn(storage, "getMeta").mockRejectedValue(new Error("boom"));

            storage.onError = (error) => {
                Object.assign(error, { body: "upstream failed", statusCode: 502 });
            };

            const wrapped = await handler.fetch(new Request(`http://localhost/files/${ID}`));

            expect(wrapped.status).toBe(502);
            await expect(wrapped.json()).resolves.toStrictEqual({ error: { code: "Error", message: "upstream failed", name: "Error" } });

            storage.onError = (error) => {
                Object.assign(error, { body: { retry: true }, statusCode: 503 });
            };

            const custom = await handler.fetch(new Request(`http://localhost/files/${ID}`));

            expect(custom.status).toBe(503);
            await expect(custom.json()).resolves.toStrictEqual({ retry: true });
        });

        it("should answer with an error when onComplete throws", async () => {
            expect.assertions(2);

            const { handler, storage } = setup();

            storage.onComplete = () => {
                throw new Error("hook failed");
            };

            const response = await handler.fetch(
                new Request("http://localhost/files", { body: "hello", headers: { "content-length": "5", "content-type": "text/plain" }, method: "POST" }),
            );

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toStrictEqual({ error: { code: "Error", message: "Something went wrong", name: "Error" } });
        });
    });

    describe("responses", () => {
        it("should expose every header it sets on a completed upload", async () => {
            expect.assertions(3);

            const { handler } = setup();
            const response = await handler.fetch(
                new Request("http://localhost/files", { body: "hello", headers: { "content-length": "5", "content-type": "text/plain" }, method: "POST" }),
            );

            expect(response.status).toBe(201);
            expect(exposed(response)).toContain("location");
            expect(exposed(response)).toContain("content-type");
        });

        it("should emit the status event of a completed upload with the request", async () => {
            expect.assertions(1);

            const { handler } = setup();
            const completed = vi.fn();

            handler.on("completed", completed);

            await handler.fetch(new Request("http://localhost/files", { body: "hello", headers: { "content-length": "5", "content-type": "text/plain" }, method: "POST" }));

            expect(completed).toHaveBeenCalledWith(expect.objectContaining({ request: expect.objectContaining({ method: "POST", url: "http://localhost/files" }), status: "completed" }));
        });

        it("should build an absolute Location from the request URL unless relative locations are configured", async () => {
            expect.assertions(2);

            const absolute = setup().handler;
            const created = await absolute.fetch(
                new Request("https://uploads.example.com/files?tag=a", { body: "hello", headers: { "content-length": "5", "content-type": "text/plain" }, method: "POST" }),
            );

            expect(created.headers.get("location")).toMatch(/^https:\/\/uploads\.example\.com\/files\/[^/?]+\?tag=a\.txt$/u);

            const relative = setup({ useRelativeLocation: true }).handler;
            const relativeCreated = await relative.fetch(
                new Request("https://uploads.example.com/files", { body: "hello", headers: { "content-length": "5", "content-type": "text/plain" }, method: "POST" }),
            );

            expect(relativeCreated.headers.get("location")).toMatch(/^\/files\/[^/]+\.txt$/u);
        });

        it("should answer a partial batch delete with 207 and the deleted items", async () => {
            expect.assertions(5);

            const { handler } = setup();
            const response = await handler.fetch(new Request(`http://localhost/files?ids=${ID},missing-one`, { method: "DELETE" }));

            expect(response.status).toBe(207);
            expect(response.headers.get("x-delete-failed")).toBe("1");
            expect(exposed(response)).toStrictEqual(expect.arrayContaining(["x-delete-failed", "x-delete-successful", "x-delete-errors"]));

            const body = (await response.json()) as { id: string; status: string }[];

            expect(body).toHaveLength(1);
            expect(body[0]).toStrictEqual(expect.objectContaining({ id: ID, status: "deleted" }));
        });

        it("should answer a complete batch delete with an empty 204", async () => {
            expect.assertions(2);

            const { handler } = setup();
            const response = await handler.fetch(new Request(`http://localhost/files?ids=${ID}`, { method: "DELETE" }));

            expect(response.status).toBe(204);
            await expect(response.text()).resolves.toBe("");
        });

        it("should answer OPTIONS without a body and expose its headers", async () => {
            expect.assertions(2);

            const { handler } = setup();
            const response = await handler.fetch(new Request("http://localhost/files", { method: "OPTIONS" }));

            expect(response.status).toBe(204);
            expect(exposed(response).length).toBeGreaterThan(0);
        });

        it("should serve /:id/metadata as JSON with Last-Modified but without ETag", async () => {
            expect.assertions(3);

            const { handler } = setup();
            const response = await handler.fetch(new Request(`http://localhost/files/${ID}/metadata`));

            expect(response.headers.get("etag")).toBeNull();
            expect(response.headers.get("last-modified")).toMatch(/GMT$/u);
            await expect(response.json()).resolves.toStrictEqual(expect.objectContaining({ id: ID }));
        });
    });

    describe("file resolution", () => {
        const withTransformer = (handle: () => Promise<unknown>) => {
            const storage = new MemoryStorage({ initial: { [ID]: BODY } });
            const handler = new RestFetch({ mediaTransformer: { handle } as unknown as MediaTransformer, storage });

            return handler;
        };

        it("should serve a transformed file with its media headers", async () => {
            expect.assertions(4);

            const handler = withTransformer(async () => {
                return { buffer: Buffer.from("webp-bytes"), format: "webp", mediaType: "image", originalFile: { contentType: "image/png", ETag: "\"orig\"" }, size: 10 };
            });
            const response = await handler.fetch(new Request(`http://localhost/files/${ID}?width=100`));

            expect(response.headers.get("content-type")).toBe("image/webp");
            expect(response.headers.get("x-original-format")).toBe("png");
            expect(response.headers.get("etag")).toBe("\"orig\"");
            await expect(response.text()).resolves.toBe("webp-bytes");
        });

        it("should answer 400 for invalid transformation parameters and serve the original when a transformation fails", async () => {
            expect.assertions(3);

            const invalid = withTransformer(async () => {
                throw Object.assign(new Error("width must be positive"), { name: "ValidationError" });
            });
            const rejected = await invalid.fetch(new Request(`http://localhost/files/${ID}?width=-1`));

            expect(rejected.status).toBe(400);

            const failing = withTransformer(async () => {
                throw new Error("sharp missing");
            });
            const original = await failing.fetch(new Request(`http://localhost/files/${ID}?width=100`));

            expect(original.status).toBe(200);
            await expect(original.text()).resolves.toBe(BODY);
        });

        it("should fall back to a buffered read when streaming fails, but answer 404 when the file is gone", async () => {
            expect.assertions(3);

            const { handler, storage } = setup();

            vi.spyOn(storage, "getStream").mockRejectedValueOnce(new Error("stream broke"));

            const fallback = await handler.fetch(new Request(`http://localhost/files/${ID}`, { headers: { range: "bytes=0-4" } }));

            expect(fallback.status).toBe(200);
            await expect(fallback.text()).resolves.toBe(BODY);

            vi.spyOn(storage, "getStream").mockImplementationOnce(async () => throwErrorCode(ERRORS.FILE_NOT_FOUND));

            const gone = await handler.fetch(new Request(`http://localhost/files/${ID}`, { headers: { range: "bytes=0-4" } }));

            expect(gone.status).toBe(404);
        });

        it("should answer 404 for the metadata of a missing file", async () => {
            expect.assertions(1);

            const { handler } = setup();
            const response = await handler.fetch(new Request("http://localhost/files/b1b2c3d4-e5f6-4789-abcd-1234567890ab/metadata"));

            expect(response.status).toBe(404);
        });

        it("should treat an unknown non-generated id as the collection, listed only when allowed", async () => {
            expect.assertions(3);

            const { handler } = setup();

            await expect(handler.fetch(new Request("http://localhost/api/attachments"))).resolves.toStrictEqual(expect.objectContaining({ status: 404 }));

            const listing = new RestFetch({ allowList: true, storage: new MemoryStorage({ initial: { [ID]: BODY } }) });
            const listed = await listing.fetch(new Request("http://localhost/api/attachments"));

            expect(listed.status).toBe(200);
            await expect(listed.json()).resolves.toStrictEqual([expect.objectContaining({ id: ID })]);
        });

        it("should page a list and answer an empty page for an empty storage", async () => {
            expect.assertions(2);

            const listing = new RestFetch({ allowList: true, storage: new MemoryStorage({ initial: { [ID]: BODY } }) });
            const page = await listing.fetch(new Request("http://localhost/files?page=1&limit=1"));

            await expect(page.json()).resolves.toStrictEqual(expect.objectContaining({ data: [expect.objectContaining({ id: ID })] }));

            const empty = new RestFetch({ allowList: true, storage: new MemoryStorage() });

            const emptyPage = await empty.fetch(new Request("http://localhost/files?page=2"));

            await expect(emptyPage.json()).resolves.toStrictEqual([]);
        });
    });
});
