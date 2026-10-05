import { beforeEach, describe, expect, it, vi } from "vitest";

import AwsLightApiAdapter from "../../../src/storage/aws-light/aws-light-api-adapter";

const { mockFetch } = vi.hoisted(() => {
    return { mockFetch: vi.fn() };
});

vi.mock(import("aws4fetch"), () => {
    return {
        AwsClient: class MockAwsClient {
            // eslint-disable-next-line class-methods-use-this
            public get fetch() {
                return mockFetch;
            }
        },
    };
});

describe("awsLightApiAdapter requests", () => {
    const adapter = new AwsLightApiAdapter({ accessKeyId: "id", bucket: "bucket", region: "us-east-1", secretAccessKey: "secret" });
    const failure = (): Response => new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 });

    beforeEach(() => {
        mockFetch.mockReset();
    });

    it.each([
        ["createMultipartUpload", async () => adapter.createMultipartUpload({ Bucket: "bucket", Key: "a" })],
        ["uploadPart", async () => adapter.uploadPart({ Body: new Uint8Array(1), Bucket: "bucket", ContentLength: 1, Key: "a", PartNumber: 1, UploadId: "u" })],
        ["completeMultipartUpload", async () => adapter.completeMultipartUpload({ Bucket: "bucket", Key: "a", Parts: [{ ETag: "e", PartNumber: 1 }], UploadId: "u" })],
        ["listMultipartUploads", async () => adapter.listMultipartUploads({ Bucket: "bucket" })],
        ["listParts", async () => adapter.listParts({ Bucket: "bucket", Key: "a", UploadId: "u" })],
        ["deleteObject", async () => adapter.deleteObject({ Bucket: "bucket", Key: "a" })],
        ["copyObject", async () => adapter.copyObject({ Bucket: "bucket", CopySource: "bucket/b", Key: "a" })],
        ["listObjectsV2", async () => adapter.listObjectsV2({ Bucket: "bucket" })],
    ])("should reject a failed %s with the S3 status and error code", async (_name, call) => {
        expect.assertions(1);

        mockFetch.mockResolvedValueOnce(failure());

        await expect(call()).rejects.toMatchObject({ code: "AccessDenied", statusCode: 403 });
    });

    it("should send the ACL, content type and user metadata when creating a multipart upload", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce(new Response("<InitiateMultipartUploadResult><UploadId>u1</UploadId></InitiateMultipartUploadResult>"));

        await expect(adapter.createMultipartUpload({ ACL: "private", Bucket: "bucket", ContentType: "text/plain", Key: "a", Metadata: { owner: "u1" } })).resolves.toStrictEqual({
            UploadId: "u1",
        });
        expect(mockFetch.mock.calls[0]?.[1]?.headers).toStrictEqual({ "Content-Type": "text/plain", "x-amz-acl": "private", "x-amz-meta-owner": "u1" });
    });

    it("should send Content-MD5 with a part and refuse a response without an ETag", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await expect(
            adapter.uploadPart({ Body: new Uint8Array(1), Bucket: "bucket", ContentLength: 1, ContentMD5: "bWQ1", Key: "a", PartNumber: 1, UploadId: "u" }),
        ).rejects.toThrow("Failed to get ETag from response");
        expect(mockFetch.mock.calls[0]?.[1]?.headers).toStrictEqual({ "Content-Length": "1", "Content-MD5": "bWQ1" });
    });

    it("should page multipart uploads and objects with their markers and filters", async () => {
        expect.assertions(4);

        mockFetch.mockResolvedValueOnce(
            new Response(
                "<ListMultipartUploadsResult><IsTruncated>true</IsTruncated><NextKeyMarker>k2</NextKeyMarker><NextUploadIdMarker>u2</NextUploadIdMarker><Upload><Key>a</Key><UploadId>u1</UploadId><Initiated>2026-01-01T00:00:00.000Z</Initiated></Upload></ListMultipartUploadsResult>",
            ),
        );

        await expect(adapter.listMultipartUploads({ Bucket: "bucket", KeyMarker: "k1", UploadIdMarker: "u0" })).resolves.toStrictEqual(
            expect.objectContaining({ IsTruncated: true, NextKeyMarker: "k2", NextUploadIdMarker: "u2", Uploads: [expect.objectContaining({ Key: "a", UploadId: "u1" })] }),
        );

        const uploadsUrl = new URL(String(mockFetch.mock.calls[0]?.[0]));

        expect([uploadsUrl.searchParams.get("key-marker"), uploadsUrl.searchParams.get("upload-id-marker")]).toStrictEqual(["k1", "u0"]);

        mockFetch.mockResolvedValueOnce(new Response("<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>"));

        await adapter.listObjectsV2({ Bucket: "bucket", ContinuationToken: "t", Delimiter: "/", MaxKeys: 5, Prefix: "docs/" });

        const url = new URL(String(mockFetch.mock.calls[1]?.[0]));

        expect(Object.fromEntries(url.searchParams)).toStrictEqual({ "continuation-token": "t", delimiter: "/", "list-type": "2", "max-keys": "5", prefix: "docs/" });
        expect(url.hostname).toBe("bucket.s3.us-east-1.amazonaws.com");
    });

    it("should copy with a storage class and return user metadata from getObject", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce(new Response("<CopyObjectResult/>"));
        await adapter.copyObject({ Bucket: "bucket", CopySource: "bucket/b", Key: "a", StorageClass: "GLACIER" });

        expect(mockFetch.mock.calls[0]?.[1]?.headers).toStrictEqual({ "x-amz-copy-source": "bucket/b", "x-amz-storage-class": "GLACIER" });

        mockFetch.mockResolvedValueOnce(new Response("body", { headers: { "x-amz-meta-owner": "u1" } }));

        await expect(adapter.getObject({ Bucket: "bucket", Key: "a" })).resolves.toStrictEqual(expect.objectContaining({ Metadata: { owner: "u1" } }));
    });

    it("should put a streamed body as is and leave out a body of any other type", async () => {
        expect.assertions(2);

        const stream = new ReadableStream<Uint8Array>();

        mockFetch.mockImplementation(async () => new Response(null, { headers: { ETag: "\"v1\"" } }));

        await adapter.putObject({ Body: stream, Bucket: "bucket", Key: "a" });
        await adapter.putObject({ Body: "text" as never, Bucket: "bucket", Key: "b" });

        expect(mockFetch.mock.calls[0]?.[1]?.body).toBe(stream);
        expect(mockFetch.mock.calls[1]?.[1]?.body).toBeUndefined();
    });
});
