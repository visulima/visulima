import { describe, expect, it } from "vitest";

import MailMessage from "../src/mail-message";

describe(MailMessage, () => {
    describe("fluent interface", () => {
        it("should chain methods", () => {
            expect.assertions(1);

            const message = new MailMessage();

            const result = message.to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            expect(result).toBe(message);
        });

        it("should build email options", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            const options = await message.build();

            expect(options).toStrictEqual({
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                text: undefined, // May be undefined if htmlToText conversion fails
                to: { email: "user@example.com" },
            });
        });
    });

    describe("from()", () => {
        it("should accept string email", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Test</h1>");

            const built = await message.build();

            expect(built.from).toStrictEqual({ email: "sender@example.com" });
        });

        it("should accept EmailAddress object", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from({ email: "sender@example.com", name: "Sender" }).to("user@example.com").subject("Test").html("<h1>Test</h1>");

            const built = await message.build();

            expect(built.from).toStrictEqual({ email: "sender@example.com", name: "Sender" });
        });
    });

    describe("to()", () => {
        it("should accept string email", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Test</h1>");

            const options = await message.build();

            expect(options.to).toStrictEqual({ email: "user@example.com" });
        });

        it("should accept array of strings", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to(["user1@example.com", "user2@example.com"]).subject("Test").html("<h1>Test</h1>");

            const options = await message.build();

            expect(options.to).toStrictEqual([{ email: "user1@example.com" }, { email: "user2@example.com" }]);
        });

        it("should accept EmailAddress object", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to({ email: "user@example.com", name: "User" }).subject("Test").html("<h1>Test</h1>");

            const options = await message.build();

            expect(options.to).toStrictEqual({ email: "user@example.com", name: "User" });
        });
    });

    describe("cc() and bcc()", () => {
        it("should set CC recipients", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Test</h1>").cc("cc@example.com");

            const options = await message.build();

            expect(options.cc).toStrictEqual({ email: "cc@example.com" });
        });

        it("should set BCC recipients", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Test</h1>").bcc("bcc@example.com");

            const options = await message.build();

            expect(options.bcc).toStrictEqual({ email: "bcc@example.com" });
        });
    });

    describe("subject()", () => {
        it("should set subject", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to("user@example.com").subject("Test Subject").html("<h1>Test</h1>");

            const built = await message.build();

            expect(built.subject).toBe("Test Subject");
        });
    });

    describe("text() and html()", () => {
        it("should set text content", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to("user@example.com").subject("Test").text("Plain text");

            const options = await message.build();

            expect(options.text).toBe("Plain text");
        });

        it("should set HTML content", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>HTML</h1>");

            const options = await message.build();

            expect(options.html).toBe("<h1>HTML</h1>");
        });
    });

    describe("attach()", () => {
        it("should add attachment", async () => {
            expect.assertions(2);

            const message = new MailMessage();

            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Test</h1>").attachData("content", { filename: "file.txt" });

            const options = await message.build();

            expect(options.attachments).toHaveLength(1);
            expect(options.attachments?.[0]).toStrictEqual({
                cid: undefined,
                content: "content",
                contentDisposition: "attachment",
                contentType: "text/plain",
                encoding: undefined,
                filename: "file.txt",
                headers: undefined,
            });
        });
    });

    describe("build() validation", () => {
        it("should throw error if from is missing", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.to("user@example.com").subject("Test").html("<h1>Test</h1>");

            await expect(message.build()).rejects.toThrow("From address is required");
        });

        it("should throw error if to is missing", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").subject("Test").html("<h1>Test</h1>");

            await expect(message.build()).rejects.toThrow("At least one recipient is required");
        });

        it("should throw error if subject is missing", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.to("user@example.com").from("sender@example.com").html("<h1>Test</h1>");

            await expect(message.build()).rejects.toThrow("Subject is required");
        });

        it("should throw error if neither text nor html is provided", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.to("user@example.com").from("sender@example.com").subject("Test");

            await expect(message.build()).rejects.toThrow("Either text or html content is required");
        });
    });
});
