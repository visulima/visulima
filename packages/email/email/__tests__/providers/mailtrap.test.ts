import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { mailtrapProvider } from "../../src/providers/mailtrap/index";
import type { MailtrapEmailOptions } from "../../src/providers/mailtrap/types";
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

describe(mailtrapProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiToken is missing", () => {
            expect.assertions(1);

            expect(() => {
                mailtrapProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiToken", () => {
            expect.assertions(2);

            const provider = mailtrapProvider({ apiToken: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mailtrap");
        });
    });

    describe("isAvailable", () => {
        it("should return true on 2xx status", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { statusCode: 200 },
                success: true,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("should return false on non-2xx status", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { statusCode: 401 },
                success: true,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("should return false when request fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                error: new Error("network"),
                success: false,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { message_ids: ["test-message-id"] }, statusCode: 200 },
                success: true,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });
            const emailOptions: MailtrapEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });

        it("should send email with cc/bcc/replyTo/tags/headers/template/category/customVariables", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { message_ids: ["id-1"] }, statusCode: 200 },
                success: true,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.sendEmail({
                bcc: { email: "bcc@example.com" },
                category: "newsletter",
                cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                customVariables: { user_id: "123" },
                from: { email: "sender@example.com", name: "Sender" },
                headers: { "X-Custom": "value" },
                html: "<h1>Hi</h1>",
                replyTo: { email: "reply@example.com" },
                subject: "Test",
                tags: ["welcome"],
                templateUuid: "tmpl-uuid",
                templateVariables: { name: "John" },
                text: "Hi",
                to: { email: "user@example.com" },
            } as any);

            expect(result.success).toBe(true);
        });

        it("should send email with attachments (string, Buffer, raw)", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: {}, statusCode: 200 },
                success: true,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.sendEmail({
                attachments: [
                    { cid: "cid-1", content: "abc", contentType: "text/plain", filename: "a.txt" },
                    { content: Buffer.from("hi"), filename: "b.bin" },
                    { filename: "c.txt", raw: "rawcontent" },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should fail attachment without content or raw", async () => {
            expect.assertions(1);

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.sendEmail({
                attachments: [{ filename: "empty.txt" }],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });

        it("should return validation error for invalid options", async () => {
            expect.assertions(1);

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.sendEmail({
                from: { email: "" },
                subject: "",
                to: { email: "" },
            });

            expect(result.success).toBe(false);
        });

        it("should return error if request fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                error: new Error("Network error"),
                success: false,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });
    });

    describe("getEmail", () => {
        it("should return error if id is empty", async () => {
            expect.assertions(1);

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.getEmail?.("");

            expect(result?.success).toBe(false);
        });

        it("should return email details on success", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "msg-1" }, statusCode: 200 },
                success: true,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.getEmail?.("msg-1");

            expect(result?.success).toBe(true);
        });

        it("should return error when request fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                error: new Error("not found"),
                success: false,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.getEmail?.("msg-1");

            expect(result?.success).toBe(false);
        });
    });

    describe("validateCredentials", () => {
        it("should delegate to isAvailable", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { statusCode: 200 },
                success: true,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });

    describe("branch coverage", () => {
        it("should send an attachment whose content is a Promise", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "p-1" }, statusCode: 200 },
                success: true,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.sendEmail({
                attachments: [{ content: Promise.resolve(new Uint8Array([104, 105])), filename: "p.bin" }],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should return an error when the send request fails after initialization", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ error: new Error("send failed"), success: false });

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });

        it("should return an error when retrieving an email fails after initialization", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ error: new Error("not found"), success: false });

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.getEmail?.("msg-x");

            expect(result?.success).toBe(false);
        });

        it("should return false from isAvailable when the request throws", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockRejectedValue(new Error("network down"));

            const provider = mailtrapProvider({ apiToken: "test123" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("should send a text-only email with logger, templateUuid without variables, and a raw Buffer attachment", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ data: { body: { message_ids: ["m-1"] }, statusCode: 200 }, success: true });

            const logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() } as unknown as Console;
            const provider = mailtrapProvider({ apiToken: "test123", logger });

            const result = await provider.sendEmail({
                attachments: [{ filename: "r.bin", raw: Buffer.from("rawbytes") }],
                from: { email: "sender@example.com" },
                subject: "Test",
                templateUuid: "tmpl-only",
                text: "plain text",
                to: { email: "user@example.com" },
            } as any);

            expect(result.success).toBe(true);
        });

        it("should report an unknown error when getEmail fails with a non-Error", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({ data: { statusCode: 200 }, success: true }).mockResolvedValueOnce({ error: "string failure", success: false });

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.getEmail?.("msg-1");

            expect(result?.success).toBe(false);
        });

        it("should return a default error when send fails without an error", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({ data: { statusCode: 200 }, success: true }).mockResolvedValueOnce({ success: false });

            const provider = mailtrapProvider({ apiToken: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });
    });
});
