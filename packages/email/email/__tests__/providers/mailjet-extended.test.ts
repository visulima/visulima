import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mailjetProvider } from "../../src/providers/mailjet/index";
import type { MailjetEmailOptions } from "../../src/providers/mailjet/types";
import { makeRequest } from "../../src/utils/make-request";

vi.mock(import("../../src/utils/make-request"), () => {
    return {
        makeRequest: vi.fn(),
    };
});

vi.mock(import("../../src/utils/retry"), () => {
    return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        default: vi.fn(async (function_) => await function_()),
    };
});

const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

const okSend = {
    data: { body: { Messages: [{ To: [{ MessageID: 12_345 }] }] }, statusCode: 200 },
    success: true,
};

const baseEmail: MailjetEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Test</h1>",
    subject: "Test",
    to: { email: "user@example.com" },
};

const getMessage = (): Record<string, unknown> => {
    const lastCall = makeRequestMock.mock.calls.at(-1);
    const payload = JSON.parse(lastCall?.[2] as string) as { Messages: Record<string, unknown>[] };

    return payload.Messages[0];
};

describe("mailjet provider (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getEmail", () => {
        it("returns an error when no id is supplied", async () => {
            expect.assertions(2);

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });
            const result = await provider.getEmail?.("");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Email ID is required");
        });

        it("returns the email body on success", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ data: { body: { Count: 1 } }, success: true });

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });
            const result = await provider.getEmail?.("msg_123");

            expect(result?.success).toBe(true);
            expect(result?.data).toStrictEqual({ Count: 1 });
        });

        it("wraps an API failure into an EmailError", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ error: new Error("not found"), success: false });

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });
            const result = await provider.getEmail?.("msg_missing");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Failed to retrieve email");
        });

        it("catches thrown errors", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValueOnce({ data: { statusCode: 200 }, success: true }).mockRejectedValueOnce(new Error("network down"));

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });
            const result = await provider.getEmail?.("msg_123");

            expect(result?.success).toBe(false);
        });
    });

    describe("isAvailable", () => {
        it("returns false when the request throws", async () => {
            expect.assertions(1);

            makeRequestMock.mockRejectedValue(new Error("boom"));

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe("initialize", () => {
        it("throws when the API is not available", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 401 }, success: false });

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });

            await expect(provider.initialize()).rejects.toThrow("Mailjet API not available");
        });
    });

    describe("sendEmail payload", () => {
        beforeEach(() => {
            makeRequestMock.mockResolvedValue(okSend);
        });

        it("includes text, replyTo and the campaign-related fields", async () => {
            expect.assertions(7);

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });

            await provider.sendEmail({
                ...baseEmail,
                campaign: "promo",
                customId: "custom-1",
                deduplicateCampaign: false,
                eventPayload: "payload-data",
                replyTo: { email: "reply@example.com" },
                text: "plain body",
            });

            const message = getMessage();

            expect(message.TextPart).toBe("plain body");
            expect(message.ReplyTo).toStrictEqual({ Email: "reply@example.com" });
            expect(message.CustomID).toBe("custom-1");
            expect(message.EventPayload).toBe("payload-data");
            expect(message.Campaign).toBe("promo");
            expect(message.DeduplicateCampaign).toBe(false);
            expect(message.TextPart).toBeDefined();
        });

        it("serializes deliveryTime, priority and urlTags", async () => {
            expect.assertions(3);

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });
            const deliveryTime = Math.floor(Date.parse("2030-01-01T00:00:00.000Z") / 1000);

            await provider.sendEmail({
                ...baseEmail,
                deliveryTime,
                priority: 2,
                urlTags: { campaign: "spring" },
            });

            const message = getMessage();

            expect(message.Deliverytime).toBe("2030-01-01T00:00:00.000Z");
            expect(message.Priority).toBe(2);
            expect(message.URLTags).toStrictEqual({ campaign: "spring" });
        });

        it("sets the template language and variables", async () => {
            expect.assertions(3);

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });

            await provider.sendEmail({
                ...baseEmail,
                templateId: 777,
                templateLanguage: true,
                templateVariables: { name: "John" },
            });

            const message = getMessage();

            expect(message.TemplateID).toBe(777);
            expect(message.TemplateLanguage).toBe(true);
            expect(message.Variables).toStrictEqual({ name: "John" });
        });

        it("encodes attachments from string, promise, buffer and raw sources with cid", async () => {
            expect.assertions(5);

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });

            await provider.sendEmail({
                ...baseEmail,
                attachments: [
                    { content: "plain-text", filename: "a.txt" },
                    { content: Promise.resolve(new Uint8Array([104, 105])), filename: "b.bin" },
                    { content: Buffer.from("buffered"), filename: "c.bin" },
                    { filename: "d.txt", raw: "raw-string" },
                    { cid: "inline-1", filename: "e.bin", raw: Buffer.from("raw-buffer") },
                ],
            });

            const attachments = getMessage().Attachments as { Base64Content: string; ContentID?: string }[];

            expect(attachments[0].Base64Content).toBe("plain-text");
            expect(attachments[1].Base64Content).toBe(Buffer.from([104, 105]).toString("base64"));
            expect(attachments[2].Base64Content).toBe(Buffer.from("buffered").toString("base64"));
            expect(attachments[3].Base64Content).toBe("raw-string");
            expect(attachments[4].ContentID).toBe("inline-1");
        });

        it("fails when an attachment has no content", async () => {
            expect.assertions(1);

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });

            const result = await provider.sendEmail({
                ...baseEmail,
                attachments: [{ filename: "empty.txt" }],
            });

            expect(result.success).toBe(false);
        });

        it("returns failure when the send request is unsuccessful", async () => {
            expect.assertions(2);

            makeRequestMock.mockReset();
            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ error: new Error("rejected"), success: false });

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("validateCredentials", () => {
        it("delegates to isAvailable", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 200 }, success: true });

            const provider = mailjetProvider({ apiKey: "key", apiSecret: "secret" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });
});
