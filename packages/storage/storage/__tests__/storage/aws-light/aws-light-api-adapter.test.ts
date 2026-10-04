import { beforeEach, describe, expect, it, vi } from "vitest";

import AwsLightApiAdapter, { parseXml } from "../../../src/storage/aws-light/aws-light-api-adapter";

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

describe("awsLightApiAdapter.putObject", () => {
    const adapter = new AwsLightApiAdapter({ accessKeyId: "id", bucket: "bucket", region: "us-east-1", secretAccessKey: "secret" });

    beforeEach(() => {
        mockFetch.mockReset();
    });

    it("should send a quoted If-Match header and return the new ETag", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce(new Response(null, { headers: { ETag: '"v2"' }, status: 200 }));

        const result = await adapter.putObject({ Bucket: "bucket", IfMatch: "v1", Key: "a.META" });

        expect(mockFetch.mock.calls[0]?.[1]?.headers).toStrictEqual(expect.objectContaining({ "If-Match": '"v1"' }));
        expect(result).toStrictEqual({ ETag: "v2" });
    });

    it("should expose the status code of a failed put", async () => {
        expect.assertions(1);

        mockFetch.mockResolvedValueOnce(new Response("PreconditionFailed", { status: 412 }));

        await expect(adapter.putObject({ Bucket: "bucket", IfMatch: "v1", Key: "a.META" })).rejects.toMatchObject({ statusCode: 412 });
    });
});

describe(parseXml, () => {
    it("should keep repeated nested siblings as an array (#907)", () => {
        expect.assertions(1);

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListPartsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Bucket>uploads</Bucket><UploadId>u1</UploadId>
  <Part><PartNumber>1</PartNumber><ETag>"e1"</ETag><Size>5242880</Size></Part>
  <Part><PartNumber>2</PartNumber><ETag>"e2"</ETag><Size>1024</Size></Part>
</ListPartsResult>`;

        expect(parseXml(xml)).toStrictEqual({
            ListPartsResult: {
                Bucket: "uploads",
                Part: [
                    { ETag: '"e1"', PartNumber: "1", Size: "5242880" },
                    { ETag: '"e2"', PartNumber: "2", Size: "1024" },
                ],
                UploadId: "u1",
            },
        });
    });

    it("should decode entities and CDATA, and skip empty and self-closing elements", () => {
        expect.assertions(1);

        expect(parseXml("<R><Key>a &amp; b &#60;&#x3E;</Key><Raw><![CDATA[x &amp; <y>]]></Raw><Empty></Empty><Self/></R>")).toStrictEqual({
            R: { Key: "a & b <>", Raw: "x &amp; <y>" },
        });
    });

    it("should not hoist nested leaves to the top level", () => {
        expect.assertions(1);

        expect(parseXml("<R><Part><Size>1</Size></Part></R>")).toStrictEqual({ R: { Part: { Size: "1" } } });
    });
});

describe("awsLightApiAdapter list responses (#907)", () => {
    const adapter = new AwsLightApiAdapter({ accessKeyId: "id", bucket: "bucket", region: "us-east-1", secretAccessKey: "secret" });

    beforeEach(() => {
        mockFetch.mockReset();
    });

    it("should return every part of a ListParts response", async () => {
        expect.assertions(1);

        mockFetch.mockResolvedValueOnce(
            new Response(
                `<ListPartsResult><Part><PartNumber>1</PartNumber><ETag>"e1"</ETag><Size>5242880</Size></Part><Part><PartNumber>2</PartNumber><ETag>"e2"</ETag><Size>5242880</Size></Part><Part><PartNumber>3</PartNumber><ETag>"e3"</ETag><Size>1024</Size></Part></ListPartsResult>`,
            ),
        );

        await expect(adapter.listParts({ Bucket: "bucket", Key: "file", UploadId: "u1" })).resolves.toStrictEqual({
            Parts: [
                { ETag: "e1", PartNumber: 1, Size: 5_242_880 },
                { ETag: "e2", PartNumber: 2, Size: 5_242_880 },
                { ETag: "e3", PartNumber: 3, Size: 1024 },
            ],
        });
    });

    it("should return every object and common prefix of a ListObjectsV2 response", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce(
            new Response(
                "<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>a</Key></Contents><Contents><Key>b</Key></Contents><CommonPrefixes><Prefix>p/</Prefix></CommonPrefixes><CommonPrefixes><Prefix>q/</Prefix></CommonPrefixes></ListBucketResult>",
            ),
        );

        const result = await adapter.listObjectsV2({ Bucket: "bucket" });

        expect(result.Contents?.map((item) => item.Key)).toStrictEqual(["a", "b"]);
        expect(result.CommonPrefixes).toStrictEqual([{ Prefix: "p/" }, { Prefix: "q/" }]);
    });
});
