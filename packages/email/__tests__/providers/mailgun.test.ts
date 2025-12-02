import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { mailgunProvider } from "../../src/providers/mailgun/index";
import type { MailgunEmailOptions } from "../../src/providers/mailgun/types";
import { makeRequest } from "../../src/utils/make-request";

// Mock the makeRequest function
vi.mock(import("../../src/utils/make-request"), () => {
    return {
        makeRequest: vi.fn((_url, _options, _data) =>
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
vi.mock(import("../../src/utils/retry"), () => {
    return {
        default: vi.fn(async (function_) => await function_()),
    };
});

describe(mailgunProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);
            expect(() => {
                mailgunProvider({ domain: "example.com" } as any);
            }).toThrow(RequiredOptionError);
        });

        it("should throw error if domain is missing", () => {
            expect.assertions(1);
            expect(() => {
                mailgunProvider({ apiKey: "test123" } as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiKey and domain", () => {
            expect.assertions(2);

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mailgun");
        });

        it("should use default endpoint if not provided", () => {
            expect.assertions(1);

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });

            expect(provider.options?.endpoint).toBe("https://api.mailgun.net");
        });

        it("should use custom endpoint if provided", () => {
            expect.assertions(1);

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
            expect.assertions(1);

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });

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
        it("should check API availability", async () => {
            expect.assertions(2);

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
            expect.assertions(1);

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
            expect.assertions(3);

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
            expect(makeRequestMock).toHaveBeenCalledWith(
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
            expect.assertions(2);

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });
            const emailOptions = {} as MailgunEmailOptions;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should format recipients correctly", async () => {
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

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const body = callArgs[2] as string;

            expect(body).toContain("from=Sender%20%3Csender%40example.com%3E");
            expect(body).toContain("to=User%201%20%3Cuser1%40example.com%3E%2Cuser2%40example.com");
        });

        it("should include CC and BCC recipients", async () => {
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

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const body = callArgs[2] as string;

            expect(body).toContain("cc=cc%40example.com");
            expect(body).toContain("bcc=bcc%40example.com");
        });

        it("should include template if provided", async () => {
            expect.assertions(5);

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
                        body: { id: "test-id", message: "Queued" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = mailgunProvider({ apiKey: "test123", domain: "example.com" });

            const emailOptions: MailgunEmailOptions = {
                from: { email: "sender@example.com" },
                html: "dummy",
                subject: "Test",
                template: "welcome-template",
                templateVariables: { name: "John" },
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);

            const sendEmailCall = makeRequestMock.mock.calls[1]; // Second call is sendEmail

            expect(sendEmailCall).toBeDefined();
            expect(sendEmailCall?.[2]).toBeDefined();

            const body = sendEmailCall[2] as string;

            expect(body).toContain("template=welcome-template");
            expect(body).toContain("v%3Aname=John");
        });

        it("should include tags", async () => {
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

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const body = callArgs[2] as string;

            expect(body).toContain("o%3Atag=tag1");
            expect(body).toContain("o%3Atag=tag2");
        });

        it("should include tracking options", async () => {
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

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const body = callArgs[2] as string;

            expect(body).toContain("o%3Aclicktracking=yes");
            expect(body).toContain("o%3Atracking=no");
        });

        it("should include custom headers", async () => {
            expect.assertions(1);

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

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const body = callArgs[2] as string;

            expect(body).toContain("h%3AX-Custom=value");
        });

        it("should handle errors gracefully", async () => {
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
