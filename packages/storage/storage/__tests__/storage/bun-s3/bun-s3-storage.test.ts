import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import BunS3File from "../../../src/storage/bun-s3/bun-s3-file";
import BunS3Storage from "../../../src/storage/bun-s3/bun-s3-storage";
import type { BunS3ClientLike, BunS3StorageOptions } from "../../../src/storage/bun-s3/types";
import { storageOptions } from "../../__helpers__/config";

const makeFileRef = (payload = "payload") => {
    return {
        arrayBuffer: vi.fn(async () => new TextEncoder().encode(payload).buffer),
        delete: vi.fn(async () => undefined),
        exists: vi.fn(async () => true),
        presign: vi.fn(() => "https://signed.example/get"),
        slice: vi.fn(),
        stat: vi.fn(async () => {
            return { etag: "etag-1", lastModified: new Date("2026-01-02T00:00:00Z"), size: payload.length, type: "video/mp4" };
        }),
        stream: vi.fn(
            () =>
                new ReadableStream<Uint8Array>({
                    start(controller) {
                        controller.enqueue(new TextEncoder().encode(payload));
                        controller.close();
                    },
                }),
        ),
        write: vi.fn(async () => payload.length),
    };
};

const makeClient = (fileRef = makeFileRef()): BunS3ClientLike & { __fileRef: ReturnType<typeof makeFileRef> } => {
    const client = {
        __fileRef: fileRef,
        delete: vi.fn(async () => undefined),
        exists: vi.fn(async () => true),
        file: vi.fn(() => fileRef),
        list: vi.fn(async () => {
            return {
                contents: [{ eTag: "etag-1", key: "anonymous/v.mp4", lastModified: new Date("2026-01-02T00:00:00Z"), size: 7 }],
                isTruncated: false,
            };
        }),
        presign: vi.fn(() => "https://signed.example/put"),
        stat: vi.fn(async () => {
            return { etag: "etag-1", size: 7, type: "video/mp4" };
        }),
        write: vi.fn(async () => 7),
    };

    return client;
};

const makeStorage = (client = makeClient()) =>
    new BunS3Storage({
        ...(storageOptions as BunS3StorageOptions),
        client,
    });

describe(BunS3Storage, () => {
    afterEach(() => {
        delete (globalThis as { Bun?: unknown }).Bun;
        vi.restoreAllMocks();
    });

    describe("construction", () => {
        it("throws when no client is supplied and the Bun runtime is absent", () => {
            expect.assertions(1);

            expect(() => new BunS3Storage({ ...(storageOptions as BunS3StorageOptions) })).toThrow(/requires the Bun runtime/u);
        });

        it("uses the injected client and exposes it via `raw`", () => {
            expect.assertions(1);

            const client = makeClient();
            const storage = new BunS3Storage({ ...(storageOptions as BunS3StorageOptions), client });

            expect(storage.raw).toBe(client);
        });

        it("constructs a Bun.S3Client from globalThis.Bun when no client is supplied", () => {
            expect.assertions(2);

            const constructed = makeClient();
            const ctorArguments: unknown[] = [];

            const S3ClientStub = function S3ClientStub(this: unknown, options: unknown) {
                ctorArguments.push(options);

                return constructed;
            };

            (globalThis as { Bun?: unknown }).Bun = { S3Client: S3ClientStub };

            const storage = new BunS3Storage({
                ...(storageOptions as BunS3StorageOptions),
                accessKeyId: "ak",
                bucket: "b",
                secretAccessKey: "sk",
            });

            expect(ctorArguments[0]).toMatchObject({ accessKeyId: "ak", bucket: "b", secretAccessKey: "sk" });
            expect(storage.raw).toBe(constructed);
        });
    });

    describe(".create()", () => {
        it("creates a new file, sets the S3 key, and saves meta", async () => {
            expect.assertions(3);

            const storage = makeStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));
            const saveMeta = vi.spyOn(storage as unknown as { saveMeta: (f: unknown) => Promise<unknown> }, "saveMeta").mockResolvedValue(undefined);

            const file = await storage.create({ contentType: "video/mp4", metadata: { name: "v.mp4", size: 7 }, originalName: "v.mp4", size: 7 });

            expect(file.status).toBe("created");
            expect(file.bunS3Key).toBe("anonymous/v.mp4");
            expect(saveMeta).toHaveBeenCalledWith(file);
        });
    });

    describe(".write()", () => {
        it("buffers the part stream and uploads it via client.write", async () => {
            expect.assertions(3);

            const client = makeClient();
            const storage = makeStorage(client);

            const file = new BunS3File({ contentType: "video/mp4", metadata: { name: "v.mp4", size: 5 }, originalName: "v.mp4", size: 5 });

            file.name = "anonymous/v.mp4";
            file.bytesWritten = 0;

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockResolvedValue(file);
            vi.spyOn(storage as unknown as { saveMeta: (f: unknown) => Promise<unknown> }, "saveMeta").mockResolvedValue(undefined);
            vi.spyOn(storage as unknown as { deleteMeta: () => Promise<unknown> }, "deleteMeta").mockResolvedValue(undefined);

            const result = await storage.write({ body: Readable.from([Buffer.from("hello")]), contentLength: 5, id: file.id, size: 5, start: 0 });

            expect(client.write).toHaveBeenCalledWith("anonymous/v.mp4", expect.any(Buffer), { type: "video/mp4" });
            expect(result.bytesWritten).toBe(5);
            expect(result.size).toBe(5);
        });
    });

    describe(".get()", () => {
        it("stats and downloads when no metadata exists", async () => {
            expect.assertions(3);

            const client = makeClient();
            const storage = makeStorage(client);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            const result = await storage.get({ id: "file.mp4" });

            expect(client.__fileRef.stat).toHaveBeenCalledTimes(1);
            expect(result.content.toString()).toBe("payload");
            expect(result.contentType).toBe("video/mp4");
        });

        it("skips the redundant stat round-trip when metadata is present", async () => {
            expect.assertions(2);

            const client = makeClient();
            const storage = makeStorage(client);

            const stored = new BunS3File({ contentType: "image/png", metadata: {}, originalName: "v.png", size: 7 });

            stored.name = "anonymous/v.png";
            stored.bunS3Key = "anonymous/v.png";

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockResolvedValue(stored);
            vi.spyOn(storage as unknown as { checkIfExpired: (f: unknown) => Promise<unknown> }, "checkIfExpired").mockResolvedValue(stored);

            const result = await storage.get({ id: stored.id });

            expect(client.__fileRef.stat).not.toHaveBeenCalled();
            expect(result.contentType).toBe("image/png");
        });
    });

    describe(".getStream()", () => {
        it("returns a Node Readable plus headers", async () => {
            expect.assertions(2);

            const storage = makeStorage();

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("not found"));

            const result = await storage.getStream({ id: "file.mp4" });

            expect(result.stream).toBeInstanceOf(Readable);
            expect(result.headers?.["Content-Type"]).toBe("video/mp4");
        });
    });

    describe(".delete()", () => {
        it("deletes a known key and marks the file deleted", async () => {
            expect.assertions(2);

            const client = makeClient();
            const storage = makeStorage(client);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("no meta"));

            const result = await storage.delete({ id: "anonymous/v.mp4" });

            expect(client.delete).toHaveBeenCalledWith("anonymous/v.mp4");
            expect(result.status).toBe("deleted");
        });

        it("is idempotent — swallows a NoSuchKey error from the backend", async () => {
            expect.assertions(1);

            const client = makeClient();

            (client.delete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "NoSuchKey", name: "S3Error" }));

            const storage = makeStorage(client);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("no meta"));

            const result = await storage.delete({ id: "anonymous/gone.mp4" });

            expect(result.status).toBe("deleted");
        });

        it("wraps non-not-found backend errors as UploadError", async () => {
            expect.assertions(1);

            const client = makeClient();

            (client.delete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "AccessDenied", name: "S3Error" }));

            const storage = makeStorage(client);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("no meta"));

            await expect(storage.delete({ id: "anonymous/x.mp4" })).rejects.toMatchObject({ name: "UploadError" });
        });
    });

    describe(".copy() / .move()", () => {
        it("copy reads the source and re-writes it at the destination", async () => {
            expect.assertions(2);

            const client = makeClient();
            const storage = makeStorage(client);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("no meta"));

            const file = await storage.copy("src.mp4", "dest.mp4");

            expect(client.write).toHaveBeenCalledWith("dest.mp4", expect.anything(), { type: "video/mp4" });
            expect(file.name).toBe("dest.mp4");
        });

        it("move copies then deletes the source", async () => {
            expect.assertions(1);

            const client = makeClient();
            const storage = makeStorage(client);

            vi.spyOn(storage as unknown as { getMeta: () => Promise<unknown> }, "getMeta").mockRejectedValue(new Error("no meta"));

            await storage.move("src.mp4", "dest.mp4");

            expect(client.delete).toHaveBeenCalledWith("src.mp4");
        });
    });

    describe(".list()", () => {
        it("maps client.list entries to BunS3File instances", async () => {
            expect.assertions(3);

            const storage = makeStorage();
            const files = await storage.list(50);

            expect(files).toHaveLength(1);
            expect(files[0]?.bunS3Key).toBe("anonymous/v.mp4");
            expect(files[0]?.ETag).toBe("etag-1");
        });
    });

    describe("uRL generation", () => {
        it("getReadUrl presigns a GET via the file ref", async () => {
            expect.assertions(2);

            const client = makeClient();
            const storage = makeStorage(client);

            const url = await storage.getReadUrl("file.mp4", { expiresIn: 120, responseContentDisposition: "attachment" });

            expect(url).toBe("https://signed.example/get");
            expect(client.__fileRef.presign).toHaveBeenCalledWith(
                expect.objectContaining({ contentDisposition: "attachment", expiresIn: 120, method: "GET" }),
            );
        });

        it("getUploadUrl presigns a PUT via the client", async () => {
            expect.assertions(2);

            const client = makeClient();
            const storage = makeStorage(client);

            const url = await storage.getUploadUrl("file.mp4", { contentLength: 999, contentType: "video/mp4", expiresIn: 60 });

            expect(url).toBe("https://signed.example/put");
            expect(client.presign).toHaveBeenCalledWith("file.mp4", expect.objectContaining({ expiresIn: 60, method: "PUT", type: "video/mp4" }));
        });
    });
});
