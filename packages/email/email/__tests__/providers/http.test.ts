import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { httpProvider } from "../../src/providers/http/index";
import type { HttpEmailOptions } from "../../src/providers/http/types";
import { makeRequest } from "../../src/utils/make-request";

vi.mock(import("../../src/utils/make-request"), () => {
    return {
        makeRequest: vi.fn(),
    };
});

describe(httpProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if endpoint is missing", () => {
            expect.assertions(1);

            expect(() => {
                httpProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with endpoint", () => {
            expect.assertions(2);

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("http");
        });

        it("should use defaults for method and headers", () => {
            expect.assertions(2);

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            expect(provider.options?.method).toBe("POST");
            expect(provider.options?.headers).toStrictEqual({});
        });
    });

    describe("features", () => {
        it("should declare features", () => {
            expect.assertions(1);

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            expect(provider.features).toStrictEqual({
                attachments: false,
                batchSending: false,
                customHeaders: true,
                html: true,
                replyTo: false,
                scheduling: false,
                tagging: false,
                templates: false,
                tracking: false,
            });
        });
    });

    describe("isAvailable", () => {
        it("should return true when OPTIONS succeeds", async () => {
            expect.assertions(1);

            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                data: { statusCode: 200 },
                success: true,
            });

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("should return false on 401", async () => {
            expect.assertions(1);

            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                data: { statusCode: 401 },
                success: false,
            });

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("should return false on other failure", async () => {
            expect.assertions(1);

            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                data: { statusCode: 500 },
                success: false,
            });

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("should return false on thrown error", async () => {
            expect.assertions(1);

            (makeRequest as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network 401"));

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe("validateCredentials", () => {
        it("should return true on 200 response", async () => {
            expect.assertions(1);

            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                data: { statusCode: 200 },
                success: true,
            });

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            await expect(provider.validateCredentials!()).resolves.toBe(true);
        });

        it("should return false when statusCode is not 2xx", async () => {
            expect.assertions(1);

            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                data: { statusCode: 500 },
                success: true,
            });

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            await expect(provider.validateCredentials!()).resolves.toBe(false);
        });

        it("should return false on thrown error", async () => {
            expect.assertions(1);

            (makeRequest as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            await expect(provider.validateCredentials!()).resolves.toBe(false);
        });
    });

    describe("sendEmail", () => {
        it("should validate options before sending", async () => {
            expect.assertions(2);

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            const result = await provider.sendEmail({
                from: { email: "" },
                subject: "",
                to: { email: "" },
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Invalid email options");
        });

        it("should send email successfully", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            // initialize OPTIONS call
            makeRequestMock.mockResolvedValueOnce({
                data: { statusCode: 200 },
                success: true,
            });
            // actual send call
            makeRequestMock.mockResolvedValueOnce({
                data: { body: { id: "msg-1" }, statusCode: 200 },
                success: true,
            });

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            const options: HttpEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                text: "Hi",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(options);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("msg-1");
        });

        it("should handle apiKey, cc, bcc, custom params, headers, endpointOverride, methodOverride", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { statusCode: 200 },
                success: true,
            });
            makeRequestMock.mockResolvedValueOnce({
                data: { body: { messageId: "msg-2" }, statusCode: 200 },
                success: true,
            });

            const provider = httpProvider({
                apiKey: "secret",
                endpoint: "https://api.example.com",
                headers: { "X-Default": "1" },
            });

            const result = await provider.sendEmail({
                bcc: [{ email: "b1@example.com" }, { email: "b2@example.com" }],
                cc: { email: "cc@example.com" },
                customParams: { tracking: true },
                endpointOverride: "https://other.example.com",
                from: { email: "sender@example.com" },
                headers: { "X-Custom": "val" },
                html: "<h1>Hi</h1>",
                methodOverride: "PUT",
                subject: "Test",
                to: [{ email: "u@example.com" }],
            });

            expect(result.success).toBe(true);
            const lastCall = makeRequestMock.mock.calls.at(-1)!;

            expect(lastCall[0]).toBe("https://other.example.com");
        });

        it("should extract messageId from response.body.data", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { statusCode: 200 },
                success: true,
            });
            makeRequestMock.mockResolvedValueOnce({
                data: { body: { data: { id: "deep-id" } }, statusCode: 200 },
                success: true,
            });

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("deep-id");
        });

        it("should generate a messageId when none is returned", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { statusCode: 200 },
                success: true,
            });
            makeRequestMock.mockResolvedValueOnce({
                data: { body: {}, statusCode: 200 },
                success: true,
            });

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });

        it("should return error when API send fails", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { statusCode: 200 },
                success: true,
            });
            makeRequestMock.mockResolvedValueOnce({
                error: new Error("Server error"),
                success: false,
            });

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Failed to send email");
        });

        it("should fail initialize when API not available", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { statusCode: 500 },
                success: false,
            });

            const provider = httpProvider({ endpoint: "https://api.example.com" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
