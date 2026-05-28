import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { azureProvider } from "../../src/providers/azure/index";
import type { AzureEmailOptions } from "../../src/providers/azure/types";
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

describe(azureProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if region is missing", () => {
            expect.assertions(1);

            expect(() => {
                azureProvider({ accessToken: "test123" } as any);
            }).toThrow(RequiredOptionError);
        });

        it("should throw error if both connectionString and accessToken are missing", () => {
            expect.assertions(1);

            expect(() => {
                azureProvider({ region: "eastus" });
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with accessToken and region", () => {
            expect.assertions(2);

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("azure");
        });

        it("should create provider with connectionString and region", () => {
            expect.assertions(2);

            const provider = azureProvider({ connectionString: "endpoint=test;accesskey=key123", region: "eastus" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("azure");
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: {
                    body: { id: "msg-1" },
                    statusCode: 202,
                },
                success: true,
            });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });
            const emailOptions: AzureEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });

        it("should send with cc/bcc/replyTo/importance/headers/text", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "id-1" }, statusCode: 202 },
                success: true,
            });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            const result = await provider.sendEmail({
                bcc: { email: "bcc@example.com" },
                cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                from: { email: "sender@example.com", name: "Sender" },
                headers: { "X-Custom": "value" },
                html: "<h1>Hi</h1>",
                importance: "high",
                replyTo: { email: "reply@example.com" },
                subject: "Test",
                text: "Hi",
                to: { email: "user@example.com" },
            } as any);

            expect(result.success).toBe(true);
        });

        it("should send with attachments (string/Buffer/raw)", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "id-2" }, statusCode: 202 },
                success: true,
            });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            const result = await provider.sendEmail({
                attachments: [
                    { content: "abc", contentType: "text/plain", filename: "a.txt" },
                    { content: Buffer.from("hi"), filename: "b.bin" },
                    { filename: "c.txt", raw: "rawcontent" },
                    { filename: "d.bin", raw: Buffer.from("hi2") },
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

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            const result = await provider.sendEmail({
                attachments: [{ filename: "empty.txt" }],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });

        it("should send using connectionString credentials", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "id-3" }, statusCode: 202 },
                success: true,
            });

            const provider = azureProvider({ connectionString: "endpoint=test;accesskey=key123", region: "eastus" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should return error with malformed connectionString", async () => {
            expect.assertions(1);

            const provider = azureProvider({ connectionString: "malformed", region: "eastus" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });

        it("should return validation error for invalid options", async () => {
            expect.assertions(1);

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

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

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

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

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

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

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            const result = await provider.getEmail!("msg-1");

            expect(result.success).toBe(true);
        });
    });

    describe("validateCredentials", () => {
        it("should delegate to isAvailable", async () => {
            expect.assertions(1);

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            const result = await provider.validateCredentials!();

            expect(typeof result).toBe("boolean");
        });
    });
});
