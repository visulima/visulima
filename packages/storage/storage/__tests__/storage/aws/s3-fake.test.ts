import { Readable } from "node:stream";
import { buffer, text } from "node:stream/consumers";

import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CopyObjectCommand,
    CreateMultipartUploadCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListMultipartUploadsCommand,
    ListObjectsV2Command,
    ListPartsCommand,
    PutObjectCommand,
    S3Client,
    UploadPartCommand,
} from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import S3Storage from "../../../src/storage/aws/s3-storage";
import { createdAgo, HOUR } from "../../__helpers__/clock";
import { createS3State } from "../../__helpers__/s3-state";
import { describeStorageContract } from "../../__helpers__/storage-contract";

vi.mock(import("aws-crt"));

const MIB = 1024 * 1024;

const s3Error = (name: string, status: number): Error => Object.assign(new Error(name), { $fault: "client", $metadata: { httpStatusCode: status }, name });

const toBuffer = async (body: unknown): Promise<Buffer> => (body instanceof Uint8Array ? Buffer.from(body) : buffer(body as AsyncIterable<Uint8Array>));

/**
 * In-memory S3 bucket answering the commands S3Storage and S3MetaStorage send. `override` answers a
 * command before the fake does: an Error is thrown, any other value is returned as the response.
 */
const createS3 = () => {
    const bucket = createS3State();
    const sent: { input: Record<string, unknown>; name: string }[] = [];
    const state: { override?: (command: { input: Record<string, unknown> }) => unknown } = {};

    const send = async (command: { constructor: { name: string }; input: Record<string, unknown> }): Promise<unknown> => {
        const { input } = command;

        sent.push({ input, name: command.constructor.name });

        const overridden = state.override?.(command);

        if (overridden instanceof Error) {
            throw overridden;
        }

        if (overridden !== undefined) {
            return overridden;
        }

        const key = input.Key as string;
        const uploadId = input.UploadId as string;

        if (command instanceof CreateMultipartUploadCommand) {
            return { UploadId: bucket.createUpload(key, { contentType: input.ContentType as string, metadata: input.Metadata as Record<string, string> }) };
        }

        if (command instanceof UploadPartCommand) {
            const ETag = bucket.putPart(uploadId, input.PartNumber as number, await toBuffer(input.Body));

            if (ETag === undefined) {
                throw s3Error("NoSuchUpload", 404);
            }

            return { ETag };
        }

        if (command instanceof ListPartsCommand) {
            const parts = bucket.parts(uploadId);

            if (parts === undefined) {
                throw s3Error("NoSuchUpload", 404);
            }

            return { Parts: parts.map(([number, part]) => { return { ETag: part.etag, PartNumber: number, Size: part.body.byteLength }; }) };
        }

        if (command instanceof CompleteMultipartUploadCommand) {
            const requested = (input.MultipartUpload as { Parts: { PartNumber: number }[] }).Parts;
            const completed = bucket.complete(uploadId, requested.map(({ PartNumber }) => PartNumber));

            if (completed === undefined) {
                throw s3Error("NoSuchUpload", 404);
            }

            return { ETag: completed.etag, Location: `https://bucket.s3.test/${key}` };
        }

        if (command instanceof AbortMultipartUploadCommand) {
            if (!bucket.abort(uploadId)) {
                throw s3Error("NoSuchUpload", 404);
            }

            return {};
        }

        if (command instanceof ListMultipartUploadsCommand) {
            return { IsTruncated: false, Uploads: [...bucket.uploads].map(([id, upload]) => { return { Initiated: upload.initiated, Key: upload.key, UploadId: id }; }) };
        }

        if (command instanceof ListObjectsV2Command) {
            // A real bucket may answer fewer keys than asked for; two per page forces paging.
            const page = bucket.list({
                delimiter: input.Delimiter as string | undefined,
                maxKeys: input.MaxKeys as number | undefined,
                pageSize: 2,
                prefix: input.Prefix as string | undefined,
                start: Number(input.ContinuationToken ?? 0),
            });

            return {
                CommonPrefixes: page.prefixes.map((name) => { return { Prefix: name }; }),
                Contents: page.contents.map((object) => { return { Key: object.key, LastModified: object.lastModified }; }),
                IsTruncated: page.next !== undefined,
                NextContinuationToken: page.next === undefined ? undefined : String(page.next),
            };
        }

        if (command instanceof PutObjectCommand) {
            if (input.IfMatch !== undefined && bucket.objects.get(key)?.etag !== input.IfMatch) {
                throw s3Error("PreconditionFailed", 412);
            }

            return { ETag: bucket.put(key, Buffer.alloc(0), { metadata: input.Metadata as Record<string, string> }).etag };
        }

        if (command instanceof CopyObjectCommand) {
            if (!bucket.copy(decodeURIComponent((input.CopySource as string).slice("bucket/".length)), key)) {
                throw s3Error("NoSuchKey", 404);
            }

            return {};
        }

        if (command instanceof DeleteObjectCommand) {
            bucket.objects.delete(key);

            return {};
        }

        if (command instanceof HeadObjectCommand || command instanceof GetObjectCommand) {
            const read = bucket.read(key, input.Range as string | undefined);

            if (!read) {
                throw s3Error(command instanceof HeadObjectCommand ? "NotFound" : "NoSuchKey", 404);
            }

            return {
                // Not a Readable: the adapter has to wrap whatever body type the SDK hands it.
                ...(command instanceof GetObjectCommand && { Body: read.body }),
                ContentLength: read.body.byteLength,
                ContentType: read.object.contentType,
                ETag: read.object.etag,
                Expires: read.object.expires,
                LastModified: read.object.lastModified,
                Metadata: read.object.metadata,
            };
        }

        // HeadBucket (access checks).
        return {};
    };

    return { objects: bucket.objects, put: bucket.put, send, sent, state, uploads: bucket.uploads };
};

const createStorage = (config: Partial<ConstructorParameters<typeof S3Storage>[0]> = {}): S3Storage =>
    new S3Storage({
        bucket: "bucket",
        credentials: { accessKeyId: "id", secretAccessKey: "secret" },
        region: "us-east-1",
        retryConfig: { initialDelay: 1, maxDelay: 1, maxRetries: 1 },
        ...config,
    });

const upload = async (storage: S3Storage, text: string, init: { metadata?: Record<string, string>; originalName?: string } = {}): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: init.metadata ?? {}, originalName: init.originalName ?? "a.txt", size: text.length });

    await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

    return file.id;
};

describe("s3Storage against an in-memory S3", () => {
    let s3: ReturnType<typeof createS3>;

    beforeEach(() => {
        s3 = createS3();
        vi.spyOn(S3Client.prototype, "send").mockImplementation(s3.send as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describeStorageContract(
        () => {
            return {
                createStorage,
                failBackend: (failing) => {
                    s3.state.override = failing ? () => s3Error("InternalError", 500) : undefined;
                },
                hasObject: (key) => s3.objects.has(key),
                putObject: (key, content) => {
                    s3.put(key, Buffer.from(content));
                },
            };
        },
    );

    it("should resume a multipart upload on a fresh instance after a failed part, and keep the metadata on completion", async () => {
        expect.assertions(7);

        const bytes = Buffer.alloc(5 * MIB + 3, 1);
        const first = createStorage();
        const file = await first.create({ contentType: "text/plain", metadata: { owner: "me" }, originalName: "big.txt", size: bytes.byteLength });

        await first.write({ body: Readable.from([bytes.subarray(0, 5 * MIB)]), contentLength: 5 * MIB, id: file.id, start: 0 });

        // The connection drops while the last part is in flight.
        s3.state.override = (command) => (command instanceof UploadPartCommand ? s3Error("RequestTimeout", 403) : undefined);

        await expect(first.write({ body: Readable.from([bytes.subarray(5 * MIB)]), contentLength: 3, id: file.id, start: 5 * MIB })).rejects.toMatchObject({
            name: "RequestTimeout",
        });

        s3.state.override = undefined;

        // A new process (no cache) reads the offset back from the stored metadata and ListParts.
        const second = createStorage();

        await expect(second.getMeta(file.id)).resolves.toMatchObject({ bytesWritten: 5 * MIB, status: "part" });

        const done = await second.write({ body: Readable.from([bytes.subarray(5 * MIB)]), contentLength: 3, id: file.id, start: 5 * MIB });

        expect(done.status).toBe("completed");
        expect(s3.objects.get(file.id)?.body.equals(bytes)).toBe(true);
        expect(s3.objects.get(file.id)?.metadata).toStrictEqual({ originalName: "big.txt", owner: "me" });
        await expect(second.getMeta(file.id)).resolves.toMatchObject({ metadata: { owner: "me" }, originalName: "big.txt", status: "completed" });
        // Writing to a finished upload is a no-op.
        await expect(second.write({ body: Readable.from([Buffer.from("x")]), contentLength: 1, id: file.id, start: 0 })).resolves.toMatchObject({
            status: "completed",
        });
    });

    it("should send a web ReadableStream part and reject a misplaced chunk", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "w.txt", size: 5 });

        await expect(
            storage.write({ body: Readable.from([Buffer.from("lo")]), contentLength: 2, id: file.id, start: 3 }),
        ).rejects.toMatchObject({ UploadErrorCode: "FileConflict" });

        await storage.write({ body: new Blob(["hello"]).stream() as never, contentLength: 5, id: file.id, start: 0 });

        expect(s3.objects.get(file.id)?.body.toString()).toBe("hello");
        await expect(storage.exists({ id: file.id })).resolves.toBe(true);
    });

    it("should read whole objects and byte ranges with get and getStream", async () => {
        expect.assertions(5);

        const storage = createStorage();
        const id = await upload(storage, "0123456789", { metadata: { tag: "x" }, originalName: "digits.txt" });

        const whole = await storage.get({ id });

        expect(whole).toMatchObject({ contentType: "text/plain", metadata: { tag: "x" }, originalName: "digits.txt", size: 10 });
        expect(whole.content.toString()).toBe("0123456789");

        const ranged = await storage.get({ id }, { range: { end: 4, start: 2 } });

        expect(ranged.content.toString()).toBe("234");

        const { headers, stream } = await storage.getStream({ id }, { range: { start: 7 } });

        expect(headers).toMatchObject({ "Content-Length": "3", "Content-Type": "text/plain", ETag: expect.any(String) });
        await expect(text(stream)).resolves.toBe("789");
    });

    it("should read an upload stored under a custom filename by its id", async () => {
        expect.assertions(5);

        const storage = createStorage({ filename: (file) => `user/123/${file.originalName}` });
        const id = await upload(storage, "0123456789", { originalName: "digits.txt" });

        expect(s3.objects.has("user/123/digits.txt")).toBe(true);
        await expect(storage.exists({ id })).resolves.toBe(true);
        await expect(storage.get({ id })).resolves.toMatchObject({ content: Buffer.from("0123456789"), id, name: "user/123/digits.txt" });

        const { stream } = await storage.getStream({ id }, { range: { start: 7 } });

        await expect(text(stream)).resolves.toBe("789");
        // Without metadata the id is the key.
        await expect(storage.get({ id: "user/123/digits.txt" })).resolves.toMatchObject({ size: 10 });
    });

    it("should refuse an expired object", async () => {
        expect.assertions(1);

        s3.objects.set("old", { body: Buffer.from("x"), etag: '"o"', expires: new Date(Date.now() - 1000), lastModified: new Date(), metadata: {} });

        await expect(createStorage().get({ id: "old" })).rejects.toMatchObject({ UploadErrorCode: "Gone" });
    });

    it("should answer undefined only for a missing object and throw any other failure", async () => {
        expect.assertions(5);

        const storage = createStorage();

        s3.objects.set("legacy", { body: Buffer.from("old"), contentType: "text/plain", etag: '"l"', lastModified: new Date(), metadata: {} });

        await expect(storage.getCompletedFile("legacy")).resolves.toMatchObject({ bytesWritten: 3, size: 3, status: "completed" });
        await expect(storage.getCompletedFile("nope")).resolves.toBeUndefined();
        await expect(storage.exists({ id: "nope" })).resolves.toBe(false);

        s3.state.override = (command) => (command instanceof HeadObjectCommand ? s3Error("AccessDenied", 403) : undefined);

        await expect(storage.getCompletedFile("legacy")).rejects.toMatchObject({ name: "AccessDenied" });
        expect(storage.normalizeError(s3Error("AccessDenied", 403) as never)).toMatchObject({ code: "AccessDenied", statusCode: 403 });
    });

    it("should retry transient and server faults but not client errors", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const heads = (): number => s3.sent.filter(({ name }) => name === "HeadObjectCommand").length;
        const failOnce = (error: Error): void => {
            let failed = false;

            s3.state.override = (command) => {
                if (command instanceof HeadObjectCommand && !failed) {
                    failed = true;

                    return error;
                }

                return undefined;
            };
        };

        s3.objects.set("k", { body: Buffer.from("x"), etag: '"k"', lastModified: new Date(), metadata: {} });

        failOnce(s3Error("SlowDown", 503));
        await storage.getCompletedFile("k");
        failOnce(Object.assign(s3Error("Weird", 400), { $fault: "server" }));
        await storage.getCompletedFile("k");
        failOnce(Object.assign(new Error("socket hang up"), { retryable: true }));
        await storage.getCompletedFile("k");

        expect(heads()).toBe(6);

        failOnce(s3Error("Forbidden", 403));

        await expect(storage.getCompletedFile("k")).rejects.toMatchObject({ name: "Forbidden" });

        expect(heads()).toBe(7);
        expect(storage.normalizeError(new Error("plain"))).toMatchObject({ statusCode: 500 });
    });

    it("should copy and move uploads and objects without metadata", async () => {
        expect.assertions(6);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        await expect(storage.copy(id, "copies/a b.txt", { storageClass: "STANDARD_IA" })).resolves.toMatchObject({ id: "copies/a b.txt" });
        expect(s3.sent.find(({ name }) => name === "CopyObjectCommand")?.input).toMatchObject({ StorageClass: "STANDARD_IA" });

        await storage.move("copies/a b.txt", "moved.txt");
        await storage.move(id, "renamed.txt");

        expect([...s3.objects.keys()].toSorted()).toStrictEqual(["moved.txt", "renamed.txt"]);
        expect(s3.objects.get("renamed.txt")?.body.toString()).toBe("hello");
        await expect(storage.copy("missing", "x")).rejects.toBeDefined();
        await expect(storage.move(id, "../escape")).rejects.toBeDefined();
    });

    it("should list objects across pages without the metadata records", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const ids = [await upload(storage, "a"), await upload(storage, "b")];

        for (const key of ["photos/1.jpg", "photos/2.jpg", "photos/raw/3.dng", "readme.md"]) {
            s3.objects.set(key, { body: Buffer.from(key), etag: '"x"', lastModified: new Date(), metadata: {} });
        }

        const listed = await storage.list();

        expect(listed.map(({ id }) => id).toSorted()).toStrictEqual([...ids, "photos/1.jpg", "photos/2.jpg", "photos/raw/3.dng", "readme.md"].toSorted());
        await expect(storage.list(3)).resolves.toHaveLength(3);
        await expect(storage.listDirectory({ delimiter: "/", prefix: "photos/" })).resolves.toStrictEqual({
            files: [expect.objectContaining({ id: "photos/1.jpg" }), expect.objectContaining({ id: "photos/2.jpg" })],
            prefixes: ["photos/raw/"],
        });
    });

    it("should surface a failed listing", async () => {
        expect.assertions(2);

        const storage = createStorage();

        s3.state.override = (command) => (command instanceof ListObjectsV2Command ? s3Error("AccessDenied", 403) : undefined);

        await expect(storage.list()).rejects.toMatchObject({ name: "AccessDenied" });
        await expect(storage.listDirectory({ delimiter: "/" })).rejects.toMatchObject({ name: "AccessDenied" });
    });

    it("should abort an unfinished upload, keep its metadata when aborting fails, and drop it when the upload is gone", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 5 });

        s3.state.override = (command) => (command instanceof AbortMultipartUploadCommand ? s3Error("AccessDenied", 403) : undefined);

        await expect(storage.delete({ id: file.id })).rejects.toMatchObject({ name: "AccessDenied" });
        expect(s3.objects.has(`${file.id}.META`)).toBe(true);

        s3.state.override = undefined;
        s3.uploads.clear();

        await expect(storage.delete({ id: file.id })).resolves.toMatchObject({ status: "deleted" });
        expect(s3.objects.has(`${file.id}.META`)).toBe(false);
    });

    it("should purge its own expired uploads and leave other clients' objects and multipart uploads", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const [finished, unfinished] = await createdAgo(2 * HOUR, async () =>
            Promise.all([upload(storage, "done"), storage.create({ contentType: "text/plain", metadata: {}, originalName: "b.txt", size: 5 })]),
        );
        const fresh = await upload(storage, "new");
        const old = new Date(Date.now() - 2 * HOUR);

        // Another client's multipart upload and an app file in the same bucket: not ours to purge.
        s3.uploads.set("orphan", { initiated: old, key: "orphan-key", metadata: {}, parts: new Map() });
        s3.objects.set("app-file", { body: Buffer.from("app"), lastModified: old, metadata: {} } as never);

        const purged = await storage.purge("1h");

        expect(purged.items.map(({ id }) => id).toSorted()).toStrictEqual([finished, unfinished.id].toSorted());
        expect([...s3.uploads.keys()]).toStrictEqual(["orphan"]);
        expect([...s3.objects.keys()].toSorted()).toStrictEqual(["app-file", fresh, `${fresh}.META`].toSorted());
    });

    it("should fail create, write and completion when S3 answers without the expected ids", async () => {
        expect.assertions(3);

        const storage = createStorage();

        s3.state.override = (command) => (command instanceof CreateMultipartUploadCommand ? {} : undefined);

        await expect(storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 1 })).rejects.toMatchObject({
            UploadErrorCode: "FileError",
        });

        s3.state.override = undefined;

        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 1 });

        s3.state.override = (command) => (command instanceof UploadPartCommand ? {} : undefined);

        await expect(storage.write({ body: Buffer.from("x"), contentLength: 1, id: file.id, start: 0 })).rejects.toThrow("Failed to upload part");

        s3.state.override = (command) => (command instanceof CompleteMultipartUploadCommand ? {} : undefined);

        await expect(storage.write({ body: Buffer.from("x"), contentLength: 1, id: file.id, start: 0 })).rejects.toThrow("Failed to complete multipart upload");
    });

    it("should hand out presigned part URLs for direct uploads and complete once the parts are there", async () => {
        expect.assertions(4);

        const storage = createStorage({ clientDirectUpload: true });
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 5 });

        expect(file.partsUrls).toHaveLength(1);
        expect(file.partsUrls?.[0]).toMatch(/partNumber=1&uploadId=/u);

        // The browser PUTs the part straight to S3.
        [...s3.uploads.values()][0]!.parts.set(1, { body: Buffer.from("hello"), etag: '"direct"' });

        await expect(storage.update({ id: file.id }, {})).resolves.toMatchObject({ status: "completed" });
        expect(s3.objects.get(file.id)?.body.toString()).toBe("hello");
    });

    it("should sign read and upload URLs", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const read = await storage.getReadUrl("a b.txt", { responseContentDisposition: "attachment", responseContentType: "text/plain" });

        expect(read).toMatch(/^https:\/\/bucket\.s3\.us-east-1\.amazonaws\.com\/a%20b\.txt\?.*X-Amz-Signature=/u);
        expect(new URL(read).searchParams.get("response-content-disposition")).toBe("attachment");
        await expect(storage.getUploadUrl("up.txt", { contentLength: 4, contentType: "text/plain", expiresIn: 60 })).resolves.toMatch(/X-Amz-Expires=60/u);
    });

    it("should run a REST upload: chunked POST, PATCH, HEAD, PUT replace and DELETE", async () => {
        expect.assertions(6);

        const rest = new RestFetch({ storage: createStorage() });
        const endpoint = "https://app.local/upload";
        const bytes = new Uint8Array(5 * MIB + 10).map((_, index) => index % 251);

        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": String(bytes.byteLength) },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const id = (location.split("/").pop() as string).replace(/\.[^.]*$/u, "");
        const statuses: number[] = [];

        for (const [start, end] of [
            [0, 5 * MIB],
            [5 * MIB, bytes.byteLength],
        ] as const) {
            const response = await rest.fetch(
                new Request(location, {
                    body: bytes.slice(start, end),
                    headers: { "content-length": String(end - start), "content-type": "application/octet-stream", "x-chunk-offset": String(start) },
                    method: "PATCH",
                }),
            );

            statuses.push(response.status);
        }

        expect(statuses).toStrictEqual([202, 200]);
        expect(Buffer.from(bytes).equals(s3.objects.get(id)?.body as Buffer)).toBe(true);

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect([head.status, head.headers.get("x-upload-complete")]).toStrictEqual([200, "true"]);

        const put = await rest.fetch(new Request(location, { body: "next", headers: { "content-length": "4", "content-type": "text/plain" }, method: "PUT" }));

        expect([put.status, s3.objects.get(id)?.body.toString()]).toStrictEqual([200, "next"]);

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect(deleted.status).toBeLessThan(300);
        expect([...s3.objects.keys()]).toStrictEqual([]);
    });
});
