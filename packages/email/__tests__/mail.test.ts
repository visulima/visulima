import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailOptions, Mailable } from "../src/mail.js";
import { createMail, MailMessage } from "../src/mail.js";
import type { Provider } from "../src/providers/provider.js";
import type { EmailResult, Result } from "../src/types.js";

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
            const provider = createMockProvider();
            const mail = createMail(provider);

            expect(mail).toBeInstanceOf(Object);
            expect(mail).toHaveProperty("message");
            expect(mail).toHaveProperty("send");
            expect(mail).toHaveProperty("sendEmail");
        });
    });

    describe("mail.message()", () => {
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

            await mail.message().to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>").send();

            expect(sendEmailSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("mail.send()", () => {
        it("should send a mailable instance", async () => {
            const provider = createMockProvider();
            const sendEmailSpy = vi.spyOn(provider, "sendEmail");
            const mail = createMail(provider);

            class TestMailable implements Mailable {
                build(): EmailOptions {
                    return {
                        from: { email: "sender@example.com" },
                        html: "<h1>Test</h1>",
                        subject: "Test",
                        to: { email: "user@example.com" },
                    };
                }
            }

            await mail.send(new TestMailable());

            expect(sendEmailSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("mail.sendEmail()", () => {
        it("should send email options directly", async () => {
            const provider = createMockProvider();
            const sendEmailSpy = vi.spyOn(provider, "sendEmail");
            const mail = createMail(provider);

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await mail.sendEmail(emailOptions);

            expect(sendEmailSpy).toHaveBeenCalledWith(emailOptions);
        });
    });
});

describe(MailMessage, () => {
    let provider: Provider;

    beforeEach(() => {
        provider = createMockProvider();
    });

    describe("fluent interface", () => {
        it("should chain methods", () => {
            const message = new MailMessage();

            message.mailer(provider);

            const result = message.to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            expect(result).toBe(message);
        });

        it("should build email options", async () => {
            const message = new MailMessage();

            message.mailer(provider);

            message.to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            const options = await message.build();

            expect(options).toEqual({
                attachments: undefined,
                bcc: undefined,
                cc: undefined,
                from: { email: "sender@example.com" },
                headers: undefined,
                html: "<h1>Test</h1>",
                replyTo: undefined,
                subject: "Test",
                text: undefined,
                to: { email: "user@example.com" },
            });
        });
    });

    describe("from()", () => {
        it("should accept string email", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Test</h1>");

            expect((await message.build()).from).toEqual({ email: "sender@example.com" });
        });

        it("should accept EmailAddress object", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from({ email: "sender@example.com", name: "Sender" }).to("user@example.com").subject("Test").html("<h1>Test</h1>");

            expect((await message.build()).from).toEqual({ email: "sender@example.com", name: "Sender" });
        });
    });

    describe("to()", () => {
        it("should accept string email", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Test</h1>");

            const options = await message.build();

            expect(options.to).toEqual({ email: "user@example.com" });
        });

        it("should accept array of strings", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from("sender@example.com").to(["user1@example.com", "user2@example.com"]).subject("Test").html("<h1>Test</h1>");

            const options = await message.build();

            expect(options.to).toEqual([{ email: "user1@example.com" }, { email: "user2@example.com" }]);
        });

        it("should accept EmailAddress object", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from("sender@example.com").to({ email: "user@example.com", name: "User" }).subject("Test").html("<h1>Test</h1>");

            const options = await message.build();

            expect(options.to).toEqual({ email: "user@example.com", name: "User" });
        });
    });

    describe("cc() and bcc()", () => {
        it("should set CC recipients", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Test</h1>").cc("cc@example.com");

            const options = await message.build();

            expect(options.cc).toEqual({ email: "cc@example.com" });
        });

        it("should set BCC recipients", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Test</h1>").bcc("bcc@example.com");

            const options = await message.build();

            expect(options.bcc).toEqual({ email: "bcc@example.com" });
        });
    });

    describe("subject()", () => {
        it("should set subject", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from("sender@example.com").to("user@example.com").subject("Test Subject").html("<h1>Test</h1>");

            expect((await message.build()).subject).toBe("Test Subject");
        });
    });

    describe("text() and html()", () => {
        it("should set text content", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from("sender@example.com").to("user@example.com").subject("Test").text("Plain text");

            const options = await message.build();

            expect(options.text).toBe("Plain text");
        });

        it("should set HTML content", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>HTML</h1>");

            const options = await message.build();

            expect(options.html).toBe("<h1>HTML</h1>");
        });
    });

    describe("attach()", () => {
        it("should add attachment", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Test</h1>").attachData("content", { filename: "file.txt" });

            const options = await message.build();

            expect(options.attachments).toHaveLength(1);
            expect(options.attachments?.[0]).toEqual({
                cid: undefined,
                content: "content",
                contentDisposition: "attachment",
                contentType: "text/plain",
                encoding: undefined,
                filename: "file.txt",
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

            expect(sendEmailSpy).toHaveBeenCalledTimes(1);
        });

        it("should throw error if no provider is set", async () => {
            const message = new MailMessage();

            await expect(message.to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>").send()).rejects.toThrow(
                "No provider configured",
            );
        });
    });

    describe("build() validation", () => {
        it("should throw error if from is missing", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.to("user@example.com").subject("Test").html("<h1>Test</h1>");

            await expect(message.build()).rejects.toThrow("From address is required");
        });

        it("should throw error if to is missing", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            await expect(message.build()).rejects.toThrow("At least one recipient is required");
        });

        it("should throw error if subject is missing", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.to("user@example.com").from("sender@example.com").html("<h1>Test</h1>");

            await expect(message.build()).rejects.toThrow("Subject is required");
        });

        it("should throw error if neither text nor html is provided", async () => {
            const message = new MailMessage();

            message.mailer(provider);
            message.to("user@example.com").from("sender@example.com").subject("Test");

            await expect(message.build()).rejects.toThrow("Either text or html content is required");
        });
    });
});
