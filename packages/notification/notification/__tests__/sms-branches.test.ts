import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../src/errors/required-option-error";
import { messageBirdProvider } from "../src/providers/sms/messagebird";
import { plivoProvider } from "../src/providers/sms/plivo";
import { snsProvider } from "../src/providers/sms/sns";
import { telnyxProvider } from "../src/providers/sms/telnyx";
import { twilioProvider } from "../src/providers/sms/twilio";
import { vonageProvider } from "../src/providers/sms/vonage";

const jsonResponse = (body: unknown, status = 200): Response => Response.json(body, { headers: { "Content-Type": "application/json" }, status });

const textResponse = (body: string, status = 200): Response => new Response(body, { headers: { "Content-Type": "text/plain" }, status });

const SNS_MESSAGE_ID = /^sns/;
const SNS_AUTHORIZATION = /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/eu-west-1\/sns\/aws4_request, SignedHeaders=[\w;-]+, Signature=[\da-f]{64}$/;
const SNS_AMZ_DATE = /^\d{8}T\d{6}Z$/;

describe("sms provider branch coverage", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    describe("missing-sender guards", () => {
        it("vonage fails without a sender", async () => {
            expect.assertions(2);

            const provider = vonageProvider({ apiKey: "k", apiSecret: "s" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Missing sender");
        });

        it("plivo fails without a sender", async () => {
            expect.assertions(2);

            const provider = plivoProvider({ authId: "id", authToken: "tok" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Missing sender");
        });

        it("messagebird fails without an originator", async () => {
            expect.assertions(2);

            const provider = messageBirdProvider({ accessKey: "key" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Missing originator");
        });

        it("telnyx fails without a sender or messaging profile", async () => {
            expect.assertions(2);

            const provider = telnyxProvider({ apiKey: "key" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Missing sender");
        });

        it("twilio sends via messagingServiceSid when no from is configured", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ sid: "SM-msg" }, 201));

            const provider = twilioProvider({ accountSid: "AC1", authToken: "tok", messagingServiceSid: "MG1" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(true);

            const [, init] = fetchMock.mock.calls[0];

            expect(String(init.body)).toContain("MessagingServiceSid=MG1");
        });
    });

    describe("http >= 400 error surfacing", () => {
        it("vonage surfaces error-text on a non-zero status", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ messages: [{ "error-text": "Invalid Credentials", status: "4" }] }, 401));

            const provider = vonageProvider({ apiKey: "k", apiSecret: "s", from: "App", retries: 0 });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Invalid Credentials");
        });

        it("plivo surfaces the body error on a >=400 response", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ error: "invalid destination" }, 400));

            const provider = plivoProvider({ authId: "id", authToken: "tok", from: "+15550000000", retries: 0 });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("invalid destination");
        });

        it("telnyx surfaces errors[0].detail on a >=400 response", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ errors: [{ detail: "Invalid phone number" }] }, 422));

            const provider = telnyxProvider({ apiKey: "key", from: "+15550000000", retries: 0 });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Invalid phone number");
        });

        it("sns surfaces the Message tag on a 4xx response", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(textResponse("<ErrorResponse><Error><Message>Invalid parameter</Message></Error></ErrorResponse>", 400));

            const provider = snsProvider({ accessKeyId: "AKIA", retries: 0, secretAccessKey: "secret" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Invalid parameter");
        });

        it("twilio falls back to an HTTP status message when error_message is absent", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ status: 400 }, 400));

            const provider = twilioProvider({ accountSid: "AC1", authToken: "tok", from: "+15550000000", retries: 0 });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("HTTP 400");
        });
    });

    describe("network rejection surfaces a failure", () => {
        it("twilio surfaces the rejection message", async () => {
            expect.assertions(2);

            fetchMock.mockRejectedValue(new Error("socket hang up"));

            const provider = twilioProvider({ accountSid: "AC1", authToken: "tok", from: "+15550000000", retries: 0 });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("socket hang up");
        });

        it("plivo surfaces the rejection message", async () => {
            expect.assertions(2);

            fetchMock.mockRejectedValue(new Error("ECONNRESET"));

            const provider = plivoProvider({ authId: "id", authToken: "tok", from: "+15550000000", retries: 0 });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("ECONNRESET");
        });

        it("telnyx surfaces the rejection message", async () => {
            expect.assertions(2);

            fetchMock.mockRejectedValue(new Error("dns failure"));

            const provider = telnyxProvider({ apiKey: "key", from: "+15550000000", retries: 0 });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("dns failure");
        });

        it("vonage surfaces the rejection message", async () => {
            expect.assertions(2);

            fetchMock.mockRejectedValue(new Error("aborted"));

            const provider = vonageProvider({ apiKey: "k", apiSecret: "s", from: "App", retries: 0 });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("aborted");
        });

        it("messagebird surfaces the rejection message", async () => {
            expect.assertions(2);

            fetchMock.mockRejectedValue(new Error("timeout"));

            const provider = messageBirdProvider({ accessKey: "key", from: "App", retries: 0 });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("timeout");
        });

        it("sns surfaces the rejection message", async () => {
            expect.assertions(2);

            fetchMock.mockRejectedValue(new Error("connection refused"));

            const provider = snsProvider({ accessKeyId: "AKIA", retries: 0, secretAccessKey: "secret" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("connection refused");
        });
    });

    describe("transient 503 then 200 retries", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        it("twilio retries a 503 then succeeds", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValueOnce(jsonResponse({ error_message: "busy" }, 503));
            fetchMock.mockResolvedValueOnce(jsonResponse({ sid: "SM-retry" }, 201));

            const provider = twilioProvider({ accountSid: "AC1", authToken: "tok", from: "+15550000000", retries: 1 });
            const promise = provider.send({ text: "hi", to: "+1" });

            await vi.runAllTimersAsync();

            const result = await promise;

            expect(result.success).toBe(true);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("vonage retries a 503 then succeeds", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValueOnce(jsonResponse({}, 503));
            fetchMock.mockResolvedValueOnce(jsonResponse({ messages: [{ "message-id": "v-retry", status: "0" }] }));

            const provider = vonageProvider({ apiKey: "k", apiSecret: "s", from: "App", retries: 1 });
            const promise = provider.send({ text: "hi", to: "+1" });

            await vi.runAllTimersAsync();

            const result = await promise;

            expect(result.success).toBe(true);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("plivo retries a 503 then succeeds", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValueOnce(jsonResponse({}, 503));
            fetchMock.mockResolvedValueOnce(jsonResponse({ message_uuid: ["p-retry"] }, 202));

            const provider = plivoProvider({ authId: "id", authToken: "tok", from: "+15550000000", retries: 1 });
            const promise = provider.send({ text: "hi", to: "+1" });

            await vi.runAllTimersAsync();

            const result = await promise;

            expect(result.success).toBe(true);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("messagebird retries a 503 then succeeds", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValueOnce(jsonResponse({}, 503));
            fetchMock.mockResolvedValueOnce(jsonResponse({ id: "mb-retry" }, 201));

            const provider = messageBirdProvider({ accessKey: "key", from: "App", retries: 1 });
            const promise = provider.send({ text: "hi", to: "+1" });

            await vi.runAllTimersAsync();

            const result = await promise;

            expect(result.success).toBe(true);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("sns retries a 503 then succeeds", async () => {
            expect.assertions(2);

            // SNS signing relies on Web Crypto promises that do not interleave cleanly
            // with fake timers, so use real timers and a tiny backoff via retries: 1.
            vi.useRealTimers();

            fetchMock.mockResolvedValueOnce(textResponse("unavailable", 503));
            fetchMock.mockResolvedValueOnce(textResponse("<PublishResponse><PublishResult><MessageId>sns-retry</MessageId></PublishResult></PublishResponse>"));

            const provider = snsProvider({ accessKeyId: "AKIA", retries: 1, secretAccessKey: "secret" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(true);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });
    });

    describe("malformed or empty response bodies", () => {
        it("twilio returns a result with an empty sid on an empty body", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({}, 201));

            const provider = twilioProvider({ accountSid: "AC1", authToken: "tok", from: "+15550000000" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("");
        });

        it("vonage treats an empty messages array as a failure", async () => {
            expect.assertions(1);

            fetchMock.mockResolvedValue(jsonResponse({}));

            const provider = vonageProvider({ apiKey: "k", apiSecret: "s", from: "App" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(false);
        });

        it("telnyx returns an undefined messageId on an empty body", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({}));

            const provider = telnyxProvider({ apiKey: "key", from: "+15550000000" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("");
        });

        it("sns generates a messageId when the response lacks a MessageId tag", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(textResponse("<PublishResponse></PublishResponse>"));

            const provider = snsProvider({ accessKeyId: "AKIA", secretAccessKey: "secret" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toMatch(SNS_MESSAGE_ID);
        });

        it("plivo falls back to a synthesised recipient when none are provided", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ message_uuid: [] }, 202));

            const provider = plivoProvider({ authId: "id", authToken: "tok", from: "+15550000000" });
            const result = await provider.send({ text: "hi", to: "+1" });

            expect(result.success).toBe(true);
            expect(result.data?.recipients).toHaveLength(1);
        });
    });

    describe("missing credentials at factory time", () => {
        it("twilio throws without accountSid", () => {
            expect.assertions(1);

            expect(() => twilioProvider({ authToken: "tok" } as never)).toThrow(RequiredOptionError);
        });

        it("twilio throws without authToken", () => {
            expect.assertions(1);

            expect(() => twilioProvider({ accountSid: "AC1" } as never)).toThrow(RequiredOptionError);
        });

        it("vonage throws without apiKey", () => {
            expect.assertions(1);

            expect(() => vonageProvider({ apiSecret: "s" } as never)).toThrow(RequiredOptionError);
        });

        it("vonage throws without apiSecret", () => {
            expect.assertions(1);

            expect(() => vonageProvider({ apiKey: "k" } as never)).toThrow(RequiredOptionError);
        });

        it("plivo throws without authId", () => {
            expect.assertions(1);

            expect(() => plivoProvider({ authToken: "tok" } as never)).toThrow(RequiredOptionError);
        });

        it("plivo throws without authToken", () => {
            expect.assertions(1);

            expect(() => plivoProvider({ authId: "id" } as never)).toThrow(RequiredOptionError);
        });

        it("messagebird throws without accessKey", () => {
            expect.assertions(1);

            expect(() => messageBirdProvider({} as never)).toThrow(RequiredOptionError);
        });

        it("telnyx throws without apiKey", () => {
            expect.assertions(1);

            expect(() => telnyxProvider({} as never)).toThrow(RequiredOptionError);
        });

        it("sns throws without accessKeyId and secretAccessKey", () => {
            expect.assertions(1);

            expect(() => snsProvider({} as never)).toThrow(RequiredOptionError);
        });
    });

    describe("multi-recipient aggregation", () => {
        it("twilio reports an overall failure when every recipient fails", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ error_message: "blocked" }, 400));

            const provider = twilioProvider({ accountSid: "AC1", authToken: "tok", from: "+15550000000", retries: 0 });
            const result = await provider.send({ text: "hi", to: ["+1", "+2"] });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("blocked");
        });

        it("plivo maps every recipient to a per-recipient uuid on a batch send", async () => {
            expect.assertions(3);

            fetchMock.mockResolvedValue(jsonResponse({ message_uuid: ["u1", "u2"] }, 202));

            const provider = plivoProvider({ authId: "id", authToken: "tok", from: "+15550000000" });
            const result = await provider.send({ text: "hi", to: ["+1", "+2"] });

            expect(result.success).toBe(true);

            const recipients = result.data?.recipients ?? [];

            expect(recipients).toHaveLength(2);
            expect(recipients[1]?.messageId).toBe("u2");
        });

        it("messagebird marks every recipient sent on a batch success", async () => {
            expect.assertions(3);

            fetchMock.mockResolvedValue(jsonResponse({ id: "mb-batch" }, 201));

            const provider = messageBirdProvider({ accessKey: "key", from: "App" });
            const result = await provider.send({ text: "hi", to: ["+1", "+2"] });

            expect(result.success).toBe(true);

            const recipients = result.data?.recipients ?? [];

            expect(recipients).toHaveLength(2);
            expect(recipients.every((entry) => entry.status === "sent")).toBe(true);
        });
    });

    describe("sns sigv4 signing", () => {
        it("signs the request with an AWS4-HMAC-SHA256 Authorization header", async () => {
            expect.assertions(4);

            fetchMock.mockResolvedValue(textResponse("<PublishResponse><PublishResult><MessageId>m-1</MessageId></PublishResult></PublishResponse>"));

            const provider = snsProvider({ accessKeyId: "AKIDEXAMPLE", region: "eu-west-1", secretAccessKey: "secret" });
            const result = await provider.send({ from: "Sender", text: "hi", to: "+1" });

            expect(result.success).toBe(true);

            const [url, init] = fetchMock.mock.calls[0];
            const authorization = String(init.headers.Authorization);

            expect(String(url)).toContain("sns.eu-west-1.amazonaws.com");
            expect(authorization).toMatch(SNS_AUTHORIZATION);
            expect(init.headers["x-amz-date"]).toMatch(SNS_AMZ_DATE);
        });
    });
});
