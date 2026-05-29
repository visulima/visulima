import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { ahaSendProvider } from "../../src/providers/ahasend/index";
import type { AhaSendEmailOptions } from "../../src/providers/ahasend/types";
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

describe(ahaSendProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);

            expect(() => {
                ahaSendProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiKey", () => {
            expect.assertions(2);

            const provider = ahaSendProvider({ apiKey: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("ahasend");
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: {
                    body: { messageId: "test-message-id" },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = ahaSendProvider({ apiKey: "test123" });
            const emailOptions: AhaSendEmailOptions = {
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
                data: { body: { messageId: "id-1" }, statusCode: 200 },
                success: true,
            });

            const provider = ahaSendProvider({ apiKey: "test123" });

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
            } as any);

            expect(result.success).toBe(true);
        });

        it("should send with attachments (string/Buffer/raw)", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { messageId: "id-2" }, statusCode: 200 },
                success: true,
            });

            const provider = ahaSendProvider({ apiKey: "test123" });

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

        it("should fail attachment without content/raw", async () => {
            expect.assertions(1);

            const provider = ahaSendProvider({ apiKey: "test123" });

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

            const provider = ahaSendProvider({ apiKey: "test123" });

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

            const provider = ahaSendProvider({ apiKey: "test123" });

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

            const provider = ahaSendProvider({ apiKey: "test123" });

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

            const provider = ahaSendProvider({ apiKey: "test123" });

            const result = await provider.getEmail?.("msg-1");

            expect(result?.success).toBe(true);
        });
    });

    describe("validateCredentials", () => {
        it("should return true", async () => {
            expect.assertions(1);

            const provider = ahaSendProvider({ apiKey: "test123" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });

    describe("branch coverage", () => {
        it("should send an attachment whose content is a Promise", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { messageId: "id-promise" }, statusCode: 200 },
                success: true,
            });

            const provider = ahaSendProvider({ apiKey: "test123" });

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

            const provider = ahaSendProvider({ apiKey: "test123" });

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

            const provider = ahaSendProvider({ apiKey: "test123" });

            const result = await provider.getEmail?.("msg-x");

            expect(result?.success).toBe(false);
        });

        it("should return an error when getEmail initialization fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ error: new Error("unavailable"), success: false });

            const provider = ahaSendProvider({ apiKey: "test123" });

            const result = await provider.getEmail?.("msg-x");

            expect(result?.success).toBe(false);
        });

        it("should return false from isAvailable on a 401 status code", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ data: { statusCode: 401 }, success: false });

            const provider = ahaSendProvider({ apiKey: "test123" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("should return false from isAvailable when the request throws", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockRejectedValue(new Error("network down"));

            const provider = ahaSendProvider({ apiKey: "test123" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("should send a text-only email with a logger, templateId, and raw Buffer attachment", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ data: { body: { messageId: "m-1" }, statusCode: 200 }, success: true });

            const logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() } as unknown as Console;
            const provider = ahaSendProvider({ apiKey: "test123", logger });

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

            const provider = ahaSendProvider({ apiKey: "test123" });

            const result = await provider.getEmail?.("msg-1");

            expect(result?.success).toBe(false);
        });

        it("should return a default error when send fails without an error", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({ data: { statusCode: 200 }, success: true }).mockResolvedValueOnce({ success: false });

            const provider = ahaSendProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });

        it("should use the response id when the messageId is absent", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ data: { body: { id: "resp-id" }, statusCode: 200 }, success: true });

            const provider = ahaSendProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("resp-id");
        });

        it("should generate a message id when the response body lacks one", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true });

            const provider = ahaSendProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });
    });
});
