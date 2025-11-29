import { describe, expect, it, vi } from "vitest";

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
});
