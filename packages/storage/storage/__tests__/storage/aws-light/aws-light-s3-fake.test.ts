import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import AwsLightApiAdapter from "../../../src/storage/aws-light/aws-light-api-adapter";
import AwsLightStorage from "../../../src/storage/aws-light/aws-light-storage";

type Stored = { body: Uint8Array; headers: Record<string, string>; lastModified: Date };

/**
 * In-memory path-style S3 at https://s3.test with the bucket "uploads". `override` answers a
 * request before the fake does, to inject failures.
 */
const createS3 = () => {
    const objects = new Map<string, Stored>();
    const uploads = new Map<string, { initiated: Date; key: string; parts: Map<number, Uint8Array> }>();
    const requests: Request[] = [];
    const state: { override?: (request: Request, key: string) => Response | undefined } = {};

    const xml = (body: string): Response => new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`);
    const missing = (code = "NoSuchKey"): Response => new Response(`<Error><Code>${code}</Code></Error>`, { status: 404 });

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

        if (key === "") {
            if (url.searchParams.has("uploads")) {
                return xml(
                    `<ListMultipartUploadsResult>${[...uploads]
                        .map(
                            ([id, upload]) =>
                                `<Upload><Key>${upload.key}</Key><UploadId>${id}</UploadId><Initiated>${upload.initiated.toISOString()}</Initiated></Upload>`,
                        )
                        .join("")}<IsTruncated>false</IsTruncated></ListMultipartUploadsResult>`,
                );
            }

            if (url.searchParams.get("list-type") === "2") {
                return xml(
                    `<ListBucketResult>${[...objects]
                        .map(([name, object]) => `<Contents><Key>${name}</Key><LastModified>${object.lastModified.toISOString()}</LastModified></Contents>`)
                        .join("")}<IsTruncated>false</IsTruncated></ListBucketResult>`,
                );
            }

            return new Response(null);
        }

        if (request.method === "POST" && url.searchParams.has("uploads")) {
            const id = `u${String(uploads.size + 1)}`;

            uploads.set(id, { initiated: new Date(), key, parts: new Map() });

            return xml(`<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
        }

        if (uploadId !== null) {
            const upload = uploads.get(uploadId);

            if (!upload) {
                return missing("NoSuchUpload");
            }

            if (request.method === "PUT") {
                const partNumber = Number(url.searchParams.get("partNumber"));

                upload.parts.set(partNumber, new Uint8Array(await request.arrayBuffer()));

                return new Response(null, { headers: { ETag: `"p${String(partNumber)}"` } });
            }

            const sorted = [...upload.parts].toSorted(([a], [b]) => a - b);

            if (request.method === "GET") {
                return xml(
                    `<ListPartsResult>${sorted.map(([number, body]) => `<Part><PartNumber>${String(number)}</PartNumber><ETag>"p${String(number)}"</ETag><Size>${String(body.byteLength)}</Size></Part>`).join("")}</ListPartsResult>`,
                );
            }

            uploads.delete(uploadId);

            if (request.method === "POST") {
                objects.set(upload.key, { body: Buffer.concat(sorted.map(([, body]) => body)), headers: {}, lastModified: new Date() });

                return xml(`<CompleteMultipartUploadResult><ETag>"done"</ETag></CompleteMultipartUploadResult>`);
            }

            return new Response(null, { status: 204 });
        }

        if (request.method === "PUT") {
            const source = request.headers.get("x-amz-copy-source");

            if (source !== null) {
                const copied = objects.get(decodeURIComponent(source.slice("uploads/".length)));

                if (!copied) {
                    return missing();
                }

                objects.set(key, { ...copied, lastModified: new Date() });

                return xml("<CopyObjectResult/>");
            }

            const headers = Object.fromEntries([...request.headers].filter(([name]) => name.startsWith("x-amz-meta-")));

            objects.set(key, { body: new Uint8Array(await request.arrayBuffer()), headers, lastModified: new Date() });

            return new Response(null, { headers: { ETag: '"m"' } });
        }

        if (request.method === "DELETE") {
            objects.delete(key);

            return new Response(null, { status: 204 });
        }

        const stored = objects.get(key);

        if (!stored) {
            return request.method === "HEAD" ? new Response(null, { status: 404 }) : missing();
        }

        const range = /^bytes=(\d+)-(\d*)$/u.exec(request.headers.get("range") ?? "");
        const end = range?.[2] ? Number(range[2]) + 1 : undefined;
        const body = range ? stored.body.slice(Number(range[1]), end) : stored.body;

        return new Response(request.method === "HEAD" ? null : body, {
            headers: { ...stored.headers, "content-length": String(body.byteLength) },
            status: range ? 206 : 200,
        });
    };

    return { fetch, objects, requests, state, uploads };
};

const createStorage = (): AwsLightStorage =>
    new AwsLightStorage({
        accessKeyId: "id",
        bucket: "uploads",
        endpoint: "https://s3.test",
        region: "auto",
        retryConfig: { maxRetries: 0 },
        secretAccessKey: "secret",
    });

const upload = async (storage: AwsLightStorage, text: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: text.length });

    await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

    return file.id;
};

const readAll = async (stream: Readable): Promise<string> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk as Uint8Array));
    }

    return Buffer.concat(chunks).toString();
};

describe("aws-light against an in-memory S3", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should stream an object once, not once per read", async () => {
        expect.assertions(1);

        const s3 = createS3();

        vi.stubGlobal("fetch", s3.fetch);

        const body = Buffer.alloc(1024 * 1024, 7);

        s3.objects.set("big", { body, headers: {}, lastModified: new Date() });

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
        s3.objects.set("text", { body: Buffer.from("0123456789"), headers: {}, lastModified: new Date() });

        const storage = createStorage();
        const file = await storage.get({ id: "text" }, { range: { end: 4, start: 2 } });
        const { stream } = await storage.getStream({ id: "text" }, { range: { start: 7 } });

        expect(file.content.toString()).toBe("234");
        await expect(readAll(stream)).resolves.toBe("789");
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
        s3.objects.set("old", { body: Buffer.from("legacy"), headers: {}, lastModified: new Date() });

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
        const finished = await upload(storage, "done");
        const unfinished = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "b.txt", size: 5 });
        const old = new Date(Date.now() - 2 * 60 * 60 * 1000);

        s3.objects.get(finished)!.lastModified = old;
        s3.objects.get(`${finished}.META`)!.lastModified = old;
        s3.objects.get(`${unfinished.id}.META`)!.lastModified = old;
        [...s3.uploads.values()][0]!.initiated = old;

        const purged = await storage.purge("1h");
        const deletedKeys = s3.requests.filter((request) => request.method === "DELETE").map((request) => new URL(request.url).pathname);

        expect(purged.items.map((item) => item.id).toSorted()).toStrictEqual([finished, unfinished.id].toSorted());
        expect(s3.uploads.size).toBe(0);
        expect(s3.objects.size).toBe(0);
        // Each metadata record is deleted once, with its upload, not purged as an object of its own.
        expect(deletedKeys.filter((path) => path.endsWith(".META"))).toHaveLength(2);
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
