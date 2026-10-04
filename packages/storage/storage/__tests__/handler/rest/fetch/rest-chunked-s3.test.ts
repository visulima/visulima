import { afterEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../../src/handler/rest/rest-fetch";
import AwsLightStorage from "../../../../src/storage/aws-light/aws-light-storage";

/**
 * In-memory path-style S3 (bucket "uploads") answering the requests AwsLightStorage makes.
 */
const createS3Fake = (): { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>; objects: Map<string, { body: Uint8Array; headers?: Record<string, string> }> } => {
    const objects = new Map<string, { body: Uint8Array; headers?: Record<string, string> }>();
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

const createStorage = (): AwsLightStorage =>
    new AwsLightStorage({
        accessKeyId: "id",
        bucket: "uploads",
        endpoint: "https://acct.r2.cloudflarestorage.com/uploads/",
        region: "auto",
        secretAccessKey: "secret",
    });

describe("fetch RestFetch chunked uploads over AwsLightStorage", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should answer 200 to the chunk that completes a multi-part upload (#907, #908)", async () => {
        expect.assertions(6);

        const s3 = createS3Fake();

        vi.stubGlobal("fetch", s3.fetch);

        const rest = new RestFetch({ storage: createStorage() });
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

        // The metadata is gone with completion, and the object alone can't prove the route created
        // it: HEAD answers 404 (#918), and a PUT under the id must not replace it (#919).
        const head = await rest.fetch(new Request(location, { method: "HEAD" }));
        const put = await rest.fetch(
            new Request(location, { body: "evil", headers: { "content-length": "4", "content-type": "text/plain" }, method: "PUT" }),
        );

        expect([head.status, put.status]).toStrictEqual([404, 409]);
        expect(s3.objects.get(id)?.body.byteLength).toBe(bytes.byteLength);
    });
    it("should not answer HEAD from objects without upload metadata (#918)", async () => {
        expect.assertions(1);

        const s3 = createS3Fake();

        vi.stubGlobal("fetch", s3.fetch);

        s3.objects.set("payroll-2026", { body: new Uint8Array(123) });
        s3.objects.set("avatars/ceo", { body: new Uint8Array(42) });

        const rest = new RestFetch({ storage: createStorage() });
        const statuses: number[] = [];

        for (const path of ["payroll-2026", "payroll-2026.pdf", "avatars%2Fceo"]) {
            const response = await rest.fetch(new Request(`https://app.local/upload/${path}`, { method: "HEAD" }));

            statuses.push(response.status);
        }

        expect(statuses).toStrictEqual([404, 404, 404]);
    });

    it("should refuse a PUT over an object without upload metadata (#919)", async () => {
        expect.assertions(4);

        const s3 = createS3Fake();

        vi.stubGlobal("fetch", s3.fetch);

        s3.objects.set("payroll-2026", { body: new TextEncoder().encode("the real payroll") });

        const rest = new RestFetch({ storage: createStorage() });
        const put = async (path: string): Promise<Response> =>
            rest.fetch(
                new Request(`https://app.local/upload/${path}`, {
                    body: "evil",
                    headers: { "content-length": "4", "content-type": "text/plain" },
                    method: "PUT",
                }),
            );

        const refused = await put("payroll-2026.txt");

        expect(refused.status).toBe(409);
        expect(new TextDecoder().decode(s3.objects.get("payroll-2026")?.body)).toBe("the real payroll");

        const created = await put("fresh.txt");

        expect(created.status).toBe(201);
        expect(new TextDecoder().decode(s3.objects.get("fresh")?.body)).toBe("evil");
    });

    it("should refuse a PUT when the existence check fails (#919)", async () => {
        expect.assertions(2);

        const s3 = createS3Fake();

        // Every object HEAD is refused, as for credentials without read access.
        vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
            const request = input instanceof Request ? input : new Request(input, init);

            return request.method === "HEAD" && new URL(request.url).pathname !== "/uploads/" ? new Response(null, { status: 403 }) : s3.fetch(request);
        });

        s3.objects.set("payroll-2026", { body: new TextEncoder().encode("the real payroll") });

        const rest = new RestFetch({ storage: createStorage() });
        const response = await rest.fetch(
            new Request("https://app.local/upload/payroll-2026.txt", {
                body: "evil",
                headers: { "content-length": "4", "content-type": "text/plain" },
                method: "PUT",
            }),
        );

        expect(response.status).toBeGreaterThanOrEqual(500);
        expect(new TextDecoder().decode(s3.objects.get("payroll-2026")?.body)).toBe("the real payroll");
    });
});
