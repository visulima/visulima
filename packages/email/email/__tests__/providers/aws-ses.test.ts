import { beforeEach, describe, expect, it, vi } from "vitest";

import EmailError from "../../src/errors/email-error";
import { awsSesProvider } from "../../src/providers/aws-ses/index";
import type { AwsSesEmailOptions } from "../../src/providers/aws-ses/types";
import { makeRequest } from "../../src/utils/make-request";

vi.mock(import("../../src/utils/make-request"), () => {
    return {
        makeRequest: vi.fn(),
    };
});

describe(awsSesProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should create provider with required options", () => {
            expect.assertions(2);

            const provider = awsSesProvider({
                accessKeyId: "test123",
                region: "us-east-1",
                secretAccessKey: "test456",
            });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("aws-ses");
        });

        it("should throw error if accessKeyId is missing when sending email", async () => {
            expect.assertions(3);

            const provider = awsSesProvider({ region: "us-east-1", secretAccessKey: "test123" } as any);

            const emailOptions: AwsSesEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(EmailError);
            expect(result.error?.message).toContain("accessKeyId");
        });

        it("should throw error if secretAccessKey is missing when sending email", async () => {
            expect.assertions(3);

            const provider = awsSesProvider({ accessKeyId: "test123", region: "us-east-1" } as any);

            const emailOptions: AwsSesEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(EmailError);
            expect(result.error?.message).toContain("secretAccessKey");
        });
    });

    describe("sendEmail", () => {
        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        it("should send email successfully", async () => {
            expect.assertions(3);

            makeRequestMock.mockResolvedValueOnce({
                data: {
                    body: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><SendRawEmailResponse><SendRawEmailResult><MessageId>test-message-id-123</MessageId></SendRawEmailResult></SendRawEmailResponse>",
                    statusCode: 200,
                },
                success: true,
            });

            const provider = awsSesProvider({
                accessKeyId: "test123",
                region: "us-east-1",
                secretAccessKey: "test456",
            });

            const emailOptions: AwsSesEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("test-message-id-123");
            expect(result.data?.sent).toBe(true);
        });

        it("should throw error for unsupported attachments field", async () => {
            expect.assertions(3);

            const provider = awsSesProvider({
                accessKeyId: "test123",
                region: "us-east-1",
                secretAccessKey: "test456",
            });

            const emailOptions: AwsSesEmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("test"),
                        filename: "test.pdf",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(EmailError);
            expect(result.error?.message).toContain("attachments");
        });

        it("should throw error for unsupported priority field", async () => {
            expect.assertions(3);

            const provider = awsSesProvider({
                accessKeyId: "test123",
                region: "us-east-1",
                secretAccessKey: "test456",
            });

            const emailOptions: AwsSesEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                priority: "high",
                subject: "Test Subject",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(EmailError);
            expect(result.error?.message).toContain("priority");
        });

        it("should throw error for unsupported tags field", async () => {
            expect.assertions(3);

            const provider = awsSesProvider({
                accessKeyId: "test123",
                region: "us-east-1",
                secretAccessKey: "test456",
            });

            const emailOptions: AwsSesEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                tags: ["tag1", "tag2"],
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(EmailError);
            expect(result.error?.message).toContain("tags");
        });

        it("should throw error for unsupported replyTo field", async () => {
            expect.assertions(3);

            const provider = awsSesProvider({
                accessKeyId: "test123",
                region: "us-east-1",
                secretAccessKey: "test456",
            });

            const emailOptions: AwsSesEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                replyTo: { email: "reply@example.com" },
                subject: "Test Subject",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(EmailError);
            expect(result.error?.message).toContain("replyTo");
        });

        it("should throw error for multiple unsupported fields", async () => {
            expect.assertions(4);

            const provider = awsSesProvider({
                accessKeyId: "test123",
                region: "us-east-1",
                secretAccessKey: "test456",
            });

            const emailOptions: AwsSesEmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("test"),
                        filename: "test.pdf",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                priority: "high",
                replyTo: { email: "reply@example.com" },
                subject: "Test Subject",
                tags: ["tag1"],
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(EmailError);
            expect(result.error?.message).toContain("attachments");
            expect(result.error?.message).toContain("priority");
        });

        it("should return error when MessageId is missing from response", async () => {
            expect.assertions(3);

            makeRequestMock.mockResolvedValueOnce({
                data: {
                    body: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><SendRawEmailResponse><SendRawEmailResult></SendRawEmailResult></SendRawEmailResponse>",
                    statusCode: 200,
                },
                success: true,
            });

            const provider = awsSesProvider({
                accessKeyId: "test123",
                region: "us-east-1",
                secretAccessKey: "test456",
            });

            const emailOptions: AwsSesEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(EmailError);
            expect(result.error?.message).toContain("MessageId");
        });

        it("should return error when MessageId is empty string", async () => {
            expect.assertions(3);

            makeRequestMock.mockResolvedValueOnce({
                data: {
                    body: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><SendRawEmailResponse><SendRawEmailResult><MessageId></MessageId></SendRawEmailResult></SendRawEmailResponse>",
                    statusCode: 200,
                },
                success: true,
            });

            const provider = awsSesProvider({
                accessKeyId: "test123",
                region: "us-east-1",
                secretAccessKey: "test456",
            });

            const emailOptions: AwsSesEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(EmailError);
            expect(result.error?.message).toContain("MessageId");
        });

        it("should return error when MessageId is whitespace only", async () => {
            expect.assertions(3);

            makeRequestMock.mockResolvedValueOnce({
                data: {
                    body: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><SendRawEmailResponse><SendRawEmailResult><MessageId>   </MessageId></SendRawEmailResult></SendRawEmailResponse>",
                    statusCode: 200,
                },
                success: true,
            });

            const provider = awsSesProvider({
                accessKeyId: "test123",
                region: "us-east-1",
                secretAccessKey: "test456",
            });

            const emailOptions: AwsSesEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(EmailError);
            expect(result.error?.message).toContain("MessageId");
        });

        it("should support messageTags (AWS SES specific)", async () => {
            expect.assertions(3);

            makeRequestMock.mockResolvedValueOnce({
                data: {
                    body: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><SendRawEmailResponse><SendRawEmailResult><MessageId>test-message-id-456</MessageId></SendRawEmailResult></SendRawEmailResponse>",
                    statusCode: 200,
                },
                success: true,
            });

            const provider = awsSesProvider({
                accessKeyId: "test123",
                region: "us-east-1",
                secretAccessKey: "test456",
            });

            const emailOptions: AwsSesEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                messageTags: {
                    tag1: "value1",
                    tag2: "value2",
                },
                subject: "Test Subject",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("test-message-id-456");
            expect(result.data?.sent).toBe(true);
        });

        describe("cRLF injection protection", () => {
            it("should sanitize CRLF in subject header", async () => {
                expect.assertions(5);

                makeRequestMock.mockResolvedValueOnce({
                    data: {
                        body: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><SendRawEmailResponse><SendRawEmailResult><MessageId>test-message-id</MessageId></SendRawEmailResult></SendRawEmailResponse>",
                        statusCode: 200,
                    },
                    success: true,
                });

                const provider = awsSesProvider({
                    accessKeyId: "test123",
                    region: "us-east-1",
                    secretAccessKey: "test456",
                });

                const emailOptions: AwsSesEmailOptions = {
                    from: { email: "sender@example.com" },
                    html: "<h1>Test</h1>",
                    subject: "Test\r\nSubject: Injected",
                    to: { email: "user@example.com" },
                };

                const result = await provider.sendEmail(emailOptions);

                expect(result.success).toBe(true);
                // Verify the request was made (CRLF should be sanitized)
                expect(makeRequestMock).toHaveBeenCalledWith(expect.any(String), expect.any(Object), expect.stringMatching(/^Action=SendRawEmail/));

                const callArgs = makeRequestMock.mock.calls[0];

                // Verify body doesn't contain URL-encoded CRLF
                expect(callArgs[2]).not.toContain("%0D%0A");
                expect(callArgs[2]).not.toContain("%0D");
                expect(callArgs[2]).not.toContain("%0A");
            });

            it("should sanitize CRLF in email address display names", async () => {
                expect.assertions(5);

                makeRequestMock.mockResolvedValueOnce({
                    data: {
                        body: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><SendRawEmailResponse><SendRawEmailResult><MessageId>test-message-id</MessageId></SendRawEmailResult></SendRawEmailResponse>",
                        statusCode: 200,
                    },
                    success: true,
                });

                const provider = awsSesProvider({
                    accessKeyId: "test123",
                    region: "us-east-1",
                    secretAccessKey: "test456",
                });

                const emailOptions: AwsSesEmailOptions = {
                    from: { email: "sender@example.com", name: "Sender\r\nFrom: injected@evil.com" },
                    html: "<h1>Test</h1>",
                    subject: "Test Subject",
                    to: { email: "user@example.com" },
                };

                const result = await provider.sendEmail(emailOptions);

                expect(result.success).toBe(true);
                expect(makeRequestMock).toHaveBeenCalledWith(expect.any(String), expect.any(Object), expect.stringMatching(/^Action=SendRawEmail/));

                const callArgs = makeRequestMock.mock.calls[0];

                // Verify body doesn't contain URL-encoded CRLF
                expect(callArgs[2]).not.toContain("%0D%0A");
                expect(callArgs[2]).not.toContain("%0D");
                expect(callArgs[2]).not.toContain("%0A");
            });

            it("should sanitize CRLF in custom header values", async () => {
                expect.assertions(5);

                makeRequestMock.mockResolvedValueOnce({
                    data: {
                        body: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><SendRawEmailResponse><SendRawEmailResult><MessageId>test-message-id</MessageId></SendRawEmailResult></SendRawEmailResponse>",
                        statusCode: 200,
                    },
                    success: true,
                });

                const provider = awsSesProvider({
                    accessKeyId: "test123",
                    region: "us-east-1",
                    secretAccessKey: "test456",
                });

                const emailOptions: AwsSesEmailOptions = {
                    from: { email: "sender@example.com" },
                    headers: {
                        "X-Custom-Header": "Value\r\nInjected-Header: malicious",
                    },
                    html: "<h1>Test</h1>",
                    subject: "Test Subject",
                    to: { email: "user@example.com" },
                };

                const result = await provider.sendEmail(emailOptions);

                expect(result.success).toBe(true);
                expect(makeRequestMock).toHaveBeenCalledWith(expect.any(String), expect.any(Object), expect.stringMatching(/^Action=SendRawEmail/));

                const callArgs = makeRequestMock.mock.calls[0];

                // Verify body doesn't contain URL-encoded CRLF
                expect(callArgs[2]).not.toContain("%0D%0A");
                expect(callArgs[2]).not.toContain("%0D");
                expect(callArgs[2]).not.toContain("%0A");
            });

            it("should sanitize CRLF in custom header names", async () => {
                expect.assertions(5);

                makeRequestMock.mockResolvedValueOnce({
                    data: {
                        body: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><SendRawEmailResponse><SendRawEmailResult><MessageId>test-message-id</MessageId></SendRawEmailResult></SendRawEmailResponse>",
                        statusCode: 200,
                    },
                    success: true,
                });

                const provider = awsSesProvider({
                    accessKeyId: "test123",
                    region: "us-east-1",
                    secretAccessKey: "test456",
                });

                const emailOptions: AwsSesEmailOptions = {
                    from: { email: "sender@example.com" },
                    headers: {
                        "X-Custom\r\nHeader": "Value",
                    },
                    html: "<h1>Test</h1>",
                    subject: "Test Subject",
                    to: { email: "user@example.com" },
                };

                const result = await provider.sendEmail(emailOptions);

                expect(result.success).toBe(true);
                expect(makeRequestMock).toHaveBeenCalledWith(expect.any(String), expect.any(Object), expect.stringMatching(/^Action=SendRawEmail/));

                const callArgs = makeRequestMock.mock.calls[0];

                // Verify body doesn't contain URL-encoded CRLF
                expect(callArgs[2]).not.toContain("%0D%0A");
                expect(callArgs[2]).not.toContain("%0D");
                expect(callArgs[2]).not.toContain("%0A");
            });
        });
    });
});
