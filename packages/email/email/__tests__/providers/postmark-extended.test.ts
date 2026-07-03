import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { postmarkProvider } from "../../src/providers/postmark/index";
import type { PostmarkEmailOptions } from "../../src/providers/postmark/types";
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
    data: { body: { MessageID: "msg_123" }, statusCode: 200 },
    success: true,
};

const baseEmail: PostmarkEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Test</h1>",
    subject: "Test",
    to: { email: "user@example.com" },
};

const parsePayload = (): Record<string, unknown> => {
    const lastCall = makeRequestMock.mock.calls.at(-1);

    return JSON.parse(lastCall?.[2] as string) as Record<string, unknown>;
};

describe("postmark provider (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getEmail", () => {
        it("returns an error when no id is supplied", async () => {
            expect.assertions(2);

            const provider = postmarkProvider({ serverToken: "token123" });
            const result = await provider.getEmail?.("");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Email ID is required");
        });

        it("returns the email body on success", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ data: { body: { MessageID: "msg_123", Status: "Sent" } }, success: true });

            const provider = postmarkProvider({ serverToken: "token123" });
            const result = await provider.getEmail?.("msg_123");

            expect(result?.success).toBe(true);
            expect(result?.data).toStrictEqual({ MessageID: "msg_123", Status: "Sent" });
        });

        it("wraps an API failure into an EmailError", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ error: new Error("not found"), success: false });

            const provider = postmarkProvider({ serverToken: "token123" });
            const result = await provider.getEmail?.("msg_missing");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Failed to retrieve email");
        });

        it("catches thrown errors", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValueOnce({ data: { statusCode: 200 }, success: true }).mockRejectedValueOnce(new Error("network down"));

            const provider = postmarkProvider({ serverToken: "token123" });
            const result = await provider.getEmail?.("msg_123");

            expect(result?.success).toBe(false);
        });
    });

    describe("isAvailable", () => {
        it("returns false when the request throws", async () => {
            expect.assertions(1);

            makeRequestMock.mockRejectedValue(new Error("boom"));

            const provider = postmarkProvider({ serverToken: "token123" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe("initialize", () => {
        it("throws when the API is not available", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 401 }, success: false });

            const provider = postmarkProvider({ serverToken: "token123" });

            await expect(provider.initialize()).rejects.toThrow("Postmark API not available");
        });
    });

    describe("sendEmail payload", () => {
        beforeEach(() => {
            makeRequestMock.mockResolvedValue(okSend);
        });

        it("includes text, replyTo, inlineCss, messageStream and metadata", async () => {
            expect.assertions(5);

            const provider = postmarkProvider({ serverToken: "token123" });

            await provider.sendEmail({
                ...baseEmail,
                inlineCss: false,
                messageStream: "broadcast",
                metadata: { campaign: "spring" },
                replyTo: { email: "reply@example.com" },
                text: "plain body",
            });

            const payload = parsePayload();

            expect(payload.TextBody).toBe("plain body");
            expect(payload.ReplyTo).toBe("reply@example.com");
            expect(payload.InlineCss).toBe(false);
            expect(payload.MessageStream).toBe("broadcast");
            expect(payload.Metadata).toStrictEqual({ campaign: "spring" });
        });

        it("uses a template alias with its model", async () => {
            expect.assertions(2);

            const provider = postmarkProvider({ serverToken: "token123" });

            await provider.sendEmail({
                ...baseEmail,
                templateAlias: "welcome",
                templateModel: { name: "John" },
            });

            const payload = parsePayload();

            expect(payload.TemplateAlias).toBe("welcome");
            expect(payload.TemplateModel).toStrictEqual({ name: "John" });
        });

        it("uses only the first tag", async () => {
            expect.assertions(1);

            const provider = postmarkProvider({ serverToken: "token123" });

            await provider.sendEmail({ ...baseEmail, tags: ["primary", "secondary"] });

            expect(parsePayload().Tag).toBe("primary");
        });

        it("encodes attachments from string, promise, buffer and raw sources with cid", async () => {
            expect.assertions(5);

            const provider = postmarkProvider({ serverToken: "token123" });

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

            const attachments = parsePayload().Attachments as { Content: string; ContentID?: string }[];

            expect(attachments[0].Content).toBe("plain-text");
            expect(attachments[1].Content).toBe(Buffer.from([104, 105]).toString("base64"));
            expect(attachments[2].Content).toBe(Buffer.from("buffered").toString("base64"));
            expect(attachments[3].Content).toBe("raw-string");
            expect(attachments[4].ContentID).toBe("inline-1");
        });

        it("fails when an attachment has no content", async () => {
            expect.assertions(1);

            const provider = postmarkProvider({ serverToken: "token123" });

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

            const provider = postmarkProvider({ serverToken: "token123" });
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("validateCredentials", () => {
        it("delegates to isAvailable", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 200 }, success: true });

            const provider = postmarkProvider({ serverToken: "token123" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });
});
