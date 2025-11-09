import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendGridProvider } from "../../src/providers/sendgrid/index.js";
import type { SendGridEmailOptions } from "../../src/providers/sendgrid/types.js";
import { makeRequest } from "../../src/utils/make-request.js";
import { retry } from "../../src/utils/retry.js";

// Mock the utils module
vi.mock(import("../../src/utils.js"), async () => {
    const actual = await vi.importActual("../../src/utils.js");

    return {
        ...actual,
        makeRequest: vi.fn(),
        retry: vi.fn(async (function_) => await function_()),
    };
});

describe(sendGridProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect(() => {
                sendGridProvider({} as any);
            }).toThrow();
        });

        it("should create provider with apiKey", () => {
            const provider = sendGridProvider({ apiKey: "SG.test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("sendgrid");
        });

        it("should use default endpoint if not provided", () => {
            const provider = sendGridProvider({ apiKey: "SG.test123" });

            expect(provider.options?.endpoint).toBe("https://api.sendgrid.com/v3");
        });

        it("should use custom endpoint if provided", () => {
            const provider = sendGridProvider({
                apiKey: "SG.test123",
                endpoint: "https://custom.endpoint.com/v3",
            });

            expect(provider.options?.endpoint).toBe("https://custom.endpoint.com/v3");
        });
    });

    describe("features", () => {
        it("should have correct feature flags", () => {
            const provider = sendGridProvider({ apiKey: "SG.test123" });

            expect(provider.features).toEqual({
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
            const provider = sendGridProvider({ apiKey: "SG.test123" });

            const isAvailable = await provider.isAvailable();

            expect(isAvailable).toBe(true);
        });

        it("should check API availability for non-standard keys", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: {},
                    headers: {},
                    statusCode: 200,
                },
                success: true,
            });

            const provider = sendGridProvider({ apiKey: "custom_key" });

            const isAvailable = await provider.isAvailable();

            expect(makeRequest as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(`${provider.endpoint}/user/profile`, {
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
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    headers: new Headers({ "X-Message-Id": "test-message-id" }),
                    statusCode: 202,
                },
                success: true,
            });

            const provider = sendGridProvider({ apiKey: "SG.test123" });
            const emailOptions: SendGridEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
            expect(makeRequest as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
                `${provider.endpoint}/mail/send`,
                {
                    headers: {
                        Authorization: "Bearer SG.test123",
                        "Content-Type": "application/json",
                    },
                    method: "POST",
                    timeout: 30_000,
                },
                expect.any(String),
            ); // JSON payload
        });

        it("should validate email options", async () => {
            const provider = sendGridProvider({ apiKey: "SG.test123" });
            const emailOptions = {} as SendGridEmailOptions;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should format recipients correctly", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    headers: new Headers({ "X-Message-Id": "test-id" }),
                    statusCode: 202,
                },
                success: true,
            });

            const provider = sendGridProvider({ apiKey: "SG.test123" });
            const emailOptions: SendGridEmailOptions = {
                from: { email: "sender@example.com", name: "Sender" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: [{ email: "user1@example.com", name: "User 1" }, { email: "user2@example.com" }],
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.from.email).toBe("sender@example.com");
            expect(payload.from.name).toBe("Sender");
            expect(payload.personalizations[0].to).toHaveLength(2);
            expect(payload.personalizations[0].to[0].email).toBe("user1@example.com");
            expect(payload.personalizations[0].to[0].name).toBe("User 1");
        });

        it("should include CC and BCC recipients", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    headers: new Headers({ "X-Message-Id": "test-id" }),
                    statusCode: 202,
                },
                success: true,
            });

            const provider = sendGridProvider({ apiKey: "SG.test123" });
            const emailOptions: SendGridEmailOptions = {
                bcc: { email: "bcc@example.com" },
                cc: { email: "cc@example.com" },
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.personalizations[0].cc).toBeDefined();
            expect(payload.personalizations[0].bcc).toBeDefined();
        });

        it("should include template if provided", async () => {
            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: {
                    headers: new Headers({ "X-Message-Id": "test-id" }),
                    statusCode: 202,
                },
                success: true,
            });

            const provider = sendGridProvider({ apiKey: "SG.test123" });

            await provider.initialize();

            const emailOptions: SendGridEmailOptions = {
                from: { email: "sender@example.com" },
                html: "dummy",
                subject: "Test",
                templateData: { name: "John" },
                templateId: "template_123",
                to: { email: "user@example.com" },
            };

            const callCountBefore = makeRequestMock.mock.calls.length;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);

            const { calls } = makeRequestMock.mock;
            const callWithPayload = calls
                .slice(callCountBefore)
                .find((call) => call.length > 2 && call[2] && typeof call[2] === "string" && (call[2] as string).includes("template"));

            expect(callWithPayload).toBeDefined();

            if (callWithPayload && callWithPayload[2]) {
                const payload = JSON.parse(callWithPayload[2] as string);

                expect(payload.template_id).toBe("template_123");
                expect(payload.personalizations[0].dynamicTemplateData).toEqual({ name: "John" });
            }
        });

        it("should include attachments", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    headers: new Headers({ "X-Message-Id": "test-id" }),
                    statusCode: 202,
                },
                success: true,
            });

            const provider = sendGridProvider({ apiKey: "SG.test123" });
            const emailOptions: SendGridEmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("test content"),
                        contentType: "application/pdf",
                        filename: "test.pdf",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.attachments).toBeDefined();
            expect(payload.attachments).toHaveLength(1);
            expect(payload.attachments[0].filename).toBe("test.pdf");
        });

        it("should include custom headers", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    headers: new Headers({ "X-Message-Id": "test-id" }),
                    statusCode: 202,
                },
                success: true,
            });

            const provider = sendGridProvider({ apiKey: "SG.test123" });
            const emailOptions: SendGridEmailOptions = {
                from: { email: "sender@example.com" },
                headers: { "X-Custom": "value" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.headers).toBeDefined();
            expect(payload.headers["X-Custom"]).toBe("value");
        });

        it("should include tags as customArgs", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    headers: new Headers({ "X-Message-Id": "test-id" }),
                    statusCode: 202,
                },
                success: true,
            });

            const provider = sendGridProvider({ apiKey: "SG.test123" });
            const emailOptions: SendGridEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                tags: ["tag1", "tag2"],
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.personalizations[0].customArgs).toBeDefined();
            expect(payload.personalizations[0].customArgs.tag_0).toBe("tag1");
            expect(payload.personalizations[0].customArgs.tag_1).toBe("tag2");
        });

        it("should handle errors gracefully", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                error: new Error("API Error"),
                success: false,
            });

            const provider = sendGridProvider({ apiKey: "SG.test123" });
            const emailOptions: SendGridEmailOptions = {
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
