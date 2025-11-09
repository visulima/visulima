import { beforeEach, describe, expect, it, vi } from "vitest";

import { mailjetProvider } from "../../src/providers/mailjet/index.js";
import type { MailjetEmailOptions } from "../../src/providers/mailjet/types.js";
import * as utils from "../../src/utils.js";

// Mock the utils module
vi.mock(import("../../src/utils.js"), async () => {
    const actual = await vi.importActual("../../src/utils.js");

    return {
        ...actual,
        makeRequest: vi.fn(),
        retry: vi.fn(async (function_) => await function_()),
    };
});

describe(mailjetProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect(() => {
                mailjetProvider({ apiSecret: "secret123" } as any);
            }).toThrow();
        });

        it("should throw error if apiSecret is missing", () => {
            expect(() => {
                mailjetProvider({ apiKey: "key123" } as any);
            }).toThrow();
        });

        it("should create provider with apiKey and apiSecret", () => {
            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mailjet");
        });

        it("should use default endpoint if not provided", () => {
            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });

            expect(provider.options?.endpoint).toBe("https://api.mailjet.com");
        });

        it("should use custom endpoint if provided", () => {
            const provider = mailjetProvider({
                apiKey: "key123",
                apiSecret: "secret123",
                endpoint: "https://custom.endpoint.com",
            });

            expect(provider.options?.endpoint).toBe("https://custom.endpoint.com");
        });
    });

    describe("features", () => {
        it("should have correct feature flags", () => {
            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });

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
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                data: {
                    body: {},
                    headers: {},
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });

            const isAvailable = await provider.isAvailable();

            expect(makeRequestSpy).toHaveBeenCalledWith();
            expect(isAvailable).toBe(true);
        });

        it("should return false if API is unavailable", async () => {
            (utils.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                error: new Error("API Error"),
                success: false,
            });

            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });

            const isAvailable = await provider.isAvailable();

            expect(isAvailable).toBe(false);
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                data: {
                    body: {
                        Messages: [
                            {
                                To: [{ MessageID: 12_345 }],
                            },
                        ],
                    },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });
            const emailOptions: MailjetEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
            expect(makeRequestSpy).toHaveBeenCalledWith();
        });

        it("should validate email options", async () => {
            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });
            const emailOptions = {} as MailjetEmailOptions;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should format recipients correctly", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                data: {
                    body: {
                        Messages: [
                            {
                                To: [{ MessageID: 12_345 }],
                            },
                        ],
                    },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });
            const emailOptions: MailjetEmailOptions = {
                from: { email: "sender@example.com", name: "Sender" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: [{ email: "user1@example.com", name: "User 1" }, { email: "user2@example.com" }],
            };

            await provider.sendEmail(emailOptions);

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Messages[0].From.Email).toBe("sender@example.com");
            expect(payload.Messages[0].From.Name).toBe("Sender");
            expect(payload.Messages[0].To).toHaveLength(2);
            expect(payload.Messages[0].To[0].Email).toBe("user1@example.com");
            expect(payload.Messages[0].To[0].Name).toBe("User 1");
        });

        it("should include CC and BCC recipients", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                data: {
                    body: {
                        Messages: [
                            {
                                To: [{ MessageID: 12_345 }],
                            },
                        ],
                    },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });
            const emailOptions: MailjetEmailOptions = {
                bcc: { email: "bcc@example.com" },
                cc: { email: "cc@example.com" },
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Messages[0].Cc).toBeDefined();
            expect(payload.Messages[0].Bcc).toBeDefined();
        });

        it("should include template if provided", async () => {
            const makeRequestMock = utils.makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: {
                    body: {
                        Messages: [
                            {
                                To: [{ MessageID: 12_345 }],
                            },
                        ],
                    },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });

            await provider.initialize();

            const emailOptions: MailjetEmailOptions = {
                from: { email: "sender@example.com" },
                html: "dummy",
                subject: "Test",
                templateId: 12_345,
                templateVariables: { name: "John" },
                to: { email: "user@example.com" },
            };

            const callCountBefore = makeRequestMock.mock.calls.length;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);

            const { calls } = makeRequestMock.mock;
            const callWithPayload = calls
                .slice(callCountBefore)
                .find((call) => call.length > 2 && call[2] && typeof call[2] === "string" && (call[2] as string).includes("TemplateID"));

            expect(callWithPayload).toBeDefined();

            if (callWithPayload && callWithPayload[2]) {
                const payload = JSON.parse(callWithPayload[2] as string);

                expect(payload.Messages[0].TemplateID).toBe(12_345);
                expect(payload.Messages[0].Variables).toEqual({ name: "John" });
            }
        });

        it("should include tags", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                data: {
                    body: {
                        Messages: [
                            {
                                To: [{ MessageID: 12_345 }],
                            },
                        ],
                    },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });
            const emailOptions: MailjetEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                tags: ["tag1", "tag2"],
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Messages[0].CustomCampaign).toBe("tag1,tag2");
        });

        it("should include custom headers", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                data: {
                    body: {
                        Messages: [
                            {
                                To: [{ MessageID: 12_345 }],
                            },
                        ],
                    },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });
            const emailOptions: MailjetEmailOptions = {
                from: { email: "sender@example.com" },
                headers: { "X-Custom": "value" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Messages[0].Headers).toBeDefined();
            expect(Array.isArray(payload.Messages[0].Headers)).toBe(true);
            expect(payload.Messages[0].Headers[0].Name).toBe("X-Custom");
            expect(payload.Messages[0].Headers[0].Value).toBe("value");
        });

        it("should include attachments", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                data: {
                    body: {
                        Messages: [
                            {
                                To: [{ MessageID: 12_345 }],
                            },
                        ],
                    },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });
            const emailOptions: MailjetEmailOptions = {
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

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Messages[0].Attachments).toBeDefined();
            expect(payload.Messages[0].Attachments).toHaveLength(1);
            expect(payload.Messages[0].Attachments[0].Filename).toBe("test.pdf");
        });

        it("should handle errors gracefully", async () => {
            (utils.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                error: new Error("API Error"),
                success: false,
            });

            const provider = mailjetProvider({ apiKey: "key123", apiSecret: "secret123" });
            const emailOptions: MailjetEmailOptions = {
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
