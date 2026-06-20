import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { snsProvider } from "../src/providers/sms/sns";

const SIGV4_PREFIX = /^AWS4-HMAC-SHA256 /;
const ACCESS_KEY_ID = /accessKeyId/;

const xmlResponse = (body: string, status = 200): Response => new Response(body, { headers: { "Content-Type": "text/xml" }, status });

const PUBLISH_OK = `<?xml version="1.0"?>
<PublishResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <PublishResult>
    <MessageId>978d4b6a-test-4c3f-9a11-abcabcabcabc</MessageId>
  </PublishResult>
</PublishResponse>`;

describe("aws sns provider", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("signs the request with SigV4 and returns the parsed MessageId", async () => {
        expect.assertions(5);

        fetchMock.mockResolvedValue(xmlResponse(PUBLISH_OK, 200));

        const provider = snsProvider({ accessKeyId: "AKIAEXAMPLE", region: "eu-central-1", secretAccessKey: "secret" });
        const result = await provider.send({ text: "hello", to: "+15555550100" });

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBe("978d4b6a-test-4c3f-9a11-abcabcabcabc");

        const [url, init] = fetchMock.mock.calls[0];

        expect(String(url)).toBe("https://sns.eu-central-1.amazonaws.com/");
        expect(String(init.headers.Authorization)).toMatch(SIGV4_PREFIX);
        expect(String(init.body)).toContain("Action=Publish");
    });

    it("includes a SenderID message attribute when `from` is set", async () => {
        expect.assertions(1);

        fetchMock.mockResolvedValue(xmlResponse(PUBLISH_OK, 200));

        const provider = snsProvider({ accessKeyId: "AKIAEXAMPLE", secretAccessKey: "secret" });

        await provider.send({ from: "MyApp", text: "hi", to: "+1" });

        const [, init] = fetchMock.mock.calls[0];

        expect(String(init.body)).toContain("AWS.SNS.SMS.SenderID");
    });

    it("surfaces an SNS error response as a failed result", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(xmlResponse(`<ErrorResponse><Error><Message>Invalid parameter</Message></Error></ErrorResponse>`, 400));

        const provider = snsProvider({ accessKeyId: "AKIAEXAMPLE", secretAccessKey: "secret" });
        const result = await provider.send({ text: "hi", to: "+1" });

        expect(result.success).toBe(false);
        expect((result.error as Error).message).toContain("Invalid parameter");
    });

    it("throws when credentials are missing", () => {
        expect.assertions(1);

        expect(() => snsProvider({ accessKeyId: "", secretAccessKey: "" })).toThrow(ACCESS_KEY_ID);
    });
});
