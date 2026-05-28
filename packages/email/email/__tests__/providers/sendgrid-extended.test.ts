import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendGridProvider } from "../../src/providers/sendgrid/index";
import type { SendGridEmailOptions } from "../../src/providers/sendgrid/types";
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

const baseEmail: SendGridEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Test</h1>",
    subject: "Test",
    to: { email: "user@example.com" },
};

const parsePayload = (): Record<string, unknown> => {
    const lastCall = makeRequestMock.mock.calls.at(-1);

    return JSON.parse(lastCall?.[2] as string) as Record<string, unknown>;
};

describe("sendgrid provider (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getEmail", () => {
        it("returns an error when no id is supplied", async () => {
            expect.assertions(2);

            const provider = sendGridProvider({ apiKey: "SG.test" });
            const result = await provider.getEmail?.("");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Email ID is required");
        });

        it("returns the email body on success", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ data: { body: { id: "msg_1", status: "delivered" } }, success: true });

            const provider = sendGridProvider({ apiKey: "SG.test" });
            const result = await provider.getEmail?.("msg_1");

            expect(result?.success).toBe(true);
            expect(result?.data).toStrictEqual({ id: "msg_1", status: "delivered" });
        });

        it("wraps an API failure into an EmailError", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ error: new Error("not found"), success: false });

            const provider = sendGridProvider({ apiKey: "SG.test" });
            const result = await provider.getEmail?.("msg_missing");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Failed to retrieve email");
        });

        it("catches thrown errors", async () => {
            expect.assertions(1);

            makeRequestMock.mockRejectedValue(new Error("network down"));

            const provider = sendGridProvider({ apiKey: "SG.test" });
            const result = await provider.getEmail?.("msg_1");

            expect(result?.success).toBe(false);
        });
    });

    describe("isAvailable", () => {
        it("returns false when the request throws for a non-standard key", async () => {
            expect.assertions(1);

            makeRequestMock.mockRejectedValue(new Error("boom"));

            const provider = sendGridProvider({ apiKey: "custom_key" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe("initialize", () => {
        it("throws when the API is not available", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 401 }, success: false });

            const provider = sendGridProvider({ apiKey: "custom_key" });

            await expect(provider.initialize()).rejects.toThrow("SendGrid API not available");
        });
    });

    describe("sendEmail payload", () => {
        beforeEach(() => {
            makeRequestMock.mockResolvedValue({ data: {}, success: true });
        });

        it("includes text content, replyTo, batchId and ipPoolName", async () => {
            expect.assertions(4);

            const provider = sendGridProvider({ apiKey: "SG.test" });

            await provider.sendEmail({
                ...baseEmail,
                batchId: "batch_1",
                ipPoolName: "pool-a",
                replyTo: { email: "reply@example.com" },
                text: "plain body",
            });

            const payload = parsePayload();
            const content = payload.content as { type: string; value: string }[];

            expect(content).toContainEqual({ type: "text/plain", value: "plain body" });
            expect(payload.reply_to).toStrictEqual({ email: "reply@example.com" });
            expect(payload.batch_id).toBe("batch_1");
            expect(payload.ip_pool_name).toBe("pool-a");
        });

        it("includes asm, mail and tracking settings", async () => {
            expect.assertions(3);

            const provider = sendGridProvider({ apiKey: "SG.test" });

            await provider.sendEmail({
                ...baseEmail,
                asmGroupId: 99,
                mailSettings: { sandboxMode: true },
                trackingSettings: { clickTracking: { enable: true } },
            });

            const payload = parsePayload();

            expect(payload.asm).toStrictEqual({ group_id: 99 });
            expect(payload.mail_settings).toStrictEqual({ sandboxMode: true });
            expect(payload.tracking_settings).toStrictEqual({ clickTracking: { enable: true } });
        });

        it("places sendAt and dynamic template data on the personalization", async () => {
            expect.assertions(3);

            const provider = sendGridProvider({ apiKey: "SG.test" });

            await provider.sendEmail({
                ...baseEmail,
                sendAt: 1_900_000_000,
                templateData: { name: "John" },
                templateId: "d-123",
            });

            const payload = parsePayload();
            const personalization = (payload.personalizations as Record<string, unknown>[])[0];

            expect(payload.template_id).toBe("d-123");
            expect(personalization.dynamicTemplateData).toStrictEqual({ name: "John" });
            expect(personalization.send_at).toBe(1_900_000_000);
        });

        it("encodes attachments from string, promise, buffer and raw sources with cid", async () => {
            expect.assertions(5);

            const provider = sendGridProvider({ apiKey: "SG.test" });

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

            const attachments = parsePayload().attachments as { content: string; content_id?: string }[];

            expect(attachments[0].content).toBe("plain-text");
            expect(attachments[1].content).toBe(Buffer.from([104, 105]).toString("base64"));
            expect(attachments[2].content).toBe(Buffer.from("buffered").toString("base64"));
            expect(attachments[3].content).toBe("raw-string");
            expect(attachments[4].content_id).toBe("inline-1");
        });

        it("fails when an attachment has no content", async () => {
            expect.assertions(1);

            const provider = sendGridProvider({ apiKey: "SG.test" });

            const result = await provider.sendEmail({
                ...baseEmail,
                attachments: [{ filename: "empty.txt" }],
            });

            expect(result.success).toBe(false);
        });

        it("returns failure when the send request is unsuccessful", async () => {
            expect.assertions(2);

            makeRequestMock.mockReset();
            makeRequestMock.mockResolvedValue({ error: new Error("rejected"), success: false });

            const provider = sendGridProvider({ apiKey: "SG.test" });
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("validateCredentials", () => {
        it("delegates to isAvailable", async () => {
            expect.assertions(1);

            const provider = sendGridProvider({ apiKey: "SG.test" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });
});
