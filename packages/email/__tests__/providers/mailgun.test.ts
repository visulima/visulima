import { beforeEach, describe, expect, it, vi } from "vitest";

import { mailgunProvider } from "../../src/providers/mailgun/index.js";
import type { MailgunEmailOptions } from "../../src/providers/mailgun/types.js";
import { makeRequest } from "../../src/utils/make-request.js";
import { retry } from "../../src/utils/retry.js";

// Mock the makeRequest function
vi.mock(import("../../src/utils/make-request.js"), () => {
    return {
        makeRequest: vi.fn((url, options, data) =>
        // Return a mock result that matches the expected structure
            Promise.resolve({
                data: {
                    body: { id: "test-message-id" },
                    statusCode: 200,
                },
                success: true,
            }),
        ),
    };
});

// Mock the retry function
vi.mock(import("../../src/utils/retry.js"), () => {
    return {
        retry: vi.fn(async (function_) => await function_()),
    };
});

describe(mailgunProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect(() => {
                mailgunProvider({ domain: "example.com" } as any);
            }).toThrow();
        });

        it("should throw error if domain is missing", () => {
            expect(() => {
                mailgunProvider({ apiKey: "test123" } as any);
            }).toThrow();
        });

        it("should create provider with apiKey and domain", () => {
            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mailgun");
        });

        it("should use default endpoint if not provided", () => {
            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });

            expect(provider.options?.endpoint).toBe("https://api.mailgun.net");
        });

        it("should use custom endpoint if provided", () => {
            const provider = mailgunProvider({
                apiKey: "test123",
                domain: "example.com",
                endpoint: "https://api.eu.mailgun.net",
            });

            expect(provider.options?.endpoint).toBe("https://api.eu.mailgun.net");
        });
    });

    describe("features", () => {
        it("should have correct feature flags", () => {
            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });

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
        it("should check API availability", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: {},
                    headers: {},
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });

            const isAvailable = await provider.isAvailable();

            expect(makeRequest as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(`${provider.endpoint}/v3/domains/example.com`, {
                headers: {
                    Authorization: "Basic YXBpOnRlc3QxMjM=",
                    "Content-Type": "application/json",
                },
                method: "GET",
                timeout: 30_000,
            });
            expect(isAvailable).toBe(true);
        });

        it("should return false if API is unavailable", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                error: new Error("API Error"),
                success: false,
            });

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });

            const isAvailable = await provider.isAvailable();

            expect(isAvailable).toBe(false);
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: { id: "test-message-id", message: "Queued. Thank you." },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });
            const emailOptions: MailgunEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
            expect(makeRequest as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
                `${provider.endpoint}/v3/example.com/messages`,
                {
                    headers: {
                        Authorization: "Basic YXBpOnRlc3QxMjM=",
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    method: "POST",
                    timeout: 30_000,
                },
                expect.any(String),
            ); // Form data
        });

        it("should validate email options", async () => {
            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });
            const emailOptions = {} as MailgunEmailOptions;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should format recipients correctly", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: { id: "test-id", message: "Queued" },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });
            const emailOptions: MailgunEmailOptions = {
                from: { email: "sender@example.com", name: "Sender" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: [{ email: "user1@example.com", name: "User 1" }, { email: "user2@example.com" }],
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const body = callArgs[2] as string;

            expect(body).toContain("from=Sender%20%3Csender%40example.com%3E");
            expect(body).toContain("to=User%201%20%3Cuser1%40example.com%3E%2Cuser2%40example.com");
        });

        it("should include CC and BCC recipients", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: { id: "test-id", message: "Queued" },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });
            const emailOptions: MailgunEmailOptions = {
                bcc: { email: "bcc@example.com" },
                cc: { email: "cc@example.com" },
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const body = callArgs[2] as string;

            expect(body).toContain("cc=cc%40example.com");
            expect(body).toContain("bcc=bcc%40example.com");
        });

        it("should include template if provided", async () => {
            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: {
                    body: { id: "test-id", message: "Queued" },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });

            await provider.initialize();

            const emailOptions: MailgunEmailOptions = {
                from: { email: "sender@example.com" },
                html: "dummy",
                subject: "Test",
                template: "welcome-template",
                templateVariables: { name: "John" },
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
                const body = callWithPayload[2] as string;

                expect(body).toContain("template=welcome-template");
                expect(body).toContain("v%3Aname=John");
            }
        });

        it("should include tags", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: { id: "test-id", message: "Queued" },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });
            const emailOptions: MailgunEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                tags: ["tag1", "tag2"],
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const body = callArgs[2] as string;

            expect(body).toContain("o%3Atag=tag1");
            expect(body).toContain("o%3Atag=tag2");
        });

        it("should include tracking options", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: { id: "test-id", message: "Queued" },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });
            const emailOptions: MailgunEmailOptions = {
                clickTracking: true,
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                openTracking: false,
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const body = callArgs[2] as string;

            expect(body).toContain("o%3Aclicktracking=yes");
            expect(body).toContain("o%3Atracking=no");
        });

        it("should include custom headers", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    body: { id: "test-id", message: "Queued" },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });
            const emailOptions: MailgunEmailOptions = {
                from: { email: "sender@example.com" },
                headers: { "X-Custom": "value" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = (makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
            const body = callArgs[2] as string;

            expect(body).toContain("h%3AX-Custom=value");
        });

        it("should handle errors gracefully", async () => {
            (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                error: new Error("API Error"),
                success: false,
            });

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });
            const emailOptions: MailgunEmailOptions = {
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
