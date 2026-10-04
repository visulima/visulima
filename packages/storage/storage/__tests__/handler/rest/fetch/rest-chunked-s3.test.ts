import { afterEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../../src/handler/rest/rest-fetch";
import AwsLightStorage from "../../../../src/storage/aws-light/aws-light-storage";

/**
 * In-memory path-style S3 (bucket "uploads") answering the requests AwsLightStorage makes.
 */
const createS3Fake = (): { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>; objects: Map<string, { body: Uint8Array }> } => {
    const objects = new Map<string, { body: Uint8Array; headers: Record<string, string> }>();
    const uploads = new Map<string, { key: string; parts: Map<number, { body: Uint8Array; etag: string }> }>();
    let counter = 0;

    const xml = (body: string): Response => new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, { headers: { "content-type": "application/xml" } });
    const missing = (): Response => new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 });

    const fake = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        const key = decodeURIComponent(url.pathname.slice("/uploads/".length));
        const uploadId = url.searchParams.get("uploadId");

        if (key === "") {
            return new Response(null, { status: 200 });
        }

        if (request.method === "POST" && url.searchParams.has("uploads")) {
            const id = `u${String(uploads.size + 1)}`;

            uploads.set(id, { key, parts: new Map() });

            return xml(`<InitiateMultipartUploadResult><Key>${key}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
        }

        if (uploadId !== null) {
            const upload = uploads.get(uploadId);

            if (!upload) {
                return missing();
            }

            if (request.method === "PUT") {
                counter += 1;

                const etag = `e${String(counter)}`;

                upload.parts.set(Number(url.searchParams.get("partNumber")), { body: new Uint8Array(await request.arrayBuffer()), etag });

                return new Response(null, { headers: { ETag: `"${etag}"` } });
            }

            const sorted = [...upload.parts].toSorted(([a], [b]) => a - b);

            if (request.method === "GET") {
                return xml(
                    `<ListPartsResult>${sorted.map(([number, part]) => `<Part><PartNumber>${String(number)}</PartNumber><ETag>"${part.etag}"</ETag><Size>${String(part.body.byteLength)}</Size></Part>`).join("")}</ListPartsResult>`,
                );
            }

            uploads.delete(uploadId);

            if (request.method === "POST") {
                const body = new Uint8Array(sorted.reduce((sum, [, part]) => sum + part.body.byteLength, 0));
                let offset = 0;

                for (const [, part] of sorted) {
                    body.set(part.body, offset);
                    offset += part.body.byteLength;
                }

                objects.set(upload.key, { body, headers: {} });

                return xml(`<CompleteMultipartUploadResult><Key>${upload.key}</Key><ETag>"done"</ETag></CompleteMultipartUploadResult>`);
            }

            return new Response(null, { status: 204 });
        }

        if (request.method === "PUT") {
            const headers = Object.fromEntries([...request.headers].filter(([name]) => name.startsWith("x-amz-meta-")));

            objects.set(key, { body: new Uint8Array(await request.arrayBuffer()), headers });

            return new Response(null, { headers: { ETag: `"m${String(counter)}"` } });
        }

        if (request.method === "DELETE") {
            objects.delete(key);

            return new Response(null, { status: 204 });
        }

        const stored = objects.get(key);

        if (!stored) {
            return missing();
        }

        return new Response(request.method === "HEAD" ? null : stored.body, {
            headers: { ...stored.headers, "content-length": String(stored.body.byteLength) },
        });
    };

    return { fetch: fake, objects };
};

describe("fetch RestFetch chunked uploads over AwsLightStorage", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should answer 200 to the chunk that completes a multi-part upload (#907, #908)", async () => {
        expect.assertions(4);

        const s3 = createS3Fake();

        vi.stubGlobal("fetch", s3.fetch);

        const storage = new AwsLightStorage({
            accessKeyId: "id",
            bucket: "uploads",
            endpoint: "https://acct.r2.cloudflarestorage.com/uploads/",
            region: "auto",
            secretAccessKey: "secret",
        });
        const rest = new RestFetch({ storage });
        const mib = 1024 * 1024;
        const bytes = new Uint8Array(11 * mib).map((_, index) => index % 251);
        const endpoint = "https://app.local/upload";

        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": String(bytes.byteLength) },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const statuses: number[] = [];

        // Three parts, so a ListParts response with several <Part> elements has to be read (#907).
        for (const [start, end] of [
            [0, 5 * mib],
            [5 * mib, 10 * mib],
            [10 * mib, 11 * mib],
        ] as const) {
            const response = await rest.fetch(
                new Request(location, {
                    body: bytes.slice(start, end),
                    headers: { "content-length": String(end - start), "content-type": "application/octet-stream", "x-chunk-offset": String(start) },
                    method: "PATCH",
                }),
            );

            statuses.push(response.status);

            if (end === bytes.byteLength) {
                expect(response.headers.get("x-upload-complete")).toBe("true");
            }
        }

        expect(statuses).toStrictEqual([202, 202, 200]);

        const id = (location.split("/").pop() as string).replace(/\.[^.]*$/u, "");
        const stored = s3.objects.get(id)?.body;

        expect(stored?.byteLength).toBe(bytes.byteLength);
        expect(Buffer.from(stored as Uint8Array).equals(Buffer.from(bytes))).toBe(true);
    });
    it("should answer HEAD for a completed upload whose metadata was deleted (#915)", async () => {
        expect.assertions(6);

        vi.stubGlobal("fetch", createS3Fake().fetch);

        const storage = new AwsLightStorage({
            accessKeyId: "id",
            bucket: "uploads",
            endpoint: "https://acct.r2.cloudflarestorage.com/uploads/",
            region: "auto",
            secretAccessKey: "secret",
        });
        const rest = new RestFetch({ storage });
        const bytes = new Uint8Array(1024).map((_, index) => index % 251);
        const endpoint = "https://app.local/upload";

        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": String(bytes.byteLength) },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;

        const completed = await rest.fetch(
            new Request(location, {
                body: bytes,
                headers: { "content-length": String(bytes.byteLength), "content-type": "application/octet-stream", "x-chunk-offset": "0" },
                method: "PATCH",
            }),
        );

        expect(completed.status).toBe(200);

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect(head.status).toBe(200);
        expect(head.headers.get("x-upload-complete")).toBe("true");
        expect(head.headers.get("x-upload-offset")).toBe(String(bytes.byteLength));
        expect(JSON.parse(head.headers.get("x-received-chunks") as string)).toStrictEqual([{ length: bytes.byteLength, offset: 0 }]);

        const unknown = await rest.fetch(new Request(`${endpoint}/does-not-exist`, { method: "HEAD" }));

        expect(unknown.status).toBe(404);
    });
});
