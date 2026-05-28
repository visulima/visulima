import { beforeEach, describe, expect, it, vi } from "vitest";

import DraftMailMessage from "../src/draft-mail-message";
import { createMail } from "../src/mail";
import MailMessage from "../src/mail-message";
import type { Provider } from "../src/providers/provider";
import type { EmailOptions, EmailResult, Receipt, Result } from "../src/types";

interface MockProviderOptions {
    result?: Result<EmailResult>;
    throwError?: unknown;
}

const successResult: Result<EmailResult> = {
    data: {
        messageId: "test-message-id",
        provider: "mock",
        response: { ok: true },
        sent: true,
        timestamp: new Date(),
    },
    success: true,
};

const createMockProvider = (options: MockProviderOptions = {}): Provider => {
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
        // eslint-disable-next-line @typescript-eslint/require-await
        async isAvailable(): Promise<boolean> {
            return true;
        },
        name: "mock",
        options: {},
        // eslint-disable-next-line @typescript-eslint/require-await
        async sendEmail(): Promise<Result<EmailResult>> {
            if ("throwError" in options) {
                throw options.throwError;
            }

            return options.result ?? successResult;
        },
    };
};

interface MockConsole {
    debug: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    log: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
}

const createMockConsole = (): MockConsole => {
    return {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
    };
};

describe("mail (extended)", () => {
    let mockConsole: MockConsole;

    beforeEach(() => {
        mockConsole = createMockConsole();
    });

    describe("logger configuration", () => {
        it("setLogger returns this for chaining", () => {
            expect.assertions(1);

            const mail = createMail(createMockProvider());

            expect(mail.setLogger(mockConsole as unknown as Console)).toBe(mail);
        });

        it("setFrom logs a debug message when a logger is set", () => {
            expect.assertions(1);

            createMail(createMockProvider())
                .setLogger(mockConsole as unknown as Console)
                .setFrom({ email: "noreply@example.com", name: "App" });

            expect(mockConsole.log).toHaveBeenCalledWith("[Mail] Default from address updated", { from: "noreply@example.com" });
        });

        it("setReplyTo stores the address and logs a debug message", () => {
            expect.assertions(1);

            createMail(createMockProvider())
                .setLogger(mockConsole as unknown as Console)
                .setReplyTo({ email: "support@example.com" });

            expect(mockConsole.log).toHaveBeenCalledWith("[Mail] Default reply-to address updated", { replyTo: "support@example.com" });
        });

        it("setReplyTo returns this for chaining without a logger", () => {
            expect.assertions(1);

            const mail = createMail(createMockProvider());

            expect(mail.setReplyTo({ email: "support@example.com" })).toBe(mail);
        });

        it("setHeaders logs the header count and keys", () => {
            expect.assertions(1);

            createMail(createMockProvider())
                .setLogger(mockConsole as unknown as Console)
                .setHeaders({ "X-App": "MyApp", "X-Version": "1.0.0" });

            expect(mockConsole.log).toHaveBeenCalledWith("[Mail] Default headers updated", {
                count: 2,
                headers: ["X-App", "X-Version"],
            });
        });
    });

    describe("send() logging", () => {
        it("logs a debug line and sets the logger on a MailMessage", async () => {
            expect.assertions(2);

            const mail = createMail(createMockProvider()).setLogger(mockConsole as unknown as Console);
            const message = new MailMessage().to("user@example.com").from("sender@example.com").subject("Hi").html("<p>Hi</p>");
            const setLoggerSpy = vi.spyOn(message, "setLogger");

            await mail.send(message);

            expect(mockConsole.log).toHaveBeenCalledWith("[Mail] Sending MailMessage instance");
            expect(setLoggerSpy).toHaveBeenCalledWith(mockConsole);
        });

        it("logs a debug line when sending raw email options", async () => {
            expect.assertions(2);

            const mail = createMail(createMockProvider()).setLogger(mockConsole as unknown as Console);

            await mail.send({
                from: { email: "sender@example.com" },
                html: "<p>Hi</p>",
                subject: "Hi",
                to: [{ email: "a@example.com" }, { email: "b@example.com" }],
            });

            expect(mockConsole.log).toHaveBeenCalledWith("[Mail] Sending email with options", { subject: "Hi", to: 2 });
            expect(mockConsole.info).toHaveBeenCalledWith("[Mail] Email sent successfully", {
                messageId: "test-message-id",
                provider: "mock",
            });
        });

        it("logs an error when the provider reports a failure", async () => {
            expect.assertions(2);

            const mail = createMail(createMockProvider({ result: { error: new Error("send boom"), success: false } })).setLogger(
                mockConsole as unknown as Console,
            );

            const result = await mail.send({
                from: { email: "sender@example.com" },
                subject: "Hi",
                text: "Hi",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(mockConsole.error).toHaveBeenCalledWith("[Mail] Email send failed", {
                error: expect.any(Error),
                provider: "mock",
            });
        });

        it("throws when given a DraftMailMessage", async () => {
            expect.assertions(1);

            const mail = createMail(createMockProvider());
            const draft = new DraftMailMessage().to("user@example.com").from("sender@example.com").subject("Hi").html("<p>Hi</p>");

            await expect(mail.send(draft)).rejects.toThrow(TypeError);
        });
    });

    describe("sendMany()", () => {
        const buildOptions = (to: string): EmailOptions => {
            return {
                from: { email: "sender@example.com" },
                html: "<p>Hi</p>",
                subject: "Hi",
                to: { email: to },
            };
        };

        it("yields successful receipts for each message and logs progress", async () => {
            expect.assertions(4);

            const mail = createMail(createMockProvider()).setLogger(mockConsole as unknown as Console);
            const receipts = [];

            for await (const receipt of mail.sendMany([buildOptions("a@example.com"), buildOptions("b@example.com")])) {
                receipts.push(receipt);
            }

            expect(receipts).toHaveLength(2);
            expect(receipts.every((r) => r.successful)).toBe(true);
            expect(mockConsole.log).toHaveBeenCalledWith("[Mail] Starting batch email send", { provider: "mock" });
            expect(mockConsole.log).toHaveBeenCalledWith("[Mail] Batch email send completed", {
                failureCount: 0,
                processedCount: 2,
                provider: "mock",
                successCount: 2,
            });
        });

        it("yields a failure receipt with extracted Error messages", async () => {
            expect.assertions(3);

            const mail = createMail(createMockProvider({ result: { error: new Error("nope"), success: false } })).setLogger(mockConsole as unknown as Console);
            const receipts = [];

            for await (const receipt of mail.sendMany([buildOptions("a@example.com")])) {
                receipts.push(receipt);
            }

            expect(receipts).toHaveLength(1);
            expect(receipts[0].successful).toBe(false);
            expect((receipts[0] as { errorMessages: string[] }).errorMessages).toStrictEqual(["nope"]);
        });

        it("stringifies non-Error failures", async () => {
            expect.assertions(1);

            const mail = createMail(createMockProvider({ result: { error: "string failure", success: false } }));
            const receipts = [];

            for await (const receipt of mail.sendMany([buildOptions("a@example.com")])) {
                receipts.push(receipt);
            }

            expect((receipts[0] as { errorMessages: string[] }).errorMessages).toStrictEqual(["string failure"]);
        });

        it("catches exceptions thrown by the provider", async () => {
            expect.assertions(2);

            const mail = createMail(createMockProvider({ throwError: new Error("exploded") })).setLogger(mockConsole as unknown as Console);
            const receipts = [];

            for await (const receipt of mail.sendMany([buildOptions("a@example.com")])) {
                receipts.push(receipt);
            }

            expect(receipts[0].successful).toBe(false);
            expect((receipts[0] as { errorMessages: string[] }).errorMessages).toStrictEqual(["exploded"]);
        });

        it("stops and yields an aborted receipt when the signal is aborted", async () => {
            expect.assertions(3);

            const mail = createMail(createMockProvider()).setLogger(mockConsole as unknown as Console);
            const controller = new AbortController();

            controller.abort();

            const receipts = [];

            for await (const receipt of mail.sendMany([buildOptions("a@example.com")], { signal: controller.signal })) {
                receipts.push(receipt);
            }

            expect(receipts).toHaveLength(1);
            expect((receipts[0] as { errorMessages: string[] }).errorMessages).toStrictEqual(["Send operation was aborted"]);
            expect(mockConsole.warn).toHaveBeenCalledWith("[Mail] Batch send operation was aborted", {
                failed: 0,
                processed: 0,
                successful: 0,
            });
        });

        it("throws when a DraftMailMessage is included", async () => {
            expect.assertions(1);

            const mail = createMail(createMockProvider());
            const draft = new DraftMailMessage().to("user@example.com").from("sender@example.com").subject("Hi").html("<p>Hi</p>");

            const iterate = async (): Promise<Receipt[]> => {
                const receipts: Receipt[] = [];

                for await (const receipt of mail.sendMany([draft])) {
                    receipts.push(receipt);
                }

                return receipts;
            };

            await expect(iterate()).rejects.toThrow(TypeError);
        });
    });

    describe("draft() logging", () => {
        it("logs debug lines when creating a draft from a MailMessage", async () => {
            expect.assertions(2);

            const mail = createMail(createMockProvider()).setLogger(mockConsole as unknown as Console);
            const message = new MailMessage().to("user@example.com").from("sender@example.com").subject("Hi").html("<p>Hi</p>");

            await mail.draft(message);

            expect(mockConsole.log).toHaveBeenCalledWith("[Mail] Creating draft from MailMessage instance");
            expect(mockConsole.log).toHaveBeenCalledWith("[Mail] Draft created successfully in EML format", expect.objectContaining({ subject: "Hi" }));
        });

        it("logs debug lines when creating a draft from email options", async () => {
            expect.assertions(1);

            const mail = createMail(createMockProvider()).setLogger(mockConsole as unknown as Console);

            await mail.draft({
                from: { email: "sender@example.com" },
                html: "<p>Hi</p>",
                subject: "Hi",
                to: { email: "user@example.com" },
            });

            expect(mockConsole.log).toHaveBeenCalledWith("[Mail] Creating draft from email options", { subject: "Hi", to: 1 });
        });
    });

    describe("global configuration merge", () => {
        it("applies global from, reply-to and headers to email options and logs", async () => {
            expect.assertions(4);

            const provider = createMockProvider();
            const sendEmailSpy = vi.spyOn(provider, "sendEmail");
            const mail = createMail(provider)
                .setLogger(mockConsole as unknown as Console)
                .setFrom({ email: "global@example.com" })
                .setReplyTo({ email: "reply@example.com" })
                .setHeaders({ "X-Global": "yes" });

            await mail.send({
                subject: "Hi",
                text: "Hi",
                to: { email: "user@example.com" },
            } as never);

            const [[sent]] = sendEmailSpy.mock.calls;

            expect(sent.from).toStrictEqual({ email: "global@example.com" });
            expect(sent.replyTo).toStrictEqual({ email: "reply@example.com" });
            expect((sent.headers as Record<string, string>)["X-Global"]).toBe("yes");
            expect(mockConsole.log).toHaveBeenCalledWith("[Mail] Applied global reply-to address", { replyTo: "reply@example.com" });
        });

        it("does not override values already present on the email options", async () => {
            expect.assertions(2);

            const provider = createMockProvider();
            const sendEmailSpy = vi.spyOn(provider, "sendEmail");
            const mail = createMail(provider).setFrom({ email: "global@example.com" }).setReplyTo({ email: "reply@example.com" });

            await mail.send({
                from: { email: "explicit@example.com" },
                replyTo: { email: "explicit-reply@example.com" },
                subject: "Hi",
                text: "Hi",
                to: { email: "user@example.com" },
            });

            const [[sent]] = sendEmailSpy.mock.calls;

            expect(sent.from).toStrictEqual({ email: "explicit@example.com" });
            expect(sent.replyTo).toStrictEqual({ email: "explicit-reply@example.com" });
        });

        it("applies a global reply-to to a MailMessage draft when none is set", async () => {
            expect.assertions(1);

            const mail = createMail(createMockProvider()).setReplyTo({ email: "global-reply@example.com" });
            const message = new MailMessage().to("user@example.com").from("sender@example.com").subject("Hi").html("<p>Hi</p>");

            const eml = await mail.draft(message);

            expect(eml).toContain("global-reply@example.com");
        });
    });
});
