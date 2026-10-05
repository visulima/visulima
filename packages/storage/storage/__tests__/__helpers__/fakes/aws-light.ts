import { createS3State } from "../s3-state";

// Copied from __tests__/storage/aws-light/aws-light-s3-fake.test.ts so other suites can share it; unlike
// the original it keeps an object's Content-Type and serves it back, as S3 does.

const amzMetadata = (request: Request): Record<string, string> => Object.fromEntries([...request.headers].filter(([name]) => name.startsWith("x-amz-meta-")));

/**
 * In-memory path-style S3 at https://s3.test with the bucket "uploads". `override` answers a
 * request before the fake does, to inject failures.
 */
export const createAwsLightFake = () => {
    const bucket = createS3State();
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
.map(
                            (object) => `<Contents><Key>${object.key}</Key><LastModified>${object.lastModified?.toISOString() ?? ""}</LastModified></Contents>`,
                        )
                        .join("")}<IsTruncated>false</IsTruncated></ListBucketResult>`,
                );
            }

            return new Response(null);
        }

        if (request.method === "POST" && url.searchParams.has("uploads")) {
            return xml(
                `<InitiateMultipartUploadResult><UploadId>${bucket.createUpload(key, { contentType: request.headers.get("content-type") ?? undefined, metadata: amzMetadata(request) })}</UploadId></InitiateMultipartUploadResult>`,
            );
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
                const body = await request.text();
                const requested = [...body.matchAll(/<PartNumber>(\d+)<\/PartNumber>/g)].map(([, number]) => Number(number));
                const completed = bucket.complete(uploadId, requested);

                return completed === undefined
                    ? missing("NoSuchUpload")
                    : xml(`<CompleteMultipartUploadResult><ETag>${completed.etag}</ETag></CompleteMultipartUploadResult>`);
            }

            return bucket.abort(uploadId) ? new Response(null, { status: 204 }) : missing("NoSuchUpload");
        }

        if (request.method === "PUT") {
            const source = request.headers.get("x-amz-copy-source");

            if (source !== null) {
                return bucket.copy(decodeURIComponent(source.slice("uploads/".length)), key) ? xml("<CopyObjectResult/>") : missing();
            }

            const ifMatch = request.headers.get("if-match");

            if (ifMatch !== null && bucket.objects.get(key)?.etag !== ifMatch) {
                return new Response("<Error><Code>PreconditionFailed</Code></Error>", { status: 412 });
            }

            const object = bucket.put(key, Buffer.from(await request.arrayBuffer()), {
                contentType: request.headers.get("content-type") ?? undefined,
                metadata: amzMetadata(request),
            });

            return new Response(null, { headers: { ETag: object.etag } });
        }

        if (request.method === "DELETE") {
            bucket.objects.delete(key);

            return new Response(null, { status: 204 });
        }

        const read = bucket.read(key, request.headers.get("range"));

        if (!read) {
            return request.method === "HEAD" ? new Response(null, { status: 404 }) : missing();
        }

        return new Response(request.method === "HEAD" ? null : read.body, {
            // Like S3, an object stored without a type is served as binary/octet-stream.
            headers: {
                ...read.object.metadata,
                "content-length": String(read.body.byteLength),
                "content-type": read.object.contentType ?? "binary/octet-stream",
                etag: read.object.etag,
            },
            status: read.partial ? 206 : 200,
        });
    };

    return { fetch, objects: bucket.objects, put: bucket.put, requests, state, uploads: bucket.uploads };
};
