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
