import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { infobipProvider } from "../../src/providers/infobip/index";
import type { InfobipEmailOptions } from "../../src/providers/infobip/types";
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

describe(infobipProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);

            expect(() => {
                infobipProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiKey", () => {
            expect.assertions(2);

            const provider = infobipProvider({ apiKey: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("infobip");
        });
    });

    describe("isAvailable", () => {
        it("should return true when request succeeds", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { statusCode: 200 },
                success: true,
            });

            const provider = infobipProvider({ apiKey: "test123" });

            await expect(provider.isAvailable!()).resolves.toBe(true);
        });

        it("should return false when request fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                error: new Error("network"),
                success: false,
            });

            const provider = infobipProvider({ apiKey: "test123" });

            await expect(provider.isAvailable!()).resolves.toBe(false);
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: {
                    body: { messages: [{ messageId: "test-message-id" }] },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = infobipProvider({ apiKey: "test123" });
            const emailOptions: InfobipEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });

        it("should send with cc/bcc/replyTo/template/tracking/notify/intermediate/sendAt/headers", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { messages: [{ messageId: "id-1" }] }, statusCode: 200 },
                success: true,
            });

            const provider = infobipProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                bcc: { email: "bcc@example.com" },
                cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                from: { email: "sender@example.com" },
                headers: { "X-Custom": "value" },
                html: "<h1>Hi</h1>",
                intermediateReport: true,
                notifyUrl: "https://notify.example.com",
                replyTo: { email: "reply@example.com" },
                sendAt: "2026-01-01T00:00:00Z",
                subject: "Test",
                templateId: 123,
                templateVariables: { name: "John" },
                text: "Hi",
                to: { email: "user@example.com" },
                trackingUrl: "https://track.example.com",
            } as any);

            expect(result.success).toBe(true);
        });

        it("should send with attachments (string/Buffer/raw)", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { messages: [] }, statusCode: 200 },
                success: true,
            });

            const provider = infobipProvider({ apiKey: "test123" });

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

            const provider = infobipProvider({ apiKey: "test123" });

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

            const provider = infobipProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                from: { email: "" },
                subject: "",
                to: { email: "" },
            } as any);

            expect(result.success).toBe(false);
        });

        it("should return error when request fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                error: new Error("Network error"),
                success: false,
            });

            const provider = infobipProvider({ apiKey: "test123" });

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

            const provider = infobipProvider({ apiKey: "test123" });

            const result = await provider.getEmail!("");

            expect(result.success).toBe(false);
        });

        it("should return email details on success", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "msg-1" }, statusCode: 200 },
                success: true,
            });

            const provider = infobipProvider({ apiKey: "test123" });

            const result = await provider.getEmail!("msg-1");

            expect(result.success).toBe(true);
        });

        it("should return error when request fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                error: new Error("Not found"),
                success: false,
            });

            const provider = infobipProvider({ apiKey: "test123" });

            const result = await provider.getEmail!("msg-1");

            expect(result.success).toBe(false);
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

            const provider = infobipProvider({ apiKey: "test123" });

            await expect(provider.validateCredentials!()).resolves.toBe(true);
        });
    });
});
