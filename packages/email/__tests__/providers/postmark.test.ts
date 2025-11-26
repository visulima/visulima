import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { postmarkProvider } from "../../src/providers/postmark/index";
import type { PostmarkEmailOptions } from "../../src/providers/postmark/types";
import { makeRequest } from "../../src/utils/make-request";

// Mock retry and makeRequest for testing
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

describe(postmarkProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if serverToken is missing", () => {
            expect.assertions(1);

            expect(() => {
                postmarkProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with serverToken", () => {
            expect.assertions(2);

            const provider = postmarkProvider({ serverToken: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("postmark");
        });

        it("should use default endpoint if not provided", () => {
            expect.assertions(1);

            const provider = postmarkProvider({ serverToken: "test123" });

            expect(provider.options?.endpoint).toBe("https://api.postmarkapp.com");
        });

        it("should use custom endpoint if provided", () => {
            expect.assertions(1);

            const provider = postmarkProvider({
                endpoint: "https://custom.endpoint.com",
                serverToken: "test123",
            });

            expect(provider.options?.endpoint).toBe("https://custom.endpoint.com");
        });
    });

    describe("features", () => {
        it("should have correct feature flags", () => {
            expect.assertions(1);

            const provider = postmarkProvider({ serverToken: "test123" });

            expect(provider.features).toStrictEqual({
                attachments: true,
                batchSending: true,
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: false, // Postmark doesn't support scheduling
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

            const provider = postmarkProvider({ serverToken: "test123" });

            const isAvailable = await provider.isAvailable();

            expect(makeRequest).toHaveBeenCalledWith(`${provider.endpoint}/server`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-Postmark-Server-Token": "test123",
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

            const provider = postmarkProvider({ serverToken: "test123" });

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
                        body: { MessageID: "test-message-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = postmarkProvider({ serverToken: "test123" });
            const emailOptions: PostmarkEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
            expect(makeRequest as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
                `${provider.endpoint}/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": "test123",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );
        });

        it("should validate email options", async () => {
            expect.assertions(2);

            const provider = postmarkProvider({ serverToken: "test123" });
            const emailOptions = {} as PostmarkEmailOptions;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should format recipients correctly", async () => {
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
                        body: { MessageID: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = postmarkProvider({ serverToken: "test123" });
            const emailOptions: PostmarkEmailOptions = {
                from: { email: "sender@example.com", name: "Sender" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: [{ email: "user1@example.com", name: "User 1" }, { email: "user2@example.com" }],
            };

            await provider.sendEmail(emailOptions);

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": "test123",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.From).toBe("Sender <sender@example.com>");
            expect(payload.To).toBe("User 1 <user1@example.com>,user2@example.com");
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
                        body: { MessageID: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = postmarkProvider({ serverToken: "test123" });
            const emailOptions: PostmarkEmailOptions = {
                bcc: { email: "bcc@example.com" },
                cc: { email: "cc@example.com" },
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": "test123",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Cc).toBeDefined();
            expect(payload.Bcc).toBeDefined();
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
                        body: { MessageID: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = postmarkProvider({ serverToken: "test123" });

            const emailOptions: PostmarkEmailOptions = {
                from: { email: "sender@example.com" },
                html: "dummy",
                subject: "Test",
                templateId: 12_345,
                templateModel: { name: "John" },
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);

            const sendEmailCall = makeRequestMock.mock.calls[1]; // Second call is sendEmail

            expect(sendEmailCall).toBeDefined();
            expect(sendEmailCall?.[2]).toBeDefined();

            const payload = JSON.parse(sendEmailCall[2] as string);

            expect(payload.TemplateId).toBe(12_345);
            expect(payload.TemplateModel).toStrictEqual({ name: "John" });
        });

        it("should include template alias if provided", async () => {
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
                        body: { MessageID: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = postmarkProvider({ serverToken: "test123" });
            const emailOptions: PostmarkEmailOptions = {
                from: { email: "sender@example.com" },
                html: "dummy",
                subject: "Test",
                templateAlias: "welcome-template",
                templateModel: { name: "John" },
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": "test123",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.TemplateAlias).toBe("welcome-template");
            expect(payload.TemplateModel).toStrictEqual({ name: "John" });
        });

        it("should include tracking options", async () => {
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
                        body: { MessageID: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = postmarkProvider({ serverToken: "test123" });
            const emailOptions: PostmarkEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
                trackLinks: "HtmlAndText",
                trackOpens: true,
            };

            await provider.sendEmail(emailOptions);

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": "test123",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.TrackOpens).toBe(true);
            expect(payload.TrackLinks).toBe("HtmlAndText");
        });

        it("should include tag", async () => {
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
                        body: { MessageID: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = postmarkProvider({ serverToken: "test123" });
            const emailOptions: PostmarkEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                tags: ["tag1", "tag2"], // Postmark uses first tag only
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": "test123",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Tag).toBe("tag1"); // Only first tag
        });

        it("should include custom headers", async () => {
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
                        body: { MessageID: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = postmarkProvider({ serverToken: "test123" });
            const emailOptions: PostmarkEmailOptions = {
                from: { email: "sender@example.com" },
                headers: { "X-Custom": "value" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            expect(makeRequestMock).toHaveBeenCalledWith(
                `${provider.endpoint}/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": "test123",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Headers).toBeDefined();
            expect(Array.isArray(payload.Headers)).toBe(true);
            expect(payload.Headers[0].Name).toBe("X-Custom");
            expect(payload.Headers[0].Value).toBe("value");
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
                        body: { MessageID: "test-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = postmarkProvider({ serverToken: "test123" });
            const emailOptions: PostmarkEmailOptions = {
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
                `${provider.endpoint}/email`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": "test123",
                    }),
                    method: "POST",
                }),
                expect.any(String),
            );

            const callArgs = makeRequestMock.mock.calls[1]; // Second call is sendEmail
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Attachments).toBeDefined();
            expect(payload.Attachments).toHaveLength(1);
            expect(payload.Attachments[0].Name).toBe("test.pdf");
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

            const provider = postmarkProvider({ serverToken: "test123" });
            const emailOptions: PostmarkEmailOptions = {
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
