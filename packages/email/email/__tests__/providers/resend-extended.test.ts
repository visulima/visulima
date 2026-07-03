import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { resendProvider } from "../../src/providers/resend/index";
import type { ResendEmailOptions } from "../../src/providers/resend/types";
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
    data: { body: { id: "em_123" }, headers: {}, statusCode: 200 },
    success: true,
};

const baseEmail: ResendEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Test</h1>",
    subject: "Test",
    to: { email: "user@example.com" },
};

const parsePayload = (): Record<string, unknown> => {
    const lastCall = makeRequestMock.mock.calls.at(-1);

    return JSON.parse(lastCall?.[2] as string) as Record<string, unknown>;
};

describe("resend provider (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getEmail", () => {
        it("returns an error when no id is supplied", async () => {
            expect.assertions(2);

            const provider = resendProvider({ apiKey: "re_test" });
            const result = await provider.getEmail?.("");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Email ID is required");
        });

        it("returns the email body on success", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ data: { body: { id: "em_123", subject: "Hi" } }, success: true });

            const provider = resendProvider({ apiKey: "re_test" });
            const result = await provider.getEmail?.("em_123");

            expect(result?.success).toBe(true);
            expect(result?.data).toStrictEqual({ id: "em_123", subject: "Hi" });
        });

        it("wraps an API failure into an EmailError", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ error: new Error("not found"), success: false });

            const provider = resendProvider({ apiKey: "re_test" });
            const result = await provider.getEmail?.("em_missing");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Failed to retrieve email");
        });

        it("catches thrown errors", async () => {
            expect.assertions(1);

            makeRequestMock.mockRejectedValue(new Error("network down"));

            const provider = resendProvider({ apiKey: "re_test" });
            const result = await provider.getEmail?.("em_123");

            expect(result?.success).toBe(false);
        });
    });

    describe("isAvailable", () => {
        it("treats a restricted API key response as available", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { body: { name: "restricted_api_key" } }, success: true });

            const provider = resendProvider({ apiKey: "custom_key" });

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("returns false when the request throws", async () => {
            expect.assertions(1);

            makeRequestMock.mockRejectedValue(new Error("boom"));

            const provider = resendProvider({ apiKey: "custom_key" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe("initialize", () => {
        it("throws when the API is not available", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 401 }, success: false });

            const provider = resendProvider({ apiKey: "custom_key" });

            await expect(provider.initialize()).rejects.toThrow("Resend API not available");
        });
    });

    describe("sendEmail payload", () => {
        beforeEach(() => {
            makeRequestMock.mockResolvedValue(okSend);
        });

        it("includes cc, bcc and reply_to when provided", async () => {
            expect.assertions(3);

            const provider = resendProvider({ apiKey: "re_test" });

            await provider.sendEmail({
                ...baseEmail,
                bcc: { email: "bcc@example.com" },
                cc: [{ email: "cc@example.com" }],
                replyTo: { email: "reply@example.com" },
            });

            const payload = parsePayload();

            expect(payload.cc).toStrictEqual(["cc@example.com"]);
            expect(payload.bcc).toStrictEqual(["bcc@example.com"]);
            expect(payload.reply_to).toBe("reply@example.com");
        });

        it("serializes a Date scheduledAt to ISO and passes strings through", async () => {
            expect.assertions(2);

            const provider = resendProvider({ apiKey: "re_test" });
            const when = new Date("2030-01-01T00:00:00.000Z");

            await provider.sendEmail({ ...baseEmail, scheduledAt: when });

            expect(parsePayload().scheduled_at).toBe(when.toISOString());

            await provider.sendEmail({ ...baseEmail, scheduledAt: "2030-02-02T00:00:00Z" });

            expect(parsePayload().scheduled_at).toBe("2030-02-02T00:00:00Z");
        });

        it("encodes attachments from string, promise, buffer, raw and path sources", async () => {
            expect.assertions(5);

            const provider = resendProvider({ apiKey: "re_test" });

            await provider.sendEmail({
                ...baseEmail,
                attachments: [
                    { content: "plain-text", filename: "a.txt" },
                    { content: Promise.resolve(new Uint8Array([104, 105])), filename: "b.bin" },
                    { content: Buffer.from("buffered"), filename: "c.bin" },
                    { filename: "d.txt", raw: "raw-string" },
                    { filename: "e.bin", path: "uploads/e.bin", raw: Buffer.from("raw-buffer") },
                ],
            });

            const attachments = parsePayload().attachments as { content: string; filename: string; path?: string }[];

            expect(attachments[0].content).toBe("plain-text");
            expect(attachments[1].content).toBe(Buffer.from([104, 105]).toString("base64"));
            expect(attachments[2].content).toBe(Buffer.from("buffered").toString("base64"));
            expect(attachments[3].content).toBe("raw-string");
            expect(attachments[4].path).toBe("uploads/e.bin");
        });

        it("fails when an attachment has no content", async () => {
            expect.assertions(1);

            const provider = resendProvider({ apiKey: "re_test" });

            const result = await provider.sendEmail({
                ...baseEmail,
                attachments: [{ filename: "empty.txt" }],
            });

            expect(result.success).toBe(false);
        });

        it("rejects tags whose value contains invalid characters", async () => {
            expect.assertions(2);

            const provider = resendProvider({ apiKey: "re_test" });

            const result = await provider.sendEmail({
                ...baseEmail,
                tags: [{ name: "ok", value: "not ok!" }],
            });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Invalid email tags");
        });

        it("rejects tag names that exceed the maximum length", async () => {
            expect.assertions(1);

            const provider = resendProvider({ apiKey: "re_test" });

            const result = await provider.sendEmail({
                ...baseEmail,
                tags: [{ name: "a".repeat(257), value: "ok" }],
            });

            expect(result.success).toBe(false);
        });
    });

    describe("validateCredentials", () => {
        it("delegates to isAvailable", async () => {
            expect.assertions(1);

            const provider = resendProvider({ apiKey: "re_test" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });
});
