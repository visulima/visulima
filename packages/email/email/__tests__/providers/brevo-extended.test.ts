import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { brevoProvider } from "../../src/providers/brevo/index";
import type { BrevoEmailOptions } from "../../src/providers/brevo/types";
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
    data: { body: { messageId: "msg_123" }, statusCode: 200 },
    success: true,
};

const baseEmail: BrevoEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Test</h1>",
    subject: "Test",
    to: { email: "user@example.com" },
};

const parsePayload = (): Record<string, unknown> => {
    const lastCall = makeRequestMock.mock.calls.at(-1);

    return JSON.parse(lastCall?.[2] as string) as Record<string, unknown>;
};

describe("brevo provider (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getEmail", () => {
        it("returns an error when no id is supplied", async () => {
            expect.assertions(2);

            const provider = brevoProvider({ apiKey: "test123" });
            const result = await provider.getEmail?.("");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Email ID is required");
        });

        it("returns the email body on success", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ data: { body: { id: "msg_123", subject: "Hi" } }, success: true });

            const provider = brevoProvider({ apiKey: "test123" });
            const result = await provider.getEmail?.("msg_123");

            expect(result?.success).toBe(true);
            expect(result?.data).toStrictEqual({ id: "msg_123", subject: "Hi" });
        });

        it("wraps an API failure into an EmailError", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ error: new Error("not found"), success: false });

            const provider = brevoProvider({ apiKey: "test123" });
            const result = await provider.getEmail?.("msg_missing");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Failed to retrieve email");
        });

        it("catches thrown errors", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValueOnce({ data: { statusCode: 200 }, success: true }).mockRejectedValueOnce(new Error("network down"));

            const provider = brevoProvider({ apiKey: "test123" });
            const result = await provider.getEmail?.("msg_123");

            expect(result?.success).toBe(false);
        });
    });

    describe("isAvailable", () => {
        it("returns false when the request throws", async () => {
            expect.assertions(1);

            makeRequestMock.mockRejectedValue(new Error("boom"));

            const provider = brevoProvider({ apiKey: "test123" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe("initialize", () => {
        it("throws when the API is not available", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 401 }, success: false });

            const provider = brevoProvider({ apiKey: "test123" });

            await expect(provider.initialize()).rejects.toThrow("Brevo API not available");
        });
    });

    describe("sendEmail payload", () => {
        beforeEach(() => {
            makeRequestMock.mockResolvedValue(okSend);
        });

        it("includes textContent when text is provided", async () => {
            expect.assertions(1);

            const provider = brevoProvider({ apiKey: "test123" });

            await provider.sendEmail({ ...baseEmail, text: "plain body" });

            expect(parsePayload().textContent).toBe("plain body");
        });

        it("uses the first address from a replyTo array when hardValidation is off", async () => {
            expect.assertions(1);

            const provider = brevoProvider({ apiKey: "test123" });

            await provider.sendEmail({
                ...baseEmail,
                replyTo: [{ email: "first@example.com" }, { email: "second@example.com" }],
            });

            expect(parsePayload().replyTo).toStrictEqual({ email: "first@example.com" });
        });

        it("accepts a single replyTo address", async () => {
            expect.assertions(1);

            const provider = brevoProvider({ apiKey: "test123" });

            await provider.sendEmail({ ...baseEmail, replyTo: { email: "reply@example.com" } });

            expect(parsePayload().replyTo).toStrictEqual({ email: "reply@example.com" });
        });

        it("rejects a replyTo array when hardValidation is enabled", async () => {
            expect.assertions(2);

            const provider = brevoProvider({ apiKey: "test123", hardValidation: true });

            const result = await provider.sendEmail({
                ...baseEmail,
                replyTo: [{ email: "first@example.com" }],
            });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Only one replyTo address is allowed");
        });

        it("rejects an empty replyTo array", async () => {
            expect.assertions(2);

            const provider = brevoProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({ ...baseEmail, replyTo: [] });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("replyTo array cannot be empty");
        });

        it("rejects a replyTo array whose first entry is falsy", async () => {
            expect.assertions(2);

            const provider = brevoProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                ...baseEmail,
                replyTo: [undefined as unknown as BrevoEmailOptions["replyTo"]] as BrevoEmailOptions["replyTo"],
            });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("replyTo array cannot be empty");
        });

        it("includes batchId when provided", async () => {
            expect.assertions(1);

            const provider = brevoProvider({ apiKey: "test123" });

            await provider.sendEmail({ ...baseEmail, batchId: "batch_42" });

            expect(parsePayload().batchId).toBe("batch_42");
        });

        it("encodes attachments from string, promise, buffer and raw sources", async () => {
            expect.assertions(4);

            const provider = brevoProvider({ apiKey: "test123" });

            await provider.sendEmail({
                ...baseEmail,
                attachments: [
                    { content: "plain-text", filename: "a.txt" },
                    { content: Promise.resolve(new Uint8Array([104, 105])), filename: "b.bin" },
                    { content: Buffer.from("buffered"), filename: "c.bin" },
                    { filename: "d.txt", raw: "raw-string" },
                ],
            });

            const attachment = parsePayload().attachment as { content: string; name: string }[];

            expect(attachment[0].content).toBe("plain-text");
            expect(attachment[1].content).toBe(Buffer.from([104, 105]).toString("base64"));
            expect(attachment[2].content).toBe(Buffer.from("buffered").toString("base64"));
            expect(attachment[3].content).toBe("raw-string");
        });

        it("encodes a raw Buffer attachment to base64", async () => {
            expect.assertions(1);

            const provider = brevoProvider({ apiKey: "test123" });

            await provider.sendEmail({
                ...baseEmail,
                attachments: [{ filename: "e.bin", raw: Buffer.from("raw-buffer") }],
            });

            const attachment = parsePayload().attachment as { content: string }[];

            expect(attachment[0].content).toBe(Buffer.from("raw-buffer").toString("base64"));
        });

        it("fails when an attachment has no content", async () => {
            expect.assertions(1);

            const provider = brevoProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                ...baseEmail,
                attachments: [{ filename: "empty.txt" }],
            });

            expect(result.success).toBe(false);
        });
    });

    describe("validateCredentials", () => {
        it("delegates to isAvailable", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 200 }, success: true });

            const provider = brevoProvider({ apiKey: "test123" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });
});
