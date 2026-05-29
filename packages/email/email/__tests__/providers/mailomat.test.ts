import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import EmailError from "../../src/errors/email-error";
import RequiredOptionError from "../../src/errors/required-option-error";
import { mailomatProvider } from "../../src/providers/mailomat/index";
import type { MailomatEmailOptions } from "../../src/providers/mailomat/types";
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

describe(mailomatProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);

            expect(() => {
                mailomatProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiKey", () => {
            expect.assertions(2);

            const provider = mailomatProvider({ apiKey: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mailomat");
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock
                .mockResolvedValueOnce({
                    data: {
                        body: {},
                        statusCode: 200,
                    },
                    success: true,
                })
                .mockResolvedValueOnce({
                    data: {
                        body: { messageId: "test-message-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = mailomatProvider({ apiKey: "test123" });
            const emailOptions: MailomatEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });

        it("should send email with cc, bcc, replyTo, tags, headers, template", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "id-1" }, statusCode: 200 },
                success: true,
            });

            const provider = mailomatProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                bcc: { email: "bcc@example.com" },
                cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                from: { email: "sender@example.com", name: "Sender" },
                headers: { "X-Custom": "value" },
                html: "<h1>Hi</h1>",
                replyTo: { email: "reply@example.com" },
                subject: "Test",
                tags: ["welcome"],
                templateId: "tmpl-1",
                templateVariables: { name: "John" },
                text: "Hi",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should send email with attachments (string, Buffer, raw)", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "id-2" }, statusCode: 200 },
                success: true,
            });

            const provider = mailomatProvider({ apiKey: "test123" });

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

            const provider = mailomatProvider({ apiKey: "test123" });

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

            const provider = mailomatProvider({ apiKey: "test123" });

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

            const provider = mailomatProvider({ apiKey: "test123" });

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

            const provider = mailomatProvider({ apiKey: "test123" });

            const result = await provider.getEmail?.("");

            expect(result?.success).toBe(false);
        });

        it("should return email details on success", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "msg-1", subject: "hi" }, statusCode: 200 },
                success: true,
            });

            const provider = mailomatProvider({ apiKey: "test123" });

            const result = await provider.getEmail?.("msg-1");

            expect(result?.success).toBe(true);
        });

        it("should return error when request fails with an Error", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ error: new Error("Not found"), success: false });

            const provider = mailomatProvider({ apiKey: "test123" });

            const result = await provider.getEmail?.("msg-1");

            expect(result?.success).toBe(false);
        });

        it("should report unknown error when request fails with a non-Error", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ error: "string failure", success: false });

            const provider = mailomatProvider({ apiKey: "test123" });

            const result = await provider.getEmail?.("msg-1");

            expect(result?.success).toBe(false);
        });

        it("should return an error when retrieving an email throws", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockRejectedValue(new Error("network down"));

            const provider = mailomatProvider({ apiKey: "test123" });

            const result = await provider.getEmail?.("msg-x");

            expect(result?.success).toBe(false);
        });
    });

    describe("validateCredentials", () => {
        it("should return true", async () => {
            expect.assertions(1);

            const provider = mailomatProvider({ apiKey: "test123" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });

    describe("branch coverage", () => {
        it("should fail initialize when the availability check errors", async () => {
            expect.assertions(1);

            const throwingConsole = {
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn((message: string) => {
                    if (message.includes("Checking Mailomat API availability")) {
                        throw new Error("logger boom");
                    }
                }),
                warn: vi.fn(),
            } as unknown as Console;

            const provider = mailomatProvider({ apiKey: "test123", logger: throwingConsole });

            await expect(provider.initialize()).rejects.toThrow(EmailError);
        });

        it("should send a text-only email without html", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ data: { body: { id: "t-1" }, statusCode: 200 }, success: true });

            const provider = mailomatProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "plain text",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should send with templateId but no templateVariables", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ data: { body: { id: "tv-1" }, statusCode: 200 }, success: true });

            const provider = mailomatProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                templateId: "tmpl-only",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should send an attachment whose content is a Promise", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ data: { body: { id: "p-1" }, statusCode: 200 }, success: true });

            const provider = mailomatProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                attachments: [{ content: Promise.resolve(new Uint8Array([104, 105])), filename: "p.bin" }],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should send an attachment with a raw Buffer", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ data: { body: { id: "rb-1" }, statusCode: 200 }, success: true });

            const provider = mailomatProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                attachments: [{ filename: "r.bin", raw: Buffer.from("rawbytes") }],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should return a default error when send fails without an error", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ success: false });

            const provider = mailomatProvider({ apiKey: "test123" });

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
