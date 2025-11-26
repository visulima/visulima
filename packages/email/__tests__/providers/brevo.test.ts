import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { brevoProvider } from "../../src/providers/brevo/index";
import type { BrevoEmailOptions } from "../../src/providers/brevo/types";
import { makeRequest } from "../../src/utils/make-request";

// Mock the makeRequest function
vi.mock(import("../../src/utils/make-request"), () => {
    return {
        makeRequest: vi.fn(),
    };
});

// Mock the retry function
vi.mock(import("../../src/utils/retry"), () => {
    return {
        default: vi.fn(async (function_) => await function_()),
    };
});

describe(brevoProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);
            expect(() => {
                brevoProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiKey", () => {
            expect.assertions(2);

            const provider = brevoProvider({ apiKey: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("brevo");
        });

        it("should use default endpoint if not provided", () => {
            expect.assertions(1);

            const provider = brevoProvider({ apiKey: "test123" });

            expect(provider.options?.endpoint).toBe("https://api.brevo.com/v3");
        });

        it("should use custom endpoint if provided", () => {
            expect.assertions(1);

            const provider = brevoProvider({
                apiKey: "test123",
                endpoint: "https://custom.endpoint.com/v3",
            });

            expect(provider.options?.endpoint).toBe("https://custom.endpoint.com/v3");
        });
    });

    describe("features", () => {
        it("should have correct feature flags", () => {
            expect.assertions(1);

            const provider = brevoProvider({ apiKey: "test123" });

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

            const provider = brevoProvider({ apiKey: "test123" });

            const isAvailable = await provider.isAvailable();

            expect(makeRequest).toHaveBeenCalledWith(`${provider.endpoint}/account`, {
                headers: {
                    "api-key": "test123",
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

            const provider = brevoProvider({ apiKey: "test123" });

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
                        body: { messageId: "test-message-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = brevoProvider({ apiKey: "test123" });
            const emailOptions: BrevoEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/smtp/email`,
                {
                    headers: {
                        "api-key": "test123",
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

            const provider = brevoProvider({ apiKey: "test123" });
            const emailOptions = {} as BrevoEmailOptions;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should format recipients correctly", async () => {
            expect.assertions(6);

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
                        body: { messageId: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = brevoProvider({ apiKey: "test123" });
            const emailOptions: BrevoEmailOptions = {
                from: { email: "sender@example.com", name: "Sender" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: [{ email: "user1@example.com", name: "User 1" }, { email: "user2@example.com" }],
            };

            await provider.sendEmail(emailOptions);

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/smtp/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "api-key": "test123",
                        "Content-Type": "application/json",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.sender.email).toBe("sender@example.com");
            expect(payload.sender.name).toBe("Sender");
            expect(payload.to).toHaveLength(2);
            expect(payload.to[0].email).toBe("user1@example.com");
            expect(payload.to[0].name).toBe("User 1");
        });

        it("should include CC and BCC recipients", async () => {
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
                        body: { messageId: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = brevoProvider({ apiKey: "test123" });
            const emailOptions: BrevoEmailOptions = {
                bcc: { email: "bcc@example.com" },
                cc: { email: "cc@example.com" },
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/smtp/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "api-key": "test123",
                        "Content-Type": "application/json",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.cc).toBeDefined();
            expect(payload.bcc).toBeDefined();
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
                        body: { messageId: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = brevoProvider({ apiKey: "test123" });

            const emailOptions: BrevoEmailOptions = {
                from: { email: "sender@example.com" },
                html: "dummy",
                subject: "Test",
                templateId: 12_345,
                templateParams: { name: "John" },
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);

            const { calls } = makeRequestMock.mock;
            // Find the sendEmail call (second call, index 1)
            const sendEmailCall = calls[1];

            expect(sendEmailCall).toBeDefined();
            expect(sendEmailCall?.[2]).toBeDefined();

            const payload = JSON.parse(sendEmailCall[2] as string);

            expect(payload.templateId).toBe(12_345);
            expect(payload.params).toStrictEqual({ name: "John" });
        });

        it("should include tags", async () => {
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
                        body: { messageId: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = brevoProvider({ apiKey: "test123" });
            const emailOptions: BrevoEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                tags: ["tag1", "tag2"],
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/smtp/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "api-key": "test123",
                        "Content-Type": "application/json",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.tags).toBeDefined();
            expect(payload.tags).toStrictEqual(["tag1", "tag2"]);
        });

        it("should include scheduled date/time", async () => {
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
                        body: { messageId: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = brevoProvider({ apiKey: "test123" });
            const scheduledAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
            const emailOptions: BrevoEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                scheduledAt,
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/smtp/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "api-key": "test123",
                        "Content-Type": "application/json",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.scheduledAt).toBeDefined();

            expectTypeOf(payload.scheduledAt).toBeString();
        });

        it("should include custom headers", async () => {
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
                        body: { messageId: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = brevoProvider({ apiKey: "test123" });
            const emailOptions: BrevoEmailOptions = {
                from: { email: "sender@example.com" },
                headers: { "X-Custom": "value" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/smtp/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "api-key": "test123",
                        "Content-Type": "application/json",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.headers).toBeDefined();
            expect(payload.headers["X-Custom"]).toBe("value");
        });

        it("should include attachments", async () => {
            expect.assertions(4);

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
                        body: { messageId: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = brevoProvider({ apiKey: "test123" });
            const emailOptions: BrevoEmailOptions = {
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

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/smtp/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "api-key": "test123",
                        "Content-Type": "application/json",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.attachment).toBeDefined();
            expect(payload.attachment).toHaveLength(1);
            expect(payload.attachment[0].name).toBe("test.pdf");
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

            const provider = brevoProvider({ apiKey: "test123" });
            const emailOptions: BrevoEmailOptions = {
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
