import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import EmailError from "../../src/errors/email-error";
import RequiredOptionError from "../../src/errors/required-option-error";
import { zeptomailProvider } from "../../src/providers/zeptomail/index";
import type { ZeptomailEmailOptions } from "../../src/providers/zeptomail/types";
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

describe(zeptomailProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if token is missing", () => {
            expect.assertions(1);

            expect(() => {
                zeptomailProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should throw error if token has wrong format", () => {
            expect.assertions(1);

            expect(() => {
                zeptomailProvider({ token: "wrong-format" });
            }).toThrow(EmailError);
        });

        it("should create provider with valid token", () => {
            expect.assertions(2);

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("zeptomail");
        });

        it("should use default endpoint", () => {
            expect.assertions(1);

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            expect(provider.options?.endpoint).toBe("https://api.zeptomail.com/v1.1");
        });

        it("should use custom endpoint", () => {
            expect.assertions(1);

            const provider = zeptomailProvider({
                endpoint: "https://custom.zeptomail.com",
                token: "Zoho-enczapikey TEST",
            });

            expect(provider.options?.endpoint).toBe("https://custom.zeptomail.com");
        });
    });

    describe("features", () => {
        it("should have correct feature flags", () => {
            expect.assertions(1);

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            expect(provider.features).toStrictEqual({
                attachments: true,
                batchSending: false,
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: false,
                tagging: false,
                templates: false,
                tracking: true,
            });
        });
    });

    describe("isAvailable / validateCredentials", () => {
        it("should return true with valid token", async () => {
            expect.assertions(1);

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("should return true via validateCredentials", async () => {
            expect.assertions(1);

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully (single to)", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { request_id: "req-1" }, statusCode: 200 },
                success: true,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("req-1");
        });

        it("should handle to/cc/bcc arrays of length 1", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { request_id: "req-2" }, statusCode: 200 },
                success: true,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                bcc: [{ email: "bcc@example.com" }],
                cc: [{ email: "cc@example.com" }],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "hi",
                to: [{ email: "user@example.com" }],
            });

            expect(result.success).toBe(true);
        });

        it("should handle to/cc/bcc arrays of length > 1", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { request_id: "req-3" }, statusCode: 200 },
                success: true,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                bcc: [{ email: "bcc1@example.com" }, { email: "bcc2@example.com" }],
                cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
            });

            expect(result.success).toBe(true);
        });

        it("should handle replyTo, tracking, clientReference, mimeHeaders, headers", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { request_id: "req-4" }, statusCode: 200 },
                success: true,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                bcc: { email: "bcc@example.com" },
                cc: { email: "cc@example.com" },
                clientReference: "ref-123",
                from: { email: "sender@example.com" },
                headers: { "X-Custom": "value" },
                html: "<h1>Hi</h1>",
                mimeHeaders: { "X-MIME": "mime-value" },
                replyTo: { email: "reply@example.com" },
                subject: "Test",
                text: "hi",
                to: { email: "user@example.com" },
                trackClicks: true,
                trackOpens: false,
            } as ZeptomailEmailOptions);

            expect(result.success).toBe(true);
        });

        it("should handle attachments with content and file_cache_key", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { request_id: "req-5" }, statusCode: 200 },
                success: true,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                attachments: [
                    {
                        content: "hello",
                        contentType: "text/plain",
                        filename: "a.txt",
                    },
                    {
                        content: Buffer.from("hi"),
                        filename: "b.bin",
                    },
                    {
                        filename: "c.pdf",
                        path: "cache-key-xyz",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should generate messageId if not in response", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: {}, statusCode: 200 },
                success: true,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });

        it("should return validation error for invalid options", async () => {
            expect.assertions(2);

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                from: { email: "" },
                subject: "",
                to: { email: "" },
            });

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Invalid email options");
        });

        it("should return error if request fails", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                error: new Error("Network error"),
                success: false,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should include API error details from response body", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { error: { message: "Invalid token" } }, statusCode: 401 },
                error: new Error("HTTP 401"),
                success: false,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Invalid token");
        });

        it("should include API error details from response body message field", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { message: "Quota exceeded" }, statusCode: 400 },
                error: new Error("HTTP 400"),
                success: false,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Quota exceeded");
        });

        it("should return an error when the request throws", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockRejectedValue(new Error("network down"));

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });
    });

    describe("branch coverage", () => {
        it("should use a generic message when the send error is not an Error", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                error: "string failure",
                success: false,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Unknown error");
        });

        it("should ignore an empty headers object", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { request_id: "id" }, statusCode: 200 },
                success: true,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                headers: {},
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should handle an attachment without content or path", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { request_id: "id" }, statusCode: 200 },
                success: true,
            });

            const provider = zeptomailProvider({ token: "Zoho-enczapikey TEST" });

            const result = await provider.sendEmail({
                attachments: [{ filename: "empty.txt" }],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });
    });
});
