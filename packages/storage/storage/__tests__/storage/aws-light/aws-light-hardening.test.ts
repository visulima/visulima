import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import AwsLightStorage from "../../../src/storage/aws-light/aws-light-storage";
import { ERRORS } from "../../../src/utils/errors";
import { createAwsLightFake } from "../../__helpers__/fakes/aws-light";

const GIB = 1024 ** 3;

const setup = () => {
    const s3 = createAwsLightFake();

    vi.stubGlobal("fetch", s3.fetch);

    const create = (): AwsLightStorage =>
        new AwsLightStorage({
            accessKeyId: "id",
            bucket: "uploads",
            endpoint: "https://s3.test",
            region: "auto",
            retryConfig: { maxRetries: 0 },
            secretAccessKey: "secret",
        });

    return { create, s3 };
};

const isPartUpload = (request: Request): boolean => request.method === "PUT" && new URL(request.url).searchParams.has("uploadId");

describe("aws-light hardening", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should let only one of two processes claim an upload: each saved record changes its ETag", async () => {
        expect.assertions(2);

        const { create, s3 } = setup();
        const storages = [create(), create()];
        const file = await storages[0]!.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 3 });
        let reads = 0;
        let bothRead: () => void = () => undefined;
        const read = new Promise<void>((resolve) => {
            bothRead = resolve;
        });

        // Both processes read the record before either saves its claim.
        vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const request = new Request(input, init);

            if (request.method === "GET") {
                reads += 1;

                if (reads === 2) {
                    bothRead();
                }
            } else if (request.headers.has("if-match")) {
                await read;
            }

            return s3.fetch(request);
        });

        const results = await Promise.allSettled(storages.map(async (storage) => storage.claimWrite(file.id)));

        expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
        expect(results.find(({ status }) => status === "rejected")).toMatchObject({ reason: { UploadErrorCode: ERRORS.FILE_LOCKED } });
    });

    it("should read empty metadata back as an object", async () => {
        expect.assertions(1);

        const { create } = setup();
        const storage = create();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 3 });

        await expect(storage.getMeta(file.id)).resolves.toHaveProperty("metadata", {});
    });

    it("should refuse an upload stored under the key of a metadata record", async () => {
        expect.assertions(2);

        const { create } = setup();
        const storage = create();

        await storage.create({ contentType: "text/plain", id: "report", metadata: {}, originalName: "report.txt", size: 3 });

        await expect(storage.create({ contentType: "text/plain", id: "report.META", metadata: {}, originalName: "x", size: 3 })).rejects.toMatchObject({
            UploadErrorCode: ERRORS.INVALID_FILE_NAME,
        });
        await expect(storage.getMeta("report")).resolves.toMatchObject({ id: "report" });
    });

    it("should leave retries to the storage's retry config and report the S3 error of a streamed part", async () => {
        expect.assertions(2);

        const { create, s3 } = setup();
        const storage = create();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 3 });

        s3.state.override = (request) => (isPartUpload(request) ? new Response("<Error><Code>SlowDown</Code></Error>", { status: 503 }) : undefined);

        await expect(storage.write({ body: Readable.from([Buffer.from("abc")]), contentLength: 3, id: file.id, start: 0 })).rejects.toMatchObject({
            code: "SlowDown",
            statusCode: 503,
        });
        expect(s3.requests.filter((request) => isPartUpload(request))).toHaveLength(1);
    });

    // 384 sequential part copies run just over vitest's 5s default on the
    // Windows CI runner.
    it("should copy an object over 5 GiB part by part", { timeout: 60_000 }, async () => {
        expect.assertions(4);

        const { create, s3 } = setup();
        const size = 6 * GIB;

        s3.put("big", Buffer.from("x"));
        s3.state.override = (request, key) => {
            if (request.method === "HEAD" && key === "big") {
                return new Response(null, {
                    headers: { "content-length": String(size), "content-type": "video/mp4", etag: '"b"', "x-amz-meta-originalname": "big.mp4" },
                });
            }

            if (isPartUpload(request)) {
                return new Response(`<CopyPartResult><ETag>"p${String(new URL(request.url).searchParams.get("partNumber"))}"</ETag></CopyPartResult>`);
            }

            return undefined;
        };

        await create().copy("big", "big copy");

        const copies = s3.requests.filter((request) => isPartUpload(request));
        const created = s3.requests.find((request) => request.method === "POST" && new URL(request.url).searchParams.has("uploads"));

        expect(copies).toHaveLength(size / (16 * 1024 * 1024));
        expect(copies[0]?.headers.get("x-amz-copy-source-range")).toBe("bytes=0-16777215");
        expect([created?.headers.get("content-type"), created?.headers.get("x-amz-meta-originalname")]).toStrictEqual(["video/mp4", "big.mp4"]);
        expect(s3.objects.has("big copy")).toBe(true);
    });
});
