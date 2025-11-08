import { describe, expect, it, vi, beforeEach } from "vitest";
import { resendProvider } from "../../src/providers/resend/index.js";
import * as utils from "../../src/utils.js";
import type { ResendEmailOptions } from "../../src/providers/resend/types.js";

// Mock the utils module
vi.mock("../../src/utils.js", async () => {
    const actual = await vi.importActual("../../src/utils.js");
    return {
        ...actual,
        makeRequest: vi.fn(),
        retry: vi.fn((fn) => fn()),
    };
});

describe("resendProvider", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect(() => {
                resendProvider({} as any);
            }).toThrow();
        });

        it("should create provider with apiKey", () => {
            const provider = resendProvider({ apiKey: "re_test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("resend");
        });

        it("should use default endpoint if not provided", () => {
            const provider = resendProvider({ apiKey: "re_test123" });

            expect(provider.options?.endpoint).toBe("https://api.resend.com");
        });

        it("should use custom endpoint if provided", () => {
            const provider = resendProvider({
                apiKey: "re_test123",
                endpoint: "https://custom.endpoint.com",
            });

            expect(provider.options?.endpoint).toBe("https://custom.endpoint.com");
        });
    });

    describe("features", () => {
        it("should have correct feature flags", () => {
            const provider = resendProvider({ apiKey: "re_test123" });

            expect(provider.features).toEqual({
                attachments: true,
                html: true,
                templates: true,
                tracking: true,
                customHeaders: true,
                batchSending: true,
                scheduling: true,
                replyTo: true,
                tagging: true,
            });
        });
    });

    describe("isAvailable", () => {
        it("should return true for valid API key format", async () => {
            const provider = resendProvider({ apiKey: "re_test123" });

            const isAvailable = await provider.isAvailable();

            expect(isAvailable).toBe(true);
        });

        it("should check API availability for non-standard keys", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                success: true,
                data: {
                    statusCode: 200,
                    headers: {},
                    body: {},
                },
            });

            const provider = resendProvider({ apiKey: "custom_key" });

            const isAvailable = await provider.isAvailable();

            expect(makeRequestSpy).toHaveBeenCalled();
            expect(isAvailable).toBe(true);
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                success: true,
                data: {
                    statusCode: 200,
                    headers: {},
                    body: { id: "test-message-id" },
                },
            });

            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com" },
                to: { email: "user@example.com" },
                subject: "Test",
                html: "<h1>Test</h1>",
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("test-message-id");
            expect(makeRequestSpy).toHaveBeenCalled();
        });

        it("should validate email options", async () => {
            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions = {} as ResendEmailOptions;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should format recipients correctly", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                success: true,
                data: {
                    statusCode: 200,
                    headers: {},
                    body: { id: "test-id" },
                },
            });

            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com", name: "Sender" },
                to: [
                    { email: "user1@example.com", name: "User 1" },
                    { email: "user2@example.com" },
                ],
                subject: "Test",
                html: "<h1>Test</h1>",
            };

            await provider.sendEmail(emailOptions);

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.from).toBe("Sender <sender@example.com>");
            expect(payload.to).toEqual(["User 1 <user1@example.com>", "user2@example.com"]);
        });

        it("should include tags if provided", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                success: true,
                data: {
                    statusCode: 200,
                    headers: {},
                    body: { id: "test-id" },
                },
            });

            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com" },
                to: { email: "user@example.com" },
                subject: "Test",
                html: "<h1>Test</h1>",
                tags: [
                    { name: "category", value: "newsletter" },
                    { name: "campaign", value: "summer2024" },
                ],
            };

            await provider.sendEmail(emailOptions);

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.tags).toEqual([
                { name: "category", value: "newsletter" },
                { name: "campaign", value: "summer2024" },
            ]);
        });

        it("should validate tag format", async () => {
            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com" },
                to: { email: "user@example.com" },
                subject: "Test",
                html: "<h1>Test</h1>",
                tags: [{ name: "invalid tag!", value: "value" }],
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Invalid tag");
        });

        it("should include template if provided", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                success: true,
                data: {
                    statusCode: 200,
                    headers: {},
                    body: { id: "test-id" },
                },
            });

            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com" },
                to: { email: "user@example.com" },
                subject: "Test",
                templateId: "template_123",
                templateData: { name: "John" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.template).toBe("template_123");
            expect(payload.data).toEqual({ name: "John" });
        });

        it("should handle errors gracefully", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                success: false,
                error: new Error("API Error"),
            });

            const provider = resendProvider({ apiKey: "re_test123" });
            const emailOptions: ResendEmailOptions = {
                from: { email: "sender@example.com" },
                to: { email: "user@example.com" },
                subject: "Test",
                html: "<h1>Test</h1>",
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
