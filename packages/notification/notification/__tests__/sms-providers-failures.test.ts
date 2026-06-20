import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messageBirdProvider } from "../src/providers/sms/messagebird";
import { twilioProvider } from "../src/providers/sms/twilio";

const jsonResponse = (body: unknown, status = 200): Response => Response.json(body, { headers: { "Content-Type": "application/json" }, status });

describe("sms provider failure branches", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("twilio surfaces the provider error message on a >=400 response", async () => {
        expect.assertions(3);

        fetchMock.mockResolvedValue(jsonResponse({ error_message: "The 'To' number is invalid", status: 400 }, 400));

        const provider = twilioProvider({ accountSid: "AC1", authToken: "tok", from: "+15550000000", retries: 0 });
        const result = await provider.send({ text: "hi", to: "+1" });

        expect(result.success).toBe(false);
        expect((result.error as Error).message).toContain("invalid");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("twilio aggregates a mixed multi-recipient send as an overall success", async () => {
        expect.assertions(5);

        fetchMock.mockResolvedValueOnce(jsonResponse({ sid: "SM-ok" }, 201));
        fetchMock.mockResolvedValueOnce(jsonResponse({ error_message: "blocked", status: 400 }, 400));

        const provider = twilioProvider({ accountSid: "AC1", authToken: "tok", from: "+15550000000", retries: 0 });
        const result = await provider.send({ text: "hi", to: ["+1", "+2"] });

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBe("SM-ok");

        const recipients = result.data?.recipients ?? [];

        expect(recipients).toHaveLength(2);
        expect(recipients.find((entry) => entry.id === "+1")?.status).toBe("sent");
        expect(recipients.find((entry) => entry.id === "+2")?.status).toBe("failed");
    });

    it("messagebird batch returns a failed result with the API error message", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(jsonResponse({ errors: [{ description: "request not allowed" }] }, 401));

        const provider = messageBirdProvider({ accessKey: "key", from: "App", retries: 0 });
        const result = await provider.send({ text: "hi", to: ["+1", "+2"] });

        expect(result.success).toBe(false);
        expect((result.error as Error).message).toContain("not allowed");
    });
});
