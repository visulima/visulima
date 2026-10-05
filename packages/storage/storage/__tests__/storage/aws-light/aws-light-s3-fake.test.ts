import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";

import { afterEach, describe, expect, it, vi } from "vitest";

import { Files } from "../../../src/files";
import AwsLightApiAdapter from "../../../src/storage/aws-light/aws-light-api-adapter";
import AwsLightStorage from "../../../src/storage/aws-light/aws-light-storage";
import { ERRORS } from "../../../src/utils/errors";
import { createdAgo, HOUR } from "../../__helpers__/clock";
import type { S3PostError } from "../../__helpers__/s3-post";
import { acceptS3Post } from "../../__helpers__/s3-post";
import { createS3State } from "../../__helpers__/s3-state";
import { describeStorageContract } from "../../__helpers__/storage-contract";

/**
 * In-memory path-style S3 at https://s3.test with the bucket "uploads". `override` answers a
 * request before the fake does, to inject failures.
 */
const createS3 = () => {
    const bucket = createS3State();
    const requests: Request[] = [];
    const state: { override?: (request: Request, key: string) => Response | undefined } = {};

    const xml = (body: string): Response => new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`);
    const missing = (code = "NoSuchKey"): Response => new Response(`<Error><Code>${code}</Code></Error>`, { status: 404 });
    const preconditionFailed = (): Response => new Response("<Error><Code>PreconditionFailed</Code></Error>", { status: 412 });

    const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = input instanceof Request ? input : new Request(input, init);

        requests.push(request);

        const url = new URL(request.url);
        const key = decodeURIComponent(url.pathname.slice("/uploads/".length));
        const overridden = state.override?.(request, key);

        if (overridden) {
            return overridden;
        }

        const uploadId = url.searchParams.get("uploadId");
        const holds = (target: string): boolean =>
            bucket.holds(target, { ifMatch: request.headers.get("if-match"), ifNoneMatch: request.headers.get("if-none-match") });

        if (key === "") {
            // Browser-form POST upload, checked against its signed policy like S3 does.
            if (request.method === "POST") {
                const form = await request.formData();
                const file = form.get("file") as Blob;
                const fields = Object.fromEntries([...form].filter(([name]) => name !== "file")) as Record<string, string>;

                try {
                    const accepted = acceptS3Post(fields, Buffer.from(await file.arrayBuffer()), { bucket: "uploads", secretAccessKey: "secret" });

                    bucket.put(accepted.key, accepted.body, { contentType: accepted.contentType });

                    return new Response(null, { status: 204 });
                } catch (error: unknown) {
                    const { code, status } = error as S3PostError;

                    return new Response(`<Error><Code>${code}</Code></Error>`, { status });
                }
            }

            if (url.searchParams.has("uploads")) {
                return xml(
                    `<ListMultipartUploadsResult>${[...bucket.uploads]
                        .map(
                            ([id, upload]) =>
                                `<Upload><Key>${upload.key}</Key><UploadId>${id}</UploadId><Initiated>${upload.initiated.toISOString()}</Initiated></Upload>`,
                        )
                        .join("")}<IsTruncated>false</IsTruncated></ListMultipartUploadsResult>`,
                );
            }

            if (url.searchParams.get("list-type") === "2") {
                return xml(
                    `<ListBucketResult>${bucket
                        .list({})
                        .contents
.map((object) => `<Contents><Key>${object.key}</Key><LastModified>${object.lastModified?.toISOString() ?? ""}</LastModified></Contents>`)
                        .join("")}<IsTruncated>false</IsTruncated></ListBucketResult>`,
                );
            }

            return new Response(null);
        }

        if (request.method === "POST" && url.searchParams.has("uploads")) {
            return xml(`<InitiateMultipartUploadResult><UploadId>${bucket.createUpload(key)}</UploadId></InitiateMultipartUploadResult>`);
        }

        if (uploadId !== null) {
            if (request.method === "PUT") {
                const etag = bucket.putPart(uploadId, Number(url.searchParams.get("partNumber")), Buffer.from(await request.arrayBuffer()));

                return etag === undefined ? missing("NoSuchUpload") : new Response(null, { headers: { ETag: etag } });
            }

            if (request.method === "GET") {
                const parts = bucket.parts(uploadId);

                return parts === undefined
                    ? missing("NoSuchUpload")
                    : xml(
                          `<ListPartsResult>${parts.map(([number, part]) => `<Part><PartNumber>${String(number)}</PartNumber><ETag>${part.etag}</ETag><Size>${String(part.body.byteLength)}</Size></Part>`).join("")}</ListPartsResult>`,
                      );
            }

            if (request.method === "POST") {
                // A failed predicate leaves the multipart upload in place, as S3 does.
                if (bucket.uploads.has(uploadId) && !holds(key)) {
                    return preconditionFailed();
                }

                const completed = bucket.complete(uploadId);

                return completed === undefined ? missing("NoSuchUpload") : xml(`<CompleteMultipartUploadResult><ETag>${completed.etag}</ETag></CompleteMultipartUploadResult>`);
            }

            return bucket.abort(uploadId) ? new Response(null, { status: 204 }) : missing("NoSuchUpload");
        }

        if (request.method === "PUT") {
            const source = request.headers.get("x-amz-copy-source");

            if (source !== null) {
                const sourceKey = decodeURIComponent(source.slice("uploads/".length));

                if (bucket.objects.has(sourceKey) && (!bucket.holds(sourceKey, { ifMatch: request.headers.get("x-amz-copy-source-if-match") }) || !holds(key))) {
                    return preconditionFailed();
                }

                return bucket.copy(decodeURIComponent(source.slice("uploads/".length)), key) ? xml("<CopyObjectResult/>") : missing();
            }

            const metadata = Object.fromEntries([...request.headers].filter(([name]) => name.startsWith("x-amz-meta-")));
            const object = bucket.put(key, Buffer.from(await request.arrayBuffer()), { metadata });

            return new Response(null, { headers: { ETag: object.etag } });
        }

        if (request.method === "DELETE") {
            if (!holds(key)) {
                return preconditionFailed();
            }

            bucket.objects.delete(key);

            return new Response(null, { status: 204 });
        }

        const read = bucket.read(key, request.headers.get("range"));

        if (!read) {
            return request.method === "HEAD" ? new Response(null, { status: 404 }) : missing();
        }

        if (!holds(key)) {
            return preconditionFailed();
        }

        return new Response(request.method === "HEAD" ? null : read.body, {
            headers: { ...read.object.metadata, "content-length": String(read.body.byteLength), etag: read.object.etag },
            status: read.partial ? 206 : 200,
        });
    };

    return { fetch, objects: bucket.objects, put: bucket.put, requests, state, uploads: bucket.uploads };
};

const createStorage = (options: Partial<ConstructorParameters<typeof AwsLightStorage>[0]> = {}): AwsLightStorage =>
    new AwsLightStorage({
        accessKeyId: "id",
        bucket: "uploads",
        endpoint: "https://s3.test",
        region: "auto",
        retryConfig: { maxRetries: 0 },
        secretAccessKey: "secret",
        ...options,
    });

const upload = async (storage: AwsLightStorage, text: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: text.length });

    await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

    return file.id;
};

describe("aws-light against an in-memory S3", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describeStorageContract(
        () => {
            const s3 = createS3();

            vi.stubGlobal("fetch", s3.fetch);

            return {
                // The fake honours the conditional headers, which a custom endpoint doesn't advertise by default.
                createStorage: (options) => createStorage({ conditional: true, ...options }),
                failBackend: (failing) => {
                    s3.state.override = failing ? () => new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 }) : undefined;
                },
                hasObject: (key) => s3.objects.has(key),
                putObject: (key, content) => {
                    s3.put(key, Buffer.from(content));
                },
            };
        },
    );

    it("should stream an object once, not once per read", async () => {
        expect.assertions(1);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);

        const body = Buffer.alloc(1024 * 1024, 7);

        s3.put("big", body);

        const { stream } = await createStorage().getStream({ id: "big" });
        let length = 0;

        for await (const chunk of stream) {
            length += (chunk as Uint8Array).byteLength;
        }

        expect(length).toBe(body.byteLength);
    });

    it("should forward a byte range to get and getStream", async () => {
        expect.assertions(2);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);
        s3.put("text", Buffer.from("0123456789"));

        const storage = createStorage();
        const file = await storage.get({ id: "text" }, { range: { end: 4, start: 2 } });
        const { stream } = await storage.getStream({ id: "text" }, { range: { start: 7 } });

        expect(file.content.toString()).toBe("234");
        await expect(text(stream)).resolves.toBe("789");
    });

    it("should report a missing object as a 404", async () => {
        expect.assertions(2);

        vi.stubGlobal("fetch", createS3().fetch);

        const storage = createStorage();
        const error = await storage.get({ id: "nope" }).catch((error_: unknown) => error_ as Error);

        expect(error).toMatchObject({ $metadata: { httpStatusCode: 404 }, code: "NoSuchKey", statusCode: 404 });
        expect(storage.normalizeError(error as Error).statusCode).toBe(404);
    });

    it("should keep the metadata of a finished upload, so delete, exists and copy find it", async () => {
        expect.assertions(7);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        await expect(storage.getMeta(id)).resolves.toMatchObject({ status: "completed" });
        await expect(storage.exists({ id })).resolves.toBe(true);

        await storage.copy(id, "copy of it");

        expect(new TextDecoder().decode(s3.objects.get("copy of it")?.body)).toBe("hello");

        await storage.delete({ id });

        expect(s3.objects.has(id)).toBe(false);
        expect(s3.objects.has(`${id}.META`)).toBe(false);
        await expect(storage.exists({ id })).resolves.toBe(false);
        await expect(storage.exists({ id: "copy of it" })).resolves.toBe(true);
    });

    it("should handle objects without metadata, as uploads completed by older versions left them", async () => {
        expect.assertions(4);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);
        s3.put("old", Buffer.from("legacy"));

        const storage = createStorage();

        await expect(storage.exists({ id: "old" })).resolves.toBe(true);

        await storage.move("old", "moved");

        expect(s3.objects.has("old")).toBe(false);
        expect(new TextDecoder().decode(s3.objects.get("moved")?.body)).toBe("legacy");

        await storage.delete({ id: "moved" });

        expect(s3.objects.has("moved")).toBe(false);
    });

    it("should keep the upload's metadata when completing it fails, even with a 200", async () => {
        expect.assertions(3);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);

        // S3 documents that CompleteMultipartUpload can answer 200 with an error body.
        s3.state.override = (request) =>
            request.method === "POST" && new URL(request.url).searchParams.has("uploadId")
                ? new Response("<Error><Code>InternalError</Code></Error>", { status: 200 })
                : undefined;

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 5 });

        await expect(storage.write({ body: Readable.from([Buffer.from("hello")]), contentLength: 5, id: file.id, start: 0 })).rejects.toMatchObject({
            code: "InternalError",
            statusCode: 500,
        });

        await expect(storage.getMeta(file.id)).resolves.not.toHaveProperty("status", "completed");
        expect(s3.uploads.size).toBe(1);
    });

    it("should keep the metadata when aborting the upload fails, and drop it when the upload is gone", async () => {
        expect.assertions(3);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 5 });

        s3.state.override = (request) =>
            request.method === "DELETE" && new URL(request.url).searchParams.has("uploadId")
                ? new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 })
                : undefined;

        await expect(storage.delete({ id: file.id })).rejects.toMatchObject({ statusCode: 403 });
        expect(s3.objects.has(`${file.id}.META`)).toBe(true);

        s3.state.override = undefined;
        s3.uploads.clear();

        await storage.delete({ id: file.id });

        expect(s3.objects.has(`${file.id}.META`)).toBe(false);
    });

    it("should purge expired objects and stale multipart uploads, but not metadata records directly", async () => {
        expect.assertions(4);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);

        const storage = createStorage();
        const [finished, unfinished] = await createdAgo(2 * HOUR, async () =>
            Promise.all([upload(storage, "done"), storage.create({ contentType: "text/plain", metadata: {}, originalName: "b.txt", size: 5 })]),
        );

        const purged = await storage.purge("1h");
        const deletedKeys = s3.requests.filter((request) => request.method === "DELETE").map((request) => new URL(request.url).pathname);

        expect(purged.items.map((item) => item.id).toSorted()).toStrictEqual([finished, unfinished.id].toSorted());
        expect(s3.uploads.size).toBe(0);
        expect(s3.objects.size).toBe(0);
        // Each metadata record is deleted once, with its upload, not purged as an object of its own.
        expect(deletedKeys.filter((path) => path.endsWith(".META"))).toHaveLength(2);
    });

    it("should abort a losing conditional upload and leave the stored object alone", async () => {
        expect.assertions(2);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);

        const files = new Files({ adapter: createStorage({ conditional: true }) });

        await files.upload("a.txt", "one", { ifNoneMatch: "*" });

        await expect(files.upload("a.txt", "two", { ifNoneMatch: "*" })).rejects.toThrow(expect.objectContaining({ UploadErrorCode: ERRORS.PRECONDITION_FAILED }));
        expect([s3.uploads.size, s3.objects.get("a.txt")?.body.toString()]).toStrictEqual([0, "one"]);
    });

    it("should sign a POST policy whose size range the bucket enforces", async () => {
        expect.assertions(6);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);

        // A custom endpoint signs POST policies only when told the service accepts them.
        expect(new Files({ adapter: createStorage() }).capabilities.signedUploadPost).toBe(false);

        const files = new Files({ adapter: createStorage({ uploadPost: true }) });
        const signed = await files.signedUpload("in/up.txt", { contentType: "text/plain", maxSize: 8 });

        expect(signed).toMatchObject({ method: "POST", url: "https://s3.test/uploads/" });

        const post = async (body: string): Promise<number> => {
            const form = new FormData();

            for (const [name, value] of Object.entries((signed as { fields: Record<string, string> }).fields)) {
                form.append(name, value);
            }

            form.append("file", new Blob([body]));

            const response = await fetch(signed.url, { body: form, method: "POST" });

            return response.status;
        };

        await expect(post("too large!")).resolves.toBe(400);
        expect(s3.objects.has("in/up.txt")).toBe(false);
        await expect(post("fits")).resolves.toBe(204);
        expect(s3.objects.get("in/up.txt")?.body.toString()).toBe("fits");
    });

    it("should only claim conditional support for AWS itself unless told to", () => {
        expect.assertions(2);

        vi.stubGlobal("fetch", createS3().fetch);

        expect(new Files({ adapter: createStorage() }).capabilities.conditional.read).toBe(false);
        expect(new Files({ adapter: createStorage({ endpoint: undefined, region: "us-east-1" }) }).capabilities.conditional.read).toBe(true);
    });
});

describe("aws-light configuration", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should hand out query-signed part URLs for clientDirectUpload that the bucket accepts", async () => {
        expect.assertions(4);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);

        const file = (await createStorage({ clientDirectUpload: true }).create({
            contentType: "text/plain",
            metadata: {},
            originalName: "a.txt",
            size: 5,
        })) as { partsUrls?: string[] };
        const url = new URL(file.partsUrls?.[0] as string);

        expect(url.searchParams.get("partNumber")).toBe("1");
        expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
        expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[\da-f]{64}$/u);

        // A client PUTs the part with no credentials of its own.
        await expect(fetch(url, { body: "hello", method: "PUT" })).resolves.toHaveProperty("ok", true);
    });

    it("should fail the startup check for a missing bucket", async () => {
        expect.assertions(2);

        vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));

        const storage = createStorage();

        await expect(storage.ensureReady()).rejects.toThrow("Failed to access bucket: 404");
        expect(storage.isReady).toBe(false);
    });

    it("should keep a local meta storage configured with a directory", async () => {
        expect.assertions(2);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);

        const directory = await mkdtemp(join(tmpdir(), "aws-light-meta-"));

        try {
            const storage = createStorage({ metaStorageConfig: { directory } });
            const id = await upload(storage, "hello");

            expect(s3.objects.has(`${id}.META`)).toBe(false);
            await expect(readdir(directory)).resolves.toContain(`${id}.META`);
        } finally {
            await rm(directory, { force: true, recursive: true });
        }
    });

    it("should consult the user's shouldRetry before the default status codes", async () => {
        expect.assertions(2);

        const s3 = createS3();
        let failures = 0;

        vi.stubGlobal("fetch", s3.fetch);
        s3.state.override = (request, key) => {
            if (request.method !== "GET" || key !== "k" || failures >= 1) {
                return undefined;
            }

            failures += 1;

            return new Response("<Error><Code>Teapot</Code></Error>", { status: 418 });
        };
        s3.put("k", Buffer.from("x"));

        const shouldRetry = vi.fn((error: unknown) => ((error as { statusCode?: number }).statusCode === 418 ? true : undefined));
        const storage = createStorage({ retryConfig: { initialDelay: 0, maxRetries: 1, shouldRetry } });

        await expect(storage.get({ id: "k" })).resolves.toHaveProperty("content", Buffer.from("x"));
        expect(shouldRetry).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 418 }));
    });
});

describe("aws-light request URLs", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const urlFor = async (config: { bucket: string; endpoint?: string; region?: string }, key: string): Promise<string> => {
        const fetch = vi.fn(async () => new Response(null, { headers: { "content-length": "0" } }));

        vi.stubGlobal("fetch", fetch);

        await new AwsLightApiAdapter({ accessKeyId: "id", region: "us-east-1", secretAccessKey: "secret", ...config }).headObject({
            Bucket: config.bucket,
            Key: key,
        });

        return (fetch.mock.calls[0] as unknown as [Request])[0].url;
    };

    it("should encode each key segment", async () => {
        expect.assertions(1);

        await expect(urlFor({ bucket: "b", endpoint: "https://s3.test" }, "dir/a b#c?d.txt")).resolves.toBe("https://s3.test/b/dir/a%20b%23c%3Fd.txt");
    });

    it("should refuse keys with dot segments instead of addressing another object", async () => {
        expect.assertions(1);

        await expect(urlFor({ bucket: "b", endpoint: "https://s3.test" }, "x/../y.txt")).rejects.toThrow(/cannot be addressed/u);
    });

    it("should place the bucket for each kind of endpoint", async () => {
        expect.assertions(4);

        // AWS default: virtual-hosted.
        await expect(urlFor({ bucket: "b" }, "k")).resolves.toBe("https://b.s3.us-east-1.amazonaws.com/k");
        // A service root (R2, MinIO, Spaces): path-style, keeping the endpoint's own path.
        await expect(urlFor({ bucket: "b", endpoint: "https://minio.test/s3/" }, "k")).resolves.toBe("https://minio.test/s3/b/k");
        // An endpoint that already names the bucket.
        await expect(urlFor({ bucket: "b", endpoint: "https://acct.r2.cloudflarestorage.com/b/" }, "k")).resolves.toBe(
            "https://acct.r2.cloudflarestorage.com/b/k",
        );
        await expect(urlFor({ bucket: "b", endpoint: "https://b.nyc3.digitaloceanspaces.com" }, "k")).resolves.toBe("https://b.nyc3.digitaloceanspaces.com/k");
    });
});
