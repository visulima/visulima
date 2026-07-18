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

            expect(message).toContain("From: \"John Doe\" <sender@example.com>");
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
            expect(message).toContain("\"Jane Doe\" <recipient2@example.com>");
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

            expect(message).toContain("Cc: \"CC Recipient\" <cc@example.com>");
        });

        it("should omit BCC recipients from transport output by default", async () => {
            expect.assertions(3);

            const options: EmailOptions = {
                bcc: [{ email: "bcc1@example.com" }, { email: "bcc2@example.com" }],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            // Bcc must NOT leak into the delivered message; recipients are reached via the envelope.
            expect(message).not.toContain("Bcc:");
            expect(message).not.toContain("bcc1@example.com");
            expect(message).not.toContain("bcc2@example.com");
        });

        it("should include BCC recipients when includeBcc is set (draft/EML output)", async () => {
            expect.assertions(3);

            const options: EmailOptions = {
                bcc: [{ email: "bcc1@example.com" }, { email: "bcc2@example.com" }],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options, { includeBcc: true });

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

            expect(message).toContain("Reply-To: \"Reply To\" <reply@example.com>");
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

        it("should default the content type when an attachment omits it", async () => {
            expect.assertions(1);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("test content"),
                        filename: "test.bin",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Content-Type: application/octet-stream; name=\"test.bin\"");
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
            // eslint-disable-next-line e18e/prefer-static-regex, sonarjs/prefer-regexp-exec
            const boundary1 = message1.match(/boundary="(.+)"/)?.[1];
            // eslint-disable-next-line e18e/prefer-static-regex, sonarjs/prefer-regexp-exec
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
                    },
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

        it("should include custom attachment headers", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("data"),
                        contentType: "text/plain",
                        filename: "test.txt",
                        headers: {
                            "X-Attachment-Id": "att-1",
                            "X-Custom": "value",
                        },
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("X-Attachment-Id: att-1");
            expect(message).toContain("X-Custom: value");
        });

        it("should inline a Buffer attachment with 7bit encoding", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("plain buffer body"),
                        contentType: "text/plain",
                        encoding: "7bit",
                        filename: "test.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Content-Transfer-Encoding: 7bit");
            expect(message).toContain("plain buffer body");
        });

        it("should inline a Uint8Array attachment with 8bit encoding", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: new Uint8Array([104, 105, 33]),
                        contentType: "text/plain",
                        encoding: "8bit",
                        filename: "test.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Content-Transfer-Encoding: 8bit");
            expect(message).toContain("hi!");
        });

        it("should base64-encode an attachment with an unrecognized encoding", async () => {
            expect.assertions(2);

            const options: EmailOptions = {
                attachments: [
                    {
                        content: Buffer.from("quoted body"),
                        contentType: "text/plain",
                        encoding: "quoted-printable",
                        filename: "test.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Test",
                to: { email: "recipient@example.com" },
            };

            const message = await buildMimeMessage(options);

            expect(message).toContain("Content-Transfer-Encoding: quoted-printable");
            expect(message).toContain(Buffer.from("quoted body").toString("base64"));
        });
    });

    describe("non-ascii header encoding (RFC 2047)", () => {
        it("should RFC 2047 encode a non-ASCII subject", async () => {
            expect.assertions(2);

            const message = await buildMimeMessage({
                from: { email: "sender@example.com" },
                subject: "Grüße aus München",
                text: "hi",
                to: { email: "recipient@example.com" },
            });

            // Raw UTF-8 must not appear in the header; it is encoded as an encoded-word.
            expect(message).not.toContain("Subject: Grüße aus München");
            expect(message).toContain("=?UTF-8?B?");
        });

        it("should leave an ASCII subject untouched", async () => {
            expect.assertions(1);

            const message = await buildMimeMessage({
                from: { email: "sender@example.com" },
                subject: "Plain ASCII Subject",
                text: "hi",
                to: { email: "recipient@example.com" },
            });

            expect(message).toContain("Subject: Plain ASCII Subject");
        });

        it("should encode non-ASCII bodies as quoted-printable instead of mislabelling them 7bit", async () => {
            expect.assertions(3);

            const message = await buildMimeMessage({
                from: { email: "sender@example.com" },
                html: "<p>Grüße</p>",
                subject: "x",
                text: "Grüße",
                to: { email: "recipient@example.com" },
            });

            expect(message).toContain("Content-Transfer-Encoding: quoted-printable");
            // The raw multibyte ü must not be emitted under a 7bit label.
            expect(message).toContain("Gr=C3=BC=C3=9Fe");
            expect(message).not.toContain("Content-Transfer-Encoding: 7bit\r\n\r\nGrüße");
        });
    });

    describe("attachment metadata header injection", () => {
        it("should strip CRLF from attachment contentType, disposition, cid and encoding", async () => {
            expect.assertions(3);

            const message = await buildMimeMessage({
                attachments: [
                    {
                        cid: "abc\r\nX-Injected-Cid: yes",
                        content: "data",
                        contentDisposition: "attachment\r\nX-Injected-Disp: yes" as never,
                        contentType: "text/plain\r\nX-Injected-Type: yes",
                        encoding: "base64\r\nX-Injected-Enc: yes",
                        filename: "file.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "x",
                text: "hi",
                to: { email: "recipient@example.com" },
            });

            expect(message).not.toContain("X-Injected-Type");
            expect(message).not.toContain("X-Injected-Disp");
            expect(message).not.toContain("X-Injected-Cid");
        });

        it("should RFC 2047 encode a non-ASCII attachment filename", async () => {
            expect.assertions(1);

            const message = await buildMimeMessage({
                attachments: [
                    {
                        content: "data",
                        contentType: "text/plain",
                        filename: "Grüße.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                subject: "x",
                text: "hi",
                to: { email: "recipient@example.com" },
            });

            expect(message).toContain("=?UTF-8?B?");
        });
    });

    describe("multipart/alternative structure (RFC 2046)", () => {
        it("should nest text and html in a multipart/alternative part (text first)", async () => {
            expect.assertions(4);

            const message = await buildMimeMessage({
                from: { email: "sender@example.com" },
                html: "<h1>HTML body</h1>",
                subject: "x",
                text: "Plain body",
                to: { email: "recipient@example.com" },
            });

            expect(message).toContain("multipart/alternative");
            expect(message).toContain("Plain body");
            expect(message).toContain("<h1>HTML body</h1>");
            // The plain-text (least-faithful) rendition must precede the HTML one.
            expect(message.indexOf("text/plain")).toBeLessThan(message.indexOf("text/html"));
        });

        it("should wrap the alternative body inside multipart/mixed when attachments exist", async () => {
            expect.assertions(3);

            const message = await buildMimeMessage({
                attachments: [
                    {
                        content: Buffer.from("file"),
                        contentType: "text/plain",
                        filename: "note.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>HTML body</h1>",
                subject: "x",
                text: "Plain body",
                to: { email: "recipient@example.com" },
            });

            expect(message).toContain("multipart/mixed");
            expect(message).toContain("multipart/alternative");
            // The alternative container is nested inside the mixed container.
            expect(message.indexOf("multipart/mixed")).toBeLessThan(message.indexOf("multipart/alternative"));
        });

        it("should not emit a multipart/alternative for a single body", async () => {
            expect.assertions(2);

            const message = await buildMimeMessage({
                from: { email: "sender@example.com" },
                subject: "x",
                text: "Plain body only",
                to: { email: "recipient@example.com" },
            });

            expect(message).not.toContain("multipart/alternative");
            expect(message).toContain("Plain body only");
        });
    });

    describe("ascii body encoding", () => {
        it("should label a pure-ASCII text body as 7bit, not quoted-printable", async () => {
            expect.assertions(2);

            const message = await buildMimeMessage({
                from: { email: "sender@example.com" },
                subject: "x",
                text: "A plain ASCII sentence with punctuation: 1 + 1 = 2.",
                to: { email: "recipient@example.com" },
            });

            expect(message).toContain("Content-Transfer-Encoding: 7bit");
            expect(message).not.toContain("Content-Transfer-Encoding: quoted-printable");
        });

        it("should quoted-printable encode a UTF-8 text body", async () => {
            expect.assertions(2);

            const message = await buildMimeMessage({
                from: { email: "sender@example.com" },
                subject: "x",
                text: "Grüße",
                to: { email: "recipient@example.com" },
            });

            expect(message).toContain("Content-Transfer-Encoding: quoted-printable");
            expect(message).toContain("Gr=C3=BC=C3=9Fe");
        });
    });
});
