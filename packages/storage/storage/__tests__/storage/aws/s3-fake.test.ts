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

import { Files, UploadControl } from "../../../src/files";
import RestFetch from "../../../src/handler/rest/rest-fetch";
import { cloudflare } from "../../../src/storage/aws/clients";
import S3Storage from "../../../src/storage/aws/s3-storage";
import { ERRORS } from "../../../src/utils/errors";
import { createdAgo, HOUR } from "../../__helpers__/clock";
import { acceptS3Post } from "../../__helpers__/s3-post";
import { createS3State } from "../../__helpers__/s3-state";
import { describeStorageContract } from "../../__helpers__/storage-contract";

vi.mock(import("aws-crt"));

const MIB = 1024 * 1024;

const s3Error = (name: string, status: number): Error => Object.assign(new Error(name), { $fault: "client", $metadata: { httpStatusCode: status }, name });

const toBuffer = async (body: unknown): Promise<Buffer> => {
    if (typeof body === "string") {
        return Buffer.from(body);
    }

    return body instanceof Uint8Array ? Buffer.from(body) : buffer(body as AsyncIterable<Uint8Array>);
};

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

            return {
                Parts: parts.map(([number, part]) => {
                    return { ETag: part.etag, PartNumber: number, Size: part.body.byteLength };
                }),
            };
        }

        const holds = (target: string): boolean => bucket.holds(target, { ifMatch: input.IfMatch as string, ifNoneMatch: input.IfNoneMatch as string });

        // A write's If-Match on a key that stores nothing answers 404, not 412.
        if (
            input.IfMatch !== undefined &&
            !bucket.objects.has(key) &&
            [CompleteMultipartUploadCommand, CopyObjectCommand, DeleteObjectCommand].some((type) => command instanceof type)
        ) {
            throw s3Error("NoSuchKey", 404);
        }

        if (command instanceof CompleteMultipartUploadCommand) {
            // Conditional writes: the predicate is evaluated against the key at completion.
            if (!holds(key)) {
                throw s3Error("PreconditionFailed", 412);
            }

            const requested = (input.MultipartUpload as { Parts: { PartNumber: number }[] }).Parts;
            const completed = bucket.complete(
                uploadId,
                requested.map(({ PartNumber }) => PartNumber),
            );

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
            return {
                IsTruncated: false,
                Uploads: [...bucket.uploads].map(([id, upload]) => {
                    return { Initiated: upload.initiated, Key: upload.key, UploadId: id };
                }),
            };
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
                CommonPrefixes: page.prefixes.map((name) => {
                    return { Prefix: name };
                }),
                Contents: page.contents.map((object) => {
                    return { Key: object.key, LastModified: object.lastModified };
                }),
                IsTruncated: page.next !== undefined,
                NextContinuationToken: page.next === undefined ? undefined : String(page.next),
            };
        }

        if (command instanceof PutObjectCommand) {
            if (input.IfMatch !== undefined && bucket.objects.get(key)?.etag !== input.IfMatch) {
                throw s3Error("PreconditionFailed", 412);
            }

            return {
                ETag: bucket.put(key, await toBuffer(input.Body ?? Buffer.alloc(0)), {
                    contentType: input.ContentType as string,
                    metadata: input.Metadata as Record<string, string>,
                }).etag,
            };
        }

        if (command instanceof CopyObjectCommand) {
            const source = decodeURIComponent((input.CopySource as string).slice("bucket/".length));

            if (bucket.objects.has(source) && (!bucket.holds(source, { ifMatch: input.CopySourceIfMatch as string }) || !holds(key))) {
                throw s3Error("PreconditionFailed", 412);
            }

            if (!bucket.copy(source, key)) {
                throw s3Error("NoSuchKey", 404);
            }

            return {};
        }

        if (command instanceof DeleteObjectCommand) {
            if (!holds(key)) {
                throw s3Error("PreconditionFailed", 412);
            }

            bucket.objects.delete(key);

            return {};
        }

        if (command instanceof HeadObjectCommand || command instanceof GetObjectCommand) {
            const read = bucket.read(key, input.Range as string | undefined);

            if (!read) {
                throw s3Error(command instanceof HeadObjectCommand ? "NotFound" : "NoSuchKey", 404);
            }

            if (!holds(key)) {
                throw s3Error("PreconditionFailed", 412);
            }

            return {
                // Not a Readable: the adapter has to wrap whatever body type the SDK hands it.
                ...(command instanceof GetObjectCommand && {
                    Body: Object.assign(Buffer.from(read.body), { transformToString: async () => read.body.toString() }),
                }),
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
    const file = await storage.create({
        contentType: "text/plain",
        metadata: init.metadata ?? {},
        originalName: init.originalName ?? "a.txt",
        size: text.length,
    });

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

    describeStorageContract(() => {
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
    });

    it("should store an empty upload completed by a write without a body", async () => {
        expect.assertions(2);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "empty.txt", size: 0 });

        await expect(storage.write({ id: file.id })).resolves.toHaveProperty("status", "completed");
        await expect(storage.get({ id: file.id })).resolves.toHaveProperty("content", Buffer.alloc(0));
    });

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

    it("should resume a facade upload from the parts S3 lists when the process died before recording the last one", async () => {
        expect.assertions(4);

        const source = Buffer.alloc(2 * 5 * MIB + 1000, 7);
        const multipart = { partSize: 5 * MIB };
        const control = new UploadControl();
        const parts = (): { input: Record<string, unknown>; name: string }[] => s3.sent.filter(({ name }) => name === "UploadPartCommand");

        // Process A: S3 stores the second part, then the process dies before saving its offset.
        s3.state.override = (command) =>
            command instanceof PutObjectCommand && String(command.input.Key).endsWith(".META") && parts().length >= 2
                ? s3Error("InternalError", 500)
                : undefined;

        await expect(new Files({ adapter: createStorage() }).upload("big.bin", source, { control, multipart })).rejects.toBeDefined();

        s3.state.override = undefined;

        const token = JSON.stringify(control);

        expect(JSON.parse(token)).toMatchObject({ loaded: 5 * MIB });

        // Process B: S3's ListParts, not the stale record, decides where to continue.
        s3.sent.length = 0;

        const files = new Files({ adapter: createStorage() });

        await files.upload("big.bin", source, { control: UploadControl.from(token), multipart });

        expect(parts().reduce((total, { input }) => total + (input.ContentLength as number), 0)).toBe(1000);
        expect(s3.objects.get("big.bin")?.body.equals(source)).toBe(true);
    });

    it("should send a web ReadableStream part and reject a misplaced chunk", async () => {
        expect.assertions(3);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "w.txt", size: 5 });

        await expect(storage.write({ body: Readable.from([Buffer.from("lo")]), contentLength: 2, id: file.id, start: 3 })).rejects.toMatchObject({
            UploadErrorCode: "FileConflict",
        });

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

    it("should refuse an upload whose record has expired, not an object with a past HTTP Expires header", async () => {
        expect.assertions(3);

        const storage = createStorage();

        s3.objects.set("cached", { body: Buffer.from("x"), etag: '"o"', expires: new Date(Date.now() - 1000), lastModified: new Date(), metadata: {} });
        s3.objects.set("old", { body: Buffer.from("x"), etag: '"o"', lastModified: new Date(), metadata: {} });
        await storage.saveMeta({ expiredAt: Date.now() - 1000, id: "old", metadata: {}, name: "old", status: "completed" } as never);

        await expect(storage.get({ id: "cached" })).resolves.toMatchObject({ content: Buffer.from("x") });
        await expect(storage.get({ id: "old" })).rejects.toMatchObject({ UploadErrorCode: "Gone" });
        // Never the record of an upload named "undefined".
        expect(s3.sent.filter(({ name }) => name === "DeleteObjectCommand").map(({ input }) => input.Key)).not.toContain("undefined.META");
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

    it("should send conditions as S3 headers and abort a losing conditional upload", async () => {
        expect.assertions(4);

        const files = new Files({ adapter: createStorage() });
        const created = await files.upload("a.txt", "one", { ifNoneMatch: "*" });

        await expect(files.upload("a.txt", "two", { ifNoneMatch: "*" })).rejects.toThrow(
            expect.objectContaining({ UploadErrorCode: ERRORS.PRECONDITION_FAILED }),
        );
        // The losing multipart upload is aborted; the stored object and its record stay as they were.
        expect([s3.uploads.size, s3.objects.get("a.txt")?.body.toString()]).toStrictEqual([0, "one"]);
        await expect(files.head("a.txt")).resolves.toMatchObject({ etag: created.etag, size: 3 });

        await files.copy("a.txt", "b.txt", { ifNoneMatch: "*", sourceIfMatch: created.etag as string });
        await files.delete("b.txt", { ifMatch: s3.objects.get("b.txt")?.etag as string });

        expect(
            s3.sent
                .filter(({ input }) => input.IfMatch !== undefined || input.IfNoneMatch !== undefined || input.CopySourceIfMatch !== undefined)
                .map(({ name }) => name),
        ).toStrictEqual(["CompleteMultipartUploadCommand", "CompleteMultipartUploadCommand", "CopyObjectCommand", "DeleteObjectCommand"]);
    });

    it("should sign a POST policy whose size range S3 enforces", async () => {
        expect.assertions(9);

        const files = new Files({ adapter: createStorage() });

        expect([files.capabilities.signedUploadPost, files.capabilities.signedUrlMaxExpiresIn]).toStrictEqual([true, 604_800]);

        const signed = await files.signedUpload("up.txt", { contentType: "text/plain", expiresIn: 60, maxSize: 10, minSize: 2 });

        expect(signed).toMatchObject({
            fields: { "Content-Type": "text/plain", key: "up.txt" },
            method: "POST",
            url: "https://bucket.s3.us-east-1.amazonaws.com/",
        });

        const { fields } = signed as { fields: Record<string, string> };
        const post =
            (body: string, postFields = fields, now?: Date) =>
            () =>
                acceptS3Post(postFields, Buffer.from(body), { bucket: "bucket", now, secretAccessKey: "secret" });

        expect(post("hello")()).toMatchObject({ contentType: "text/plain", key: "up.txt" });
        expect(post("hello world")).toThrow("EntityTooLarge");
        expect(post("h")).toThrow("EntityTooSmall");
        expect(post("hello", { ...fields, key: "other.txt" })).toThrow("AccessDenied");
        expect(post("hello", fields, new Date(Date.now() + 120_000))).toThrow("AccessDenied");

        await expect(files.signedUpload("up.txt", { contentType: "text/plain" })).resolves.toMatchObject({
            headers: { "Content-Type": "text/plain" },
            method: "PUT",
        });
        await expect(files.signedUpload("up.txt", { expiresIn: 604_801, maxSize: 1 })).rejects.toThrow(
            expect.objectContaining({ UploadErrorCode: ERRORS.BAD_REQUEST }),
        );
    });

    it("should answer PRECONDITION_FAILED when an If-Match write finds no object", async () => {
        expect.assertions(3);

        const files = new Files({ adapter: createStorage() });

        await files.upload("source.txt", "source");

        // S3 answers 404 for these, not 412.
        await expect(files.upload("absent.txt", "one", { ifMatch: '"etag"' })).rejects.toThrow(
            expect.objectContaining({ UploadErrorCode: ERRORS.PRECONDITION_FAILED }),
        );
        await expect(files.copy("source.txt", "absent.txt", { ifMatch: '"etag"' })).rejects.toThrow(
            expect.objectContaining({ UploadErrorCode: ERRORS.PRECONDITION_FAILED }),
        );
        expect(s3.uploads.size).toBe(0);
    });

    it("should abort and answer FILE_CONFLICT when a concurrent conditional write wins", async () => {
        expect.assertions(2);

        const files = new Files({ adapter: createStorage() });

        s3.state.override = (command) => (command instanceof CompleteMultipartUploadCommand ? s3Error("ConditionalRequestConflict", 409) : undefined);

        await expect(files.upload("a.txt", "one", { ifNoneMatch: "*" })).rejects.toThrow(expect.objectContaining({ UploadErrorCode: ERRORS.FILE_CONFLICT }));
        expect(s3.uploads.size).toBe(0);
    });

    it("should sign the configured ACL into a POST policy", async () => {
        expect.assertions(2);

        const files = new Files({ adapter: createStorage({ acl: "public-read" }) });
        const { fields } = (await files.signedUpload("up.txt", { maxSize: 10 })) as { fields: Record<string, string> };

        expect(fields.acl).toBe("public-read");
        // The ACL is a policy condition: a form that changes it is refused.
        expect(() => acceptS3Post({ ...fields, acl: "private" }, Buffer.from("hello"), { bucket: "bucket", secretAccessKey: "secret" })).toThrow(
            "AccessDenied",
        );
    });

    it("should sign POST policies for AWS only, unless told to", async () => {
        expect.assertions(4);

        const r2 = new Files({ adapter: createStorage(cloudflare({ accessKeyId: "id", accountId: "account", secretAccessKey: "secret" })) });

        expect(new Files({ adapter: createStorage() }).capabilities.signedUploadPost).toBe(true);
        // Cloudflare R2 does not accept browser-form POST uploads.
        expect(r2.capabilities.signedUploadPost).toBe(false);
        await expect(r2.signedUpload("up.txt", { maxSize: 10 })).rejects.toThrow(expect.objectContaining({ UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED }));
        expect(new Files({ adapter: createStorage({ endpoint: "https://minio.local", uploadPost: true }) }).capabilities.signedUploadPost).toBe(true);
    });

    it("should send only the conditional requests enabled per operation", async () => {
        expect.assertions(2);

        const files = new Files({ adapter: createStorage({ conditional: { copy: true, read: true }, endpoint: "https://r2.local" }) });

        expect(files.capabilities.conditional).toStrictEqual({ copy: true, create: false, delete: false, read: true, replace: false });
        await expect(files.upload("a.txt", "one", { ifNoneMatch: "*" })).rejects.toThrow(
            expect.objectContaining({ UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED }),
        );
    });

    it("should keep the configured ACL on objects a server-side copy writes", async () => {
        expect.assertions(2);

        const storage = createStorage({ acl: "public-read" });
        const id = await upload(storage, "hello");

        s3.sent.length = 0;

        // S3 doesn't copy the source's ACL: a replace (or copy) must send the configured one.
        await storage.replaceUpload(id, { contentType: "text/plain", metadata: {}, size: 5 }, async (stagingId) =>
            storage.write({ body: Readable.from([Buffer.from("world")]), contentLength: 5, id: stagingId, start: 0 }),
        );

        const copies = s3.sent.filter(({ name }) => name === "CopyObjectCommand");

        expect(copies.length).toBeGreaterThan(0);
        expect(copies.every(({ input }) => input.ACL === "public-read")).toBe(true);
    });

    it("should not claim conditional support for a custom endpoint unless told to", () => {
        expect.assertions(3);

        expect(new Files({ adapter: createStorage({ endpoint: "https://minio.local" }) }).capabilities.conditional.create).toBe(false);
        expect(new Files({ adapter: createStorage({ conditional: true, endpoint: "https://minio.local" }) }).capabilities.conditional.create).toBe(true);
        expect(new Files({ adapter: createStorage({ clientDirectUpload: true, conditional: true }) }).capabilities.conditional.read).toBe(false);
    });
});
