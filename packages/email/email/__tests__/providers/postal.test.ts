import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { postalProvider } from "../../src/providers/postal/index";
import type { PostalEmailOptions } from "../../src/providers/postal/types";
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

describe(postalProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if host is missing", () => {
            expect.assertions(1);

            expect(() => {
                postalProvider({ apiKey: "test123" } as any);
            }).toThrow(RequiredOptionError);
        });

        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);

            expect(() => {
                postalProvider({ host: "example.com" } as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with host and apiKey", () => {
            expect.assertions(2);

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("postal");
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: {
                    body: { message_id: 12_345 },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });
            const emailOptions: PostalEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });

        it("should send with cc/bcc/replyTo/tags/headers/template/text", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { message_id: 1 }, statusCode: 200 },
                success: true,
            });

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            const result = await provider.sendEmail({
                bcc: { email: "bcc@example.com" },
                cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                from: { email: "sender@example.com", name: "Sender" },
                headers: { "X-Custom": "value" },
                html: "<h1>Hi</h1>",
                replyTo: { email: "reply@example.com" },
                subject: "Test",
                tags: ["welcome", "promo"],
                templateId: "tmpl-1",
                templateVariables: { name: "John" },
                text: "Hi",
                to: { email: "user@example.com" },
            } as any);

            expect(result.success).toBe(true);
        });

        it("should send with attachments (string/Buffer/raw)", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { message_id: 2 }, statusCode: 200 },
                success: true,
            });

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            const result = await provider.sendEmail({
                attachments: [
                    { content: "abc", contentType: "text/plain", filename: "a.txt" },
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

        it("should fail attachment without content/raw", async () => {
            expect.assertions(1);

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

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

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            const result = await provider.sendEmail({
                from: { email: "" },
                subject: "",
                to: { email: "" },
            });

            expect(result.success).toBe(false);
        });

        it("should return error when request fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                error: new Error("Network error"),
                success: false,
            });

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

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

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

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

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            const result = await provider.getEmail?.("msg-1");

            expect(result?.success).toBe(true);
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

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });

    describe("branch coverage", () => {
        it("should send an attachment whose content is a Promise", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { message_id: 3 }, statusCode: 200 },
                success: true,
            });

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

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

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });

        it("should return an error when retrieving an email fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ error: new Error("not found"), success: false });

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            const result = await provider.getEmail?.("msg-x");

            expect(result?.success).toBe(false);
        });

        it("should return an error when getEmail initialization fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ error: new Error("unavailable"), success: false });

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            const result = await provider.getEmail?.("msg-x");

            expect(result?.success).toBe(false);
        });

        it("should return false from isAvailable when the request throws", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockRejectedValue(new Error("network down"));

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("should send a text-only email with logger, templateId without variables, a raw Buffer attachment, and a generated message id", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ data: { body: {}, statusCode: 200 }, success: true });

            const logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() } as unknown as Console;
            const provider = postalProvider({ apiKey: "test123", host: "example.com", logger });

            const result = await provider.sendEmail({
                attachments: [{ filename: "r.bin", raw: Buffer.from("rawbytes") }],
                from: { email: "sender@example.com" },
                subject: "Test",
                templateId: "tmpl-only",
                text: "plain text",
                to: { email: "user@example.com" },
            } as any);

            expect(result.success).toBe(true);
        });

        it("should report an unknown error when getEmail fails with a non-Error", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({ data: { statusCode: 200 }, success: true }).mockResolvedValueOnce({ error: "string failure", success: false });

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            const result = await provider.getEmail?.("msg-1");

            expect(result?.success).toBe(false);
        });

        it("should return a default error when send fails without an error", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({ data: { statusCode: 200 }, success: true }).mockResolvedValueOnce({ success: false });

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

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
