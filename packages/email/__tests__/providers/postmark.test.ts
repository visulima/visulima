import { beforeEach, describe, expect, it, vi } from "vitest";

import { postmarkProvider } from "../../src/providers/postmark/index.js";
import type { PostmarkEmailOptions } from "../../src/providers/postmark/types.js";
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

describe(postmarkProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if serverToken is missing", () => {
            expect(() => {
                postmarkProvider({} as any);
            }).toThrow();
        });

        it("should create provider with serverToken", () => {
            const provider = postmarkProvider({ serverToken: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("postmark");
        });

        it("should use default endpoint if not provided", () => {
            const provider = postmarkProvider({ serverToken: "test123" });

            expect(provider.options?.endpoint).toBe("https://api.postmarkapp.com");
        });

        it("should use custom endpoint if provided", () => {
            const provider = postmarkProvider({
                endpoint: "https://custom.endpoint.com",
                serverToken: "test123",
            });

            expect(provider.options?.endpoint).toBe("https://custom.endpoint.com");
        });
    });

    describe("features", () => {
        it("should have correct feature flags", () => {
            const provider = postmarkProvider({ serverToken: "test123" });

            expect(provider.features).toEqual({
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
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                data: {
                    body: {},
                    headers: {},
                    statusCode: 200,
                },
                success: true,
            });

            const provider = postmarkProvider({ serverToken: "test123" });

            const isAvailable = await provider.isAvailable();

            expect(makeRequestSpy).toHaveBeenCalledWith();
            expect(isAvailable).toBe(true);
        });

        it("should return false if API is unavailable", async () => {
            (utils.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
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
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
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
            expect(makeRequestSpy).toHaveBeenCalledWith();
        });

        it("should validate email options", async () => {
            const provider = postmarkProvider({ serverToken: "test123" });
            const emailOptions = {} as PostmarkEmailOptions;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should format recipients correctly", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
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

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.From).toBe("Sender <sender@example.com>");
            expect(payload.To).toBe("User 1 <user1@example.com>,user2@example.com");
        });

        it("should include CC and BCC recipients", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
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

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Cc).toBeDefined();
            expect(payload.Bcc).toBeDefined();
        });

        it("should include template if provided", async () => {
            const makeRequestMock = utils.makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: {
                    body: { MessageID: "test-id" },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = postmarkProvider({ serverToken: "test123" });

            await provider.initialize();

            const emailOptions: PostmarkEmailOptions = {
                from: { email: "sender@example.com" },
                html: "dummy",
                subject: "Test",
                templateId: 12_345,
                templateModel: { name: "John" },
                to: { email: "user@example.com" },
            };

            const callCountBefore = makeRequestMock.mock.calls.length;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);

            const { calls } = makeRequestMock.mock;
            const callWithPayload = calls
                .slice(callCountBefore)
                .find((call) => call.length > 2 && call[2] && typeof call[2] === "string" && (call[2] as string).includes("TemplateId"));

            expect(callWithPayload).toBeDefined();

            if (callWithPayload && callWithPayload[2]) {
                const payload = JSON.parse(callWithPayload[2] as string);

                expect(payload.TemplateId).toBe(12_345);
                expect(payload.TemplateModel).toEqual({ name: "John" });
            }
        });

        it("should include template alias if provided", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
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

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.TemplateAlias).toBe("welcome-template");
            expect(payload.TemplateModel).toEqual({ name: "John" });
        });

        it("should include tracking options", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
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

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.TrackOpens).toBe(true);
            expect(payload.TrackLinks).toBe("HtmlAndText");
        });

        it("should include tag", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
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

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Tag).toBe("tag1"); // Only first tag
        });

        it("should include custom headers", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
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

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Headers).toBeDefined();
            expect(Array.isArray(payload.Headers)).toBe(true);
            expect(payload.Headers[0].Name).toBe("X-Custom");
            expect(payload.Headers[0].Value).toBe("value");
        });

        it("should include attachments", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
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

            const callArgs = makeRequestSpy.mock.calls[0];
            const payload = JSON.parse(callArgs[2] as string);

            expect(payload.Attachments).toBeDefined();
            expect(payload.Attachments).toHaveLength(1);
            expect(payload.Attachments[0].Name).toBe("test.pdf");
        });

        it("should handle errors gracefully", async () => {
            (utils.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
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
