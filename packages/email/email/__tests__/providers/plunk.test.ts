import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { plunkProvider } from "../../src/providers/plunk/index";
import type { PlunkEmailOptions } from "../../src/providers/plunk/types";
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

describe(plunkProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);

            expect(() => {
                plunkProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiKey", () => {
            expect.assertions(2);

            const provider = plunkProvider({ apiKey: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("plunk");
        });

        it("should use default endpoint if not provided", () => {
            expect.assertions(1);

            const provider = plunkProvider({ apiKey: "test123" });

            expect(provider.options?.endpoint).toBe("https://api.useplunk.com/v1");
        });

        it("should use custom endpoint if provided", () => {
            expect.assertions(1);

            const provider = plunkProvider({
                apiKey: "test123",
                endpoint: "https://custom.endpoint.com",
            });

            expect(provider.options?.endpoint).toBe("https://custom.endpoint.com");
        });
    });

    describe("features", () => {
        it("should have correct feature flags", () => {
            expect.assertions(1);

            const provider = plunkProvider({ apiKey: "test123" });

            expect(provider.features).toStrictEqual({
                attachments: true,
                batchSending: false,
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: false,
                tagging: false,
                templates: true,
                tracking: true,
            });
        });
    });

    describe("isAvailable", () => {
        it("should return true with valid apiKey", async () => {
            expect.assertions(1);

            const provider = plunkProvider({ apiKey: "test123" });

            await expect(provider.isAvailable()).resolves.toBe(true);
        });
    });

    describe("validateCredentials", () => {
        it("should return true with valid apiKey", async () => {
            expect.assertions(1);

            const provider = plunkProvider({ apiKey: "test123" });

            await expect(provider.validateCredentials!()).resolves.toBe(true);
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: {
                    body: { id: "test-message-id" },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = plunkProvider({ apiKey: "test123" });
            const emailOptions: PlunkEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });

        it("should send email with text only", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { id: "id1" }, statusCode: 200 },
                success: true,
            });

            const provider = plunkProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com", name: "Sender" },
                subject: "Test",
                text: "plain text",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should send email with cc, bcc, replyTo, templateId, data, subscriber and subscriberId", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { messageId: "msg-id" }, statusCode: 200 },
                success: true,
            });

            const provider = plunkProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                bcc: { email: "bcc@example.com" },
                cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                data: { name: "John" },
                from: { email: "sender@example.com", name: "Sender" },
                headers: { "X-Custom": "value" },
                html: "<h1>Hi</h1>",
                replyTo: { email: "reply@example.com", name: "Reply" },
                subject: "Test",
                subscriber: "subscriber@example.com",
                subscriberId: "sub-123",
                templateId: "tmpl-456",
                text: "Hi",
                to: [{ email: "u1@example.com" }],
            });

            expect(result.success).toBe(true);
            expect(makeRequestMock).toHaveBeenCalledTimes(1);
        });

        it("should send email with attachments (string content)", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: {}, statusCode: 200 },
                success: true,
            });

            const provider = plunkProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                attachments: [
                    {
                        content: "hello",
                        contentType: "text/plain",
                        filename: "hello.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should send email with attachments (Buffer content)", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: {}, statusCode: 200 },
                success: true,
            });

            const provider = plunkProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                attachments: [
                    {
                        content: Buffer.from("hello"),
                        filename: "hello.bin",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should send email with attachments (raw)", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: {}, statusCode: 200 },
                success: true,
            });

            const provider = plunkProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                attachments: [
                    {
                        filename: "raw.txt",
                        raw: "rawcontent",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should fail with attachment without content or raw", async () => {
            expect.assertions(2);

            const provider = plunkProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                attachments: [
                    {
                        filename: "empty.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should return validation error for invalid options", async () => {
            expect.assertions(2);

            const provider = plunkProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                from: { email: "" },
                subject: "",
                to: { email: "" },
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Invalid email options");
        });

        it("should return error if makeRequest fails", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                error: new Error("Network error"),
                success: false,
            });

            const provider = plunkProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("getEmail", () => {
        it("should return error when id is empty", async () => {
            expect.assertions(2);

            const provider = plunkProvider({ apiKey: "test123" });

            const result = await (provider as any).getEmail("");

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Email ID is required");
        });

        it("should retrieve email by id", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { id: "abc", subject: "Test" }, statusCode: 200 },
                success: true,
            });

            const provider = plunkProvider({ apiKey: "test123" });

            const result = await (provider as any).getEmail("abc");

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it("should handle API failure when retrieving", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                error: new Error("not found"),
                success: false,
            });

            const provider = plunkProvider({ apiKey: "test123" });

            const result = await (provider as any).getEmail("abc");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
