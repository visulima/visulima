import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { resendProvider } from "../../src/providers/resend/index";
import type { ResendEmailOptions } from "../../src/providers/resend/types";
import { makeRequest } from "../../src/utils/make-request";

// Mock the makeRequest and retry functions
vi.mock(import("../../src/utils/make-request"), () => {
    return {
        makeRequest: vi.fn(),
    };
});

vi.mock(import("../../src/utils/retry"), () => {
    return {
        default: vi.fn(async (function_) => await function_()),
    };
});

describe(resendProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);

            expect(() => {
                resendProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiKey", () => {
            expect.assertions(2);

            const provider = resendProvider({ apiKey: "re_test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("resend");
        });

        it("should use default endpoint if not provided", () => {
            expect.assertions(1);

            const provider = resendProvider({ apiKey: "re_test123" });

            expect(provider.options?.endpoint).toBe("https://api.resend.com");
        });

        it("should use custom endpoint if provided", () => {
            expect.assertions(1);

            const provider = resendProvider({
                apiKey: "re_test123",
                endpoint: "https://custom.endpoint.com",
            });

            expect(provider.options?.endpoint).toBe("https://custom.endpoint.com");
        });
    });

    describe("features", () => {
        it("should have correct feature flags", () => {
            expect.assertions(1);

            const provider = resendProvider({ apiKey: "re_test123" });

            expect(provider.features).toStrictEqual({
                attachments: true,
                batchSending: true,
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: true,
                tagging: true,
                templates: true,
                tracking: true,
            });
        });
    });

    describe("isAvailable", () => {
        it("should return true for valid API key format", async () => {
            expect.assertions(1);

            const provider = resendProvider({ apiKey: "re_test123" });

            const isAvailable = await provider.isAvailable();

            expect(isAvailable).toBe(true);
        });

        it("should check API availability for non-standard keys", async () => {
            expect.assertions(2);

            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: {},
                    headers: {},
                    statusCode: 200,
                },
                success: true,
            });

            const provider = resendProvider({ apiKey: "custom_key" });

            const isAvailable = await provider.isAvailable();

            expect(makeRequest as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(`${provider.endpoint}/domains`, {
                headers: {
                    Authorization: "Bearer custom_key",
                    "Content-Type": "application/json",
                },
                method: "GET",
                timeout: 30_000,
            });
            expect(isAvailable).toBe(true);
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            expect.assertions(3);

            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: { id: "test-message-id" },
                    headers: {},
                    statusCode: 200,
                },
                success: true,
            });

            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("test-message-id");
            expect(makeRequest as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
                `${provider.endpoint}/emails`,
                {
                    headers: {
                        Authorization: "Bearer re_test123",
                        "Content-Type": "application/json",
                    },
                    method: "POST",
                    timeout: 30_000,
                },
                expect.any(String),
            ); // JSON payload
        });

        it("should validate email options", async () => {
            expect.assertions(2);

            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions = {} as ResendEmailOptions;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should format recipients correctly", async () => {
            expect.assertions(2);

            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: { id: "test-id" },
                    headers: {},
                    statusCode: 200,
                },
                success: true,
            });

            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com", name: "Sender" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: [{ email: "user1@example.com", name: "User 1" }, { email: "user2@example.com" }],
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.from).toBe("Sender <sender@example.com>");
            expect(payload.to).toStrictEqual(["User 1 <user1@example.com>", "user2@example.com"]);
        });

        it("should include tags if provided", async () => {
            expect.assertions(1);

            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: { id: "test-id" },
                    headers: {},
                    statusCode: 200,
                },
                success: true,
            });

            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                tags: [
                    { name: "category", value: "newsletter" },
                    { name: "campaign", value: "summer2024" },
                ],
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.tags).toStrictEqual([
                { name: "category", value: "newsletter" },
                { name: "campaign", value: "summer2024" },
            ]);
        });

        it("should validate tag format", async () => {
            expect.assertions(2);

            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                tags: [{ name: "invalid tag!", value: "value" }],
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Invalid email tags");
        });

        it("should include template if provided", async () => {
            expect.assertions(6);

            // Mock makeRequest to handle sendEmail call
            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: {
                    body: { id: "test-id" },
                    headers: {},
                    statusCode: 200,
                },
                success: true,
            });

            const provider = resendProvider({ apiKey: "re_test123" });

            // Initialize provider first
            await provider.initialize();

            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com" },
                html: "dummy", // Dummy html to pass validation (templates don't require it but generic validation does)
                subject: "Test",
                templateData: { name: "John" },
                templateId: "template_123",
                to: { email: "user@example.com" },
            };

            // Get call count before sendEmail
            const callCountBefore = makeRequestMock.mock.calls.length;

            const result = await provider.sendEmail(emailOptions);

            // Verify email was sent successfully
            expect(result.success).toBe(true);

            // makeRequest should have been called (at least one more time for sendEmail)
            expect(makeRequestMock.mock.calls.length).toBeGreaterThan(callCountBefore);

            // Find the call that has a payload with "template" - this should be the sendEmail call
            const { calls } = makeRequestMock.mock;
            const callWithPayload = calls
                .slice(callCountBefore) // Only check calls made during sendEmail
                .find((call) => call.length > 2 && call[2] && typeof call[2] === "string" && (call[2] as string).includes("template"));

            expect(callWithPayload).toBeDefined();
            expect(callWithPayload?.[2]).toBeDefined();

            const payload = JSON.parse(callWithPayload[2] as string);

            expect(payload.template).toBe("template_123");
            expect(payload.data).toStrictEqual({ name: "John" });
        });

        it("should handle errors gracefully", async () => {
            expect.assertions(2);

            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                error: new Error("API Error"),
                success: false,
            });

            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
