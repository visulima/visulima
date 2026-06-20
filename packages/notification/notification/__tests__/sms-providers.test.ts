import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messageBirdProvider } from "../src/providers/sms/messagebird";
import { plivoProvider } from "../src/providers/sms/plivo";
import { telnyxProvider } from "../src/providers/sms/telnyx";
import { twilioProvider } from "../src/providers/sms/twilio";
import { vonageProvider } from "../src/providers/sms/vonage";

const jsonResponse = (body: unknown, status = 200): Response => Response.json(body, { headers: { "Content-Type": "application/json" }, status });

describe("sms providers", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("twilio posts form-encoded body and returns the sid", async () => {
        expect.assertions(4);

        fetchMock.mockResolvedValue(jsonResponse({ sid: "SM123" }, 201));

        const provider = twilioProvider({ accountSid: "AC1", authToken: "tok", from: "+15550000000" });
        const result = await provider.send({ text: "hi", to: "+15555550100" });

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBe("SM123");

        const [url, init] = fetchMock.mock.calls[0];

        expect(String(url)).toContain("/Accounts/AC1/Messages.json");
        expect(String(init.body)).toContain("Body=hi");
    });

    it("twilio fails when no sender is configured", async () => {
        expect.assertions(1);

        const provider = twilioProvider({ accountSid: "AC1", authToken: "tok" });
        const result = await provider.send({ text: "hi", to: "+1" });

        expect(result.success).toBe(false);
    });

    it("vonage treats non-zero status as failure", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(jsonResponse({ messages: [{ "error-text": "bad", status: "2" }] }));

        const provider = vonageProvider({ apiKey: "k", apiSecret: "s", from: "App" });
        const result = await provider.send({ text: "hi", to: "+1" });

        expect(result.success).toBe(false);
        expect((result.error as Error).message).toContain("bad");
    });

    it("plivo joins recipients and returns the first uuid", async () => {
        expect.assertions(3);

        fetchMock.mockResolvedValue(jsonResponse({ message_uuid: ["u1", "u2"] }, 202));

        const provider = plivoProvider({ authId: "id", authToken: "tok", from: "+15550000000" });
        const result = await provider.send({ text: "hi", to: ["+1", "+2"] });

        expect(result.success).toBe(true);
        expect(result.data?.recipients).toHaveLength(2);

        const [, init] = fetchMock.mock.calls[0];

        expect(String(init.body)).toContain("+1<+2");
    });

    it("messagebird sends a batch in one request", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(jsonResponse({ id: "mb1" }, 201));

        const provider = messageBirdProvider({ accessKey: "key", from: "App" });
        const result = await provider.send({ text: "hi", to: ["+1", "+2"] });

        expect(result.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("telnyx returns the data id", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(jsonResponse({ data: { id: "tx1" } }, 200));

        const provider = telnyxProvider({ apiKey: "key", from: "+15550000000" });
        const result = await provider.send({ text: "hi", to: "+1" });

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBe("tx1");
    });

    it("retries a transient 503 then succeeds", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValueOnce(jsonResponse({ errors: [{ detail: "unavailable" }] }, 503));
        fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: "tx-retry" } }, 200));

        const provider = telnyxProvider({ apiKey: "key", from: "+15550000000", retries: 1 });
        const result = await provider.send({ text: "hi", to: "+1" });

        expect(result.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
