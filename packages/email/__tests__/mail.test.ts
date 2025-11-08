import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMail, MailMessage, type Mailable, type EmailOptions } from "../src/mail.js";
import { resendProvider } from "../src/providers/resend/index.js";
import type { Provider } from "../src/providers/provider.js";
import type { EmailResult, Result } from "../src/types.js";

// Mock provider for testing
const createMockProvider = (): Provider => {
    return {
        name: "mock",
        features: {
            attachments: true,
            html: true,
            templates: false,
            tracking: false,
            customHeaders: true,
            batchSending: false,
            scheduling: false,
            replyTo: true,
            tagging: false,
        },
        options: {},
        async initialize(): Promise<void> {
            // Mock implementation
        },
        async isAvailable(): Promise<boolean> {
            return true;
        },
        async sendEmail(): Promise<Result<EmailResult>> {
            return {
                success: true,
                data: {
                    messageId: "test-message-id",
                    sent: true,
                    timestamp: new Date(),
                    provider: "mock",
                },
            };
        },
    };
};

describe("Mail", () => {
    describe("createMail", () => {
        it("should create a Mail instance with a provider", () => {
            const provider = createMockProvider();
            const mail = createMail(provider);

            expect(mail).toBeInstanceOf(Object);
            expect(mail).toHaveProperty("message");
            expect(mail).toHaveProperty("send");
            expect(mail).toHaveProperty("sendEmail");
        });
    });

    describe("Mail.message()", () => {
        it("should create a MailMessage instance", () => {
            const provider = createMockProvider();
            const mail = createMail(provider);
            const message = mail.message();

            expect(message).toBeInstanceOf(MailMessage);
        });

        it("should set the provider on the message", async () => {
            const provider = createMockProvider();
            const sendEmailSpy = vi.spyOn(provider, "sendEmail");
            const mail = createMail(provider);

            await mail
                .message()
                .to("user@example.com")
                .from("sender@example.com")
                .subject("Test")
                .html("<h1>Test</h1>")
                .send();

            expect(sendEmailSpy).toHaveBeenCalledOnce();
        });
    });

    describe("Mail.send()", () => {
        it("should send a mailable instance", async () => {
            const provider = createMockProvider();
            const sendEmailSpy = vi.spyOn(provider, "sendEmail");
            const mail = createMail(provider);

            class TestMailable implements Mailable {
                build(): EmailOptions {
                    return {
                        from: { email: "sender@example.com" },
                        to: { email: "user@example.com" },
                        subject: "Test",
                        html: "<h1>Test</h1>",
                    };
                }
            }

            await mail.send(new TestMailable());

            expect(sendEmailSpy).toHaveBeenCalledOnce();
        });
    });

    describe("Mail.sendEmail()", () => {
        it("should send email options directly", async () => {
            const provider = createMockProvider();
            const sendEmailSpy = vi.spyOn(provider, "sendEmail");
            const mail = createMail(provider);

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                to: { email: "user@example.com" },
                subject: "Test",
                html: "<h1>Test</h1>",
            };

            await mail.sendEmail(emailOptions);

            expect(sendEmailSpy).toHaveBeenCalledWith(emailOptions);
        });
    });
});

describe("MailMessage", () => {
    let provider: Provider;

    beforeEach(() => {
        provider = createMockProvider();
    });

    describe("fluent interface", () => {
        it("should chain methods", () => {
            const message = new MailMessage();
            message.mailer(provider);

            const result = message
                .to("user@example.com")
                .from("sender@example.com")
                .subject("Test")
                .html("<h1>Test</h1>");

            expect(result).toBe(message);
        });

        it("should build email options", () => {
            const message = new MailMessage();
            message.mailer(provider);

            message.to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            const options = message.build();

            expect(options).toEqual({
                from: { email: "sender@example.com" },
                to: { email: "user@example.com" },
                subject: "Test",
                html: "<h1>Test</h1>",
                text: undefined,
                cc: undefined,
                bcc: undefined,
                headers: undefined,
                attachments: undefined,
                replyTo: undefined,
            });
        });
    });

    describe("from()", () => {
        it("should accept string email", () => {
            const message = new MailMessage();
            message.from("sender@example.com");

            expect(message.build().from).toEqual({ email: "sender@example.com" });
        });

        it("should accept EmailAddress object", () => {
            const message = new MailMessage();
            message.from({ email: "sender@example.com", name: "Sender" });

            expect(message.build().from).toEqual({ email: "sender@example.com", name: "Sender" });
        });
    });

    describe("to()", () => {
        it("should accept string email", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to("user@example.com");

            const options = message.build();
            expect(options.to).toEqual({ email: "user@example.com" });
        });

        it("should accept array of strings", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to(["user1@example.com", "user2@example.com"]);

            const options = message.build();
            expect(options.to).toEqual([{ email: "user1@example.com" }, { email: "user2@example.com" }]);
        });

        it("should accept EmailAddress object", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to({ email: "user@example.com", name: "User" });

            const options = message.build();
            expect(options.to).toEqual({ email: "user@example.com", name: "User" });
        });
    });

    describe("cc() and bcc()", () => {
        it("should set CC recipients", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to("user@example.com").cc("cc@example.com");

            const options = message.build();
            expect(options.cc).toEqual({ email: "cc@example.com" });
        });

        it("should set BCC recipients", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to("user@example.com").bcc("bcc@example.com");

            const options = message.build();
            expect(options.bcc).toEqual({ email: "bcc@example.com" });
        });
    });

    describe("subject()", () => {
        it("should set subject", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to("user@example.com").subject("Test Subject");

            expect(message.build().subject).toBe("Test Subject");
        });
    });

    describe("text() and html()", () => {
        it("should set text content", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to("user@example.com").text("Plain text");

            expect(message.build().text).toBe("Plain text");
        });

        it("should set HTML content", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to("user@example.com").html("<h1>HTML</h1>");

            expect(message.build().html).toBe("<h1>HTML</h1>");
        });
    });

    describe("attach()", () => {
        it("should add attachment", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to("user@example.com").attach("file.txt", "content");

            const options = message.build();
            expect(options.attachments).toHaveLength(1);
            expect(options.attachments?.[0]).toEqual({
                filename: "file.txt",
                content: "content",
                contentType: undefined,
                disposition: undefined,
                cid: undefined,
                path: undefined,
            });
        });
    });

    describe("send()", () => {
        it("should send email using provider", async () => {
            const sendEmailSpy = vi.spyOn(provider, "sendEmail");
            const message = new MailMessage();
            message.mailer(provider);

            await message.to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>").send();

            expect(sendEmailSpy).toHaveBeenCalledOnce();
        });

        it("should throw error if no provider is set", async () => {
            const message = new MailMessage();

            await expect(
                message.to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>").send(),
            ).rejects.toThrow("No provider configured");
        });
    });

    describe("build() validation", () => {
        it("should throw error if from is missing", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to("user@example.com").subject("Test").html("<h1>Test</h1>");

            expect(() => message.build()).toThrow("From address is required");
        });

        it("should throw error if to is missing", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            expect(() => message.build()).toThrow("At least one recipient is required");
        });

        it("should throw error if subject is missing", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to("user@example.com").from("sender@example.com").html("<h1>Test</h1>");

            expect(() => message.build()).toThrow("Subject is required");
        });

        it("should throw error if neither text nor html is provided", () => {
            const message = new MailMessage();
            message.mailer(provider);
            message.to("user@example.com").from("sender@example.com").subject("Test");

            expect(() => message.build()).toThrow("Either text or html content is required");
        });
    });
});
