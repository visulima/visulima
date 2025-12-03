import { describe, expect, it } from "vitest";

import type { EmailOptions } from "../../src/types";
import buildMimeMessage from "../../src/utils/build-mime-message";

describe(buildMimeMessage, () => {
    describe("basic email", () => {
        it("should build a simple text email", async () => {
            expect.assertions(3);

            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                subject: "Test Subject",
                text: "Test content",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("From: sender@example.com");
            expect(message).toContain("To: recipient@example.com");
            expect(message).toContain("Subject: Test Subject");
        });

        it("should build a simple HTML email", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Content-Type: text/html");
            expect(message).toContain("<h1>Test</h1>");
        });

        it("should build email with both text and HTML", async () => {
            expect.assertions(3);

            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>HTML</h1>",
                subject: "Test Subject",
                text: "Plain text",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("multipart/mixed");
            expect(message).toContain("Plain text");
            expect(message).toContain("<h1>HTML</h1>");
        });
    });

    describe("address formatting", () => {
        it("should format email address with name", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                from: { email: "sender@example.com", name: "John Doe" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("From: John Doe <sender@example.com>");
        });

        it("should handle multiple recipients", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: [{ email: "recipient1@example.com" }, { email: "recipient2@example.com", name: "Jane Doe" }],
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("recipient1@example.com");
            expect(message).toContain("Jane Doe <recipient2@example.com>");
        });

        it("should handle CC recipients", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                cc: { email: "cc@example.com", name: "CC Recipient" },
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Cc: CC Recipient <cc@example.com>");
        });

        it("should handle BCC recipients", async () => {
            expect.assertions(3);

            const options: EmailOptions = {
                bcc: [{ email: "bcc1@example.com" }, { email: "bcc2@example.com" }],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Bcc:");
            expect(message).toContain("bcc1@example.com");
            expect(message).toContain("bcc2@example.com");
        });

        it("should handle reply-to address", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                replyTo: { email: "reply@example.com", name: "Reply To" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Reply-To: Reply To <reply@example.com>");
        });
    });

    describe("attachments", () => {
        it("should include attachments in multipart message", async () => {
            expect.assertions(3);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("test content"),
                        contentType: "text/plain",
                        filename: "test.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("multipart/mixed");
            expect(message).toContain("Content-Disposition: attachment");
            expect(message).toContain("filename=\"test.txt\"");
        });

        it("should handle multiple attachments", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("content1"),
                        contentType: "text/plain",
                        filename: "file1.txt",
                    },
                    {
                        content: Buffer.from("content2"),
                        contentType: "application/pdf",
                        filename: "file2.pdf",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("file1.txt");
            expect(message).toContain("file2.pdf");
        });

        it("should handle inline attachments", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                attachments: [
                    {
                        cid: "image1",
                        content: Buffer.from("image data"),
                        contentDisposition: "inline",
                        contentType: "image/png",
                        filename: "image.png",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<img src=\"cid:image1\">",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Content-Disposition: inline");
            expect(message).toContain("Content-ID: <image1>");
        });

        it("should base64 encode attachment content", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("test content"),
                        contentType: "text/plain",
                        filename: "test.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            // Base64 encoded "test content" should be present
            expect(message).toContain("dGVzdCBjb250ZW50");
        });
    });

    describe("headers", () => {
        it("should include custom headers", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                headers: {
                    "X-Custom-Header": "custom-value",
                    "X-Priority": "1",
                },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("X-Custom-Header: custom-value");
            expect(message).toContain("X-Priority: 1");
        });

        it("should include priority header if provided in headers", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                headers: {
                    Priority: "high",
                },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Priority: high");
        });
    });

    describe("mIME structure", () => {
        it("should use correct line endings (CRLF)", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            // Should use \r\n for line endings
            expect(message).toContain("\r\n");
        });

        it("should include MIME-Version header", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("MIME-Version: 1.0");
        });

        it("should generate unique boundary for multipart messages", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message1 = await buildMimeMessage(options);
            const message2 = await buildMimeMessage(options);

            // Extract boundaries
            const boundary1 = message1.match(/boundary="(.+)"/)?.[1];
            const boundary2 = message2.match(/boundary="(.+)"/)?.[1];

            expect(boundary1).toBeDefined();
            expect(boundary1).not.toBe(boundary2);
        });
    });

    describe("edge cases", () => {
        it("should handle string attachment content", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: "string content",
                        contentType: "text/plain",
                        filename: "test.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Content-Disposition: attachment");
        });

        it("should handle Uint8Array attachment content", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: new Uint8Array([1, 2, 3, 4]),
                        contentType: "application/octet-stream",
                        filename: "test.bin",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Content-Disposition: attachment");
        });

        it("should handle email with only HTML and attachments", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("test"),
                        contentType: "text/plain",
                        filename: "test.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("multipart/mixed");
            expect(message).toContain("<h1>Test</h1>");
        });

        it("should handle email with only text and attachments", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("test"),
                        contentType: "text/plain",
                        filename: "test.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test content",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("multipart/mixed");
            expect(message).toContain("Test content");
        });

        it("should handle Promise-based attachment content", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: Promise.resolve(Buffer.from("async content")),
                        contentType: "text/plain",
                        filename: "test.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Content-Disposition: attachment");
        });

        it("should throw error if attachment has no content", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                attachments: [
                    {
                        contentType: "text/plain",
                        filename: "test.txt",
                    } as never,
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            await expect(buildMimeMessage(options)).rejects.toThrow("must have content");
        });

        it("should handle attachment with raw content", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                attachments: [
                    {
                        contentType: "text/plain",
                        filename: "test.txt",
                        raw: Buffer.from("raw content"),
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Content-Disposition: attachment");
        });

        it("should handle different attachment encodings", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: "7bit content",
                        contentType: "text/plain",
                        encoding: "7bit",
                        filename: "test1.txt",
                    },
                    {
                        content: Buffer.from("base64 content"),
                        contentType: "text/plain",
                        encoding: "base64",
                        filename: "test2.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Content-Transfer-Encoding: 7bit");
            expect(message).toContain("Content-Transfer-Encoding: base64");
        });
    });
});
