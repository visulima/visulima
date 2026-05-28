import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { mailPaceProvider } from "../../src/providers/mailpace/index";
import type { MailPaceEmailOptions } from "../../src/providers/mailpace/types";
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

describe(mailPaceProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiToken is missing", () => {
            expect.assertions(1);

            expect(() => {
                mailPaceProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiToken", () => {
            expect.assertions(2);

            const provider = mailPaceProvider({ apiToken: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mailpace");
        });
    });

    describe("isAvailable", () => {
        it("should return true on 2xx response", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { statusCode: 200 },
                success: true,
            });

            const provider = mailPaceProvider({ apiToken: "test123" });

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("should return false on non-2xx response", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { statusCode: 401 },
                success: true,
            });

            const provider = mailPaceProvider({ apiToken: "test123" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("should return false on request failure", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                error: new Error("Network error"),
                success: false,
            });

            const provider = mailPaceProvider({ apiToken: "test123" });

            await expect(provider.isAvailable()).resolves.toBe(false);
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
                        body: { id: "test-message-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = mailPaceProvider({ apiToken: "test123" });
            const emailOptions: MailPaceEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });

        it("should send email with cc/bcc/replyTo/tags/headers/template/listUnsubscribe", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "id-1", statusCode: 200 }, statusCode: 200 },
                success: true,
            });

            const provider = mailPaceProvider({ apiToken: "test123" });

            const result = await provider.sendEmail({
                bcc: { email: "bcc@example.com" },
                cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                from: { email: "sender@example.com", name: "Sender" },
                headers: { "X-Custom": "value" },
                html: "<h1>Hi</h1>",
                listUnsubscribe: "<mailto:unsub@example.com>",
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

        it("should send email with attachments passed as-is", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "id-2" }, statusCode: 200 },
                success: true,
            });

            const provider = mailPaceProvider({ apiToken: "test123" });

            const result = await provider.sendEmail({
                attachments: [
                    { content: "abc", contentType: "text/plain", filename: "a.txt" } as any,
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should return validation error for invalid options", async () => {
            expect.assertions(1);

            const provider = mailPaceProvider({ apiToken: "test123" });

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

            const provider = mailPaceProvider({ apiToken: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

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

            const provider = mailPaceProvider({ apiToken: "test123" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });
});
