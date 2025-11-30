import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { createMail } from "../src/mail";
import MailMessage from "../src/mail-message";
import type { Provider } from "../src/providers/provider";
import type { EmailOptions, EmailResult, Result } from "../src/types";

// Mock provider for testing
const createMockProvider = (): Provider => {
    return {
        features: {
            attachments: true,
            batchSending: false,
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false,
            tagging: false,
            templates: false,
            tracking: false,
        },
        async initialize(): Promise<void> {
            // Mock implementation
        },
        async isAvailable(): Promise<boolean> {
            return true;
        },
        name: "mock",
        options: {},
        async sendEmail(): Promise<Result<EmailResult>> {
            return {
                data: {
                    messageId: "test-message-id",
                    provider: "mock",
                    sent: true,
                    timestamp: new Date(),
                },
                success: true,
            };
        },
    };
};

describe("mail", () => {
    describe(createMail, () => {
        it("should create a Mail instance with a provider", () => {
            expect.assertions(3);

            const provider = createMockProvider();
            const mail = createMail(provider);

            expect(mail).toBeInstanceOf(Object);
            expect(mail).toHaveProperty("send");
            expect(mail).toHaveProperty("sendMany");
        });
    });

    describe("mail.send()", () => {
        it("should send a MailMessage instance", async () => {
            expect.assertions(1);

            const provider = createMockProvider();
            const sendEmailSpy = vi.spyOn(provider, "sendEmail");
            const mail = createMail(provider);

            const message = new MailMessage().to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            await mail.send(message);

            expect(sendEmailSpy).toHaveBeenCalledTimes(1);
        });

        it("should send email options directly", async () => {
            expect.assertions(1);

            const provider = createMockProvider();
            const sendEmailSpy = vi.spyOn(provider, "sendEmail");
            const mail = createMail(provider);

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await mail.send(emailOptions);

            expect(sendEmailSpy).toHaveBeenCalledWith(emailOptions);
        });
    });

    describe("mail.draft()", () => {
        it("should create a draft from MailMessage and return EML format", async () => {
            expect.assertions(3);

            const provider = createMockProvider();
            const mail = createMail(provider);

            const message = new MailMessage().to("user@example.com").from("sender@example.com").subject("Test Draft").html("<h1>Test</h1>");

            const eml = await mail.draft(message);

            expectTypeOf(eml).toBeString();

            expect(eml).toContain("X-Unsent: 1");
            expect(eml).toContain("Subject: Test Draft");
        });

        it("should create a draft from EmailOptions and return EML format", async () => {
            expect.assertions(3);

            const provider = createMockProvider();
            const mail = createMail(provider);

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Draft",
                to: { email: "user@example.com" },
            };

            const eml = await mail.draft(emailOptions);

            expectTypeOf(eml).toBeString();

            expect(eml).toContain("X-Unsent: 1");
            expect(eml).toContain("Subject: Test Draft");
        });

        it("should include X-Unsent header in draft EML", async () => {
            expect.assertions(1);

            const provider = createMockProvider();
            const mail = createMail(provider);

            const message = new MailMessage().to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            const eml = await mail.draft(message);

            expect(eml).toMatch(/X-Unsent:\s*1/i);
        });

        it("should include all email headers in draft EML", async () => {
            expect.assertions(4);

            const provider = createMockProvider();
            const mail = createMail(provider);

            const message = new MailMessage()
                .to("user@example.com")
                .from("sender@example.com")
                .subject("Test Subject")
                .html("<h1>Test</h1>")
                .replyTo("reply@example.com");

            const eml = await mail.draft(message);

            expect(eml).toContain("From:");
            expect(eml).toContain("To:");
            expect(eml).toContain("Subject: Test Subject");
            expect(eml).toContain("Reply-To:");
        });

        it("should apply global configuration to draft", async () => {
            expect.assertions(2);

            const provider = createMockProvider();
            const mail = createMail(provider).setFrom({ email: "global@example.com" }).setHeaders({ "X-Custom-Header": "custom-value" });

            const message = new MailMessage().to("user@example.com").subject("Test").html("<h1>Test</h1>");

            const eml = await mail.draft(message);

            expect(eml).toContain("From: global@example.com");
            expect(eml).toContain("X-Custom-Header: custom-value");
        });

        it("should include HTML content in draft EML", async () => {
            expect.assertions(1);

            const provider = createMockProvider();
            const mail = createMail(provider);

            const message = new MailMessage().to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Hello World</h1>");

            const eml = await mail.draft(message);

            expect(eml).toContain("<h1>Hello World</h1>");
        });

        it("should include text content in draft EML", async () => {
            expect.assertions(1);

            const provider = createMockProvider();
            const mail = createMail(provider);

            const message = new MailMessage().to("user@example.com").from("sender@example.com").subject("Test").text("Plain text content");

            const eml = await mail.draft(message);

            expect(eml).toContain("Plain text content");
        });

        it("should create valid EML format with proper line endings", async () => {
            expect.assertions(2);

            const provider = createMockProvider();
            const mail = createMail(provider);

            const message = new MailMessage().to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            const eml = await mail.draft(message);

            // EML should use \r\n line endings
            expect(eml).toContain("\r\n");
            // Should have proper MIME structure
            expect(eml).toContain("MIME-Version: 1.0");
        });

        it("should handle DraftMailMessage instances", async () => {
            expect.assertions(2);

            const provider = createMockProvider();
            const mail = createMail(provider);

            // Import DraftMailMessage dynamically to avoid circular dependency issues
            const { default: DraftMailMessage } = await import("../src/draft-mail-message");

            const draftMessage = new DraftMailMessage().to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            const eml = await mail.draft(draftMessage);

            expectTypeOf(eml).toBeString();

            expect(eml).toContain("X-Unsent: 1");
        });
    });
});
