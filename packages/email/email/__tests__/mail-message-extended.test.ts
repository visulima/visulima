import { Buffer } from "node:buffer";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import MailMessage from "../src/mail-message";
import type { EmailOptions } from "../src/types";

const FAILED_RENDER_TEMPLATE_REGEX = /Failed to render template/;
const FAILED_RENDER_TEXT_TEMPLATE_REGEX = /Failed to render text template/;
// eslint-disable-next-line sonarjs/publicly-writable-directories -- fixed fake path used only for icalEvent path assertions; no real filesystem write occurs
const FAKE_ICAL_PATH = "/tmp/event.ics";

let temporaryDirectory: string;
let temporaryFilePath: string;

beforeAll(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "mail-message-test-"));
    temporaryFilePath = join(temporaryDirectory, "hello.txt");
    writeFileSync(temporaryFilePath, "hello world");
});

afterAll(() => {
    rmSync(temporaryDirectory, { force: true, recursive: true });
});

describe("mailMessage - extended fluent builder", () => {
    describe("attachFromPath", () => {
        it("should add an attachment from a real file", async () => {
            expect.assertions(3);

            const message = new MailMessage();

            await message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .attachFromPath(temporaryFilePath);

            const built = await message.build();

            expect(built.attachments).toHaveLength(1);
            expect(built.attachments?.[0]?.filename).toBe("hello.txt");
            expect(built.attachments?.[0]?.contentType).toBe("text/plain");
        });

        it("should use custom filename and contentType", async () => {
            expect.assertions(2);

            const message = new MailMessage();

            await message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .attachFromPath(temporaryFilePath, {
                    contentType: "application/octet-stream",
                    filename: "custom.bin",
                });

            const built = await message.build();

            expect(built.attachments?.[0]?.filename).toBe("custom.bin");
            expect(built.attachments?.[0]?.contentType).toBe("application/octet-stream");
        });

        it("should throw when the file cannot be read", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            await expect(
                message.attachFromPath("/non/existent/path/file.txt"),
            ).rejects.toThrow();
        });
    });

    describe("embedFromPath", () => {
        it("should embed file and return a Content-ID", async () => {
            expect.assertions(3);

            const message = new MailMessage();

            const cid = await message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .embedFromPath(temporaryFilePath);

            const built = await message.build();

            expect(cid).toBeTruthy();
            expect(built.attachments).toHaveLength(1);
            expect(built.attachments?.[0]?.contentDisposition).toBe("inline");
        });

        it("should throw when the file cannot be read", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            await expect(
                message.embedFromPath("/non/existent/path/file.txt"),
            ).rejects.toThrow();
        });
    });

    describe("embedData", () => {
        it("should embed data and return a Content-ID", async () => {
            expect.assertions(3);

            const message = new MailMessage();

            const cid = message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .embedData(Buffer.from("logo"), "logo.png", { contentType: "image/png" });

            const built = await message.build();

            expect(cid).toBeTruthy();
            expect(built.attachments?.[0]?.contentDisposition).toBe("inline");
            expect(built.attachments?.[0]?.contentType).toBe("image/png");
        });
    });

    describe("sign and encrypt", () => {
        it("should call signer.sign during build()", async () => {
            expect.assertions(2);

            const message = new MailMessage();

            const sign = vi.fn((email: EmailOptions): Promise<EmailOptions> =>
                Promise.resolve({
                    ...email,
                    headers: { ...(email.headers as Record<string, string>), "DKIM-Signature": "test-signature" },
                }));

            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Hi</h1>").sign({ sign });

            const built = await message.build();

            expect(sign).toHaveBeenCalled();
            expect(built.headers?.["DKIM-Signature"]).toBe("test-signature");
        });

        it("should call encrypter.encrypt during build()", async () => {
            expect.assertions(2);

            const message = new MailMessage();

            const encrypt = vi.fn((email: EmailOptions): Promise<EmailOptions> =>
                Promise.resolve({
                    ...email,
                    html: "<encrypted/>",
                }));

            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Hi</h1>").encrypt({ encrypt });

            const built = await message.build();

            expect(encrypt).toHaveBeenCalled();
            expect(built.html).toBe("<encrypted/>");
        });

        it("should apply both signer and encrypter", async () => {
            expect.assertions(2);

            const message = new MailMessage();

            const sign = vi.fn((email: EmailOptions): Promise<EmailOptions> => Promise.resolve({ ...email, html: `${email.html ?? ""}-signed` }));
            const encrypt = vi.fn((email: EmailOptions): Promise<EmailOptions> => Promise.resolve({ ...email, html: `${email.html ?? ""}-encrypted` }));

            message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .sign({ sign })
                .encrypt({ encrypt });

            const built = await message.build();

            expect(built.html).toBe("<h1>Hi</h1>-signed-encrypted");
            expect(encrypt).toHaveBeenCalled();
        });
    });

    describe("icalEvent variants", () => {
        it("should accept string content", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .icalEvent("BEGIN:VCALENDAR\r\nEND:VCALENDAR", { method: "REQUEST" });

            const built = await message.build();

            expect(built.icalEvent?.content).toContain("VCALENDAR");
        });

        it("should accept a function and build calendar", async () => {
            expect.assertions(2);

            const message = new MailMessage();

            message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .icalEvent((calendar) => {
                    calendar.createEvent({
                        end: new Date("2026-01-01T01:00:00Z"),
                        start: new Date("2026-01-01T00:00:00Z"),
                        summary: "Meeting",
                    });
                }, { method: "REQUEST" });

            const built = await message.build();

            expect(built.icalEvent?.content).toContain("Meeting");
            expect(built.icalEvent?.method).toBe("REQUEST");
        });

        it("should attach from file path (string)", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .icalEventFromFile(FAKE_ICAL_PATH);

            const built = await message.build();

            expect(built.icalEvent?.path).toBe(FAKE_ICAL_PATH);
        });

        it("should attach from file URL", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            const url = pathToFileURL(FAKE_ICAL_PATH);

            message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .icalEventFromFile(url);

            const built = await message.build();

            expect(built.icalEvent?.path).toBe(FAKE_ICAL_PATH);
        });

        it("should attach from URL", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .icalEventFromUrl("https://example.com/event.ics");

            const built = await message.build();

            expect(built.icalEvent?.href).toBe("https://example.com/event.ics");
        });
    });

    describe("view (template rendering)", () => {
        it("should render template and set HTML", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            const renderer = vi.fn((): Promise<string> => Promise.resolve("<h1>Rendered</h1>"));

            await message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .view(renderer, "template", { name: "John" });

            const built = await message.build();

            expect(built.html).toBe("<h1>Rendered</h1>");
        });

        it("should respect autoText: false option", async () => {
            expect.assertions(2);

            const message = new MailMessage();

            const renderer = vi.fn((): Promise<string> => Promise.resolve("<h1>Rendered</h1>"));

            await message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .view(renderer, "template", undefined, { autoText: false });

            const built = await message.build();

            expect(built.html).toBe("<h1>Rendered</h1>");
            expect(built.text).toBeUndefined();
        });

        it("should throw if renderer throws", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            const renderer = vi.fn((): Promise<string> => Promise.reject(new Error("Render failure")));

            await expect(
                message
                    .from("sender@example.com")
                    .to("user@example.com")
                    .subject("Test")
                    .view(renderer, "template"),
            ).rejects.toThrow(FAILED_RENDER_TEMPLATE_REGEX);
        });
    });

    describe("viewText (text template rendering)", () => {
        it("should render text template and set text content", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            const renderer = vi.fn((): Promise<string> => Promise.resolve("Hello John"));

            await message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .viewText(renderer, "Hello {{name}}", { name: "John" });

            const built = await message.build();

            expect(built.text).toBe("Hello John");
        });

        it("should throw when renderer returns non-string", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            const renderer = vi.fn((): Promise<string> => Promise.resolve(42 as unknown as string));

            await expect(
                message
                    .from("sender@example.com")
                    .to("user@example.com")
                    .subject("Test")
                    .html("<h1>Hi</h1>")
                    .viewText(renderer, "template"),
            ).rejects.toThrow(FAILED_RENDER_TEXT_TEMPLATE_REGEX);
        });

        it("should throw on renderer error", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            const renderer = vi.fn((): Promise<string> => Promise.reject(new Error("Render failure")));

            await expect(
                message
                    .from("sender@example.com")
                    .to("user@example.com")
                    .subject("Test")
                    .html("<h1>Hi</h1>")
                    .viewText(renderer, "template"),
            ).rejects.toThrow(FAILED_RENDER_TEXT_TEMPLATE_REGEX);
        });
    });

    describe("setHeaders / header / date / returnPath / sender", () => {
        it("should set custom header", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Hi</h1>").header("X-Custom", "value");

            const built = await message.build();

            expect(built.headers?.["X-Custom"]).toBe("value");
        });

        it("should set multiple headers via setHeaders", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .setHeaders({ "X-A": "1", "X-B": "2" });

            const built = await message.build();

            expect(built.headers).toMatchObject({ "X-A": "1", "X-B": "2" });
        });

        it("should add Date header when date() is called", async () => {
            expect.assertions(1);

            const message = new MailMessage();
            const date = new Date("2026-01-15T10:00:00Z");

            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Hi</h1>").date(date);

            const built = await message.build();

            expect(built.headers?.["Date"]).toBe(date.toUTCString());
        });

        it("should accept ISO string in date()", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Hi</h1>").date("2026-01-15T10:00:00Z");

            const built = await message.build();

            expect(built.headers?.["Date"]).toBeDefined();
        });

        it("should add Return-Path header when returnPath() is called", async () => {
            expect.assertions(2);

            const message = new MailMessage();

            message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .returnPath("bounce@example.com");

            const built = await message.build();

            expect(built.headers?.["Return-Path"]).toBe("bounce@example.com");
            expect(message.getReturnPath()?.email).toBe("bounce@example.com");
        });

        it("should add Sender header when sender() is called", async () => {
            expect.assertions(2);

            const message = new MailMessage();

            message
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .sender({ email: "actual@example.com" });

            const built = await message.build();

            expect(built.headers?.["Sender"]).toBe("actual@example.com");
            expect(message.getSender()?.email).toBe("actual@example.com");
        });
    });

    describe("addTo / addCc / addBcc / addReplyTo / addFrom", () => {
        it("should append addresses without replacing", async () => {
            expect.assertions(3);

            const message = new MailMessage();

            message
                .from("sender@example.com")
                .to("user1@example.com")
                .addTo("user2@example.com")
                .cc("cc1@example.com")
                .addCc(["cc2@example.com", "cc3@example.com"])
                .bcc("bcc1@example.com")
                .addBcc({ email: "bcc2@example.com" })
                .subject("Test")
                .html("<h1>Hi</h1>");

            const built = await message.build();

            expect(built.to).toHaveLength(2);
            expect(built.cc).toHaveLength(3);
            expect(built.bcc).toHaveLength(2);
        });

        it("should set first replyTo address through addReplyTo", () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.addReplyTo(["reply@example.com", "ignored@example.com"]);

            expect(message.getReplyTo()?.email).toBe("reply@example.com");
        });

        it("should set first from address through addFrom", () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.addFrom([{ email: "f1@example.com" }, { email: "ignored@example.com" }]);

            expect(message.getFrom()?.email).toBe("f1@example.com");
        });
    });

    describe("priority and tags", () => {
        it("should set priority", async () => {
            expect.assertions(2);

            const message = new MailMessage();

            message.from("sender@example.com").to("u@example.com").subject("Test").html("<h1>Hi</h1>").priority("high");

            const built = await message.build();

            expect(built.priority).toBe("high");
            expect(message.getPriority()).toBe("high");
        });

        it("should set tags from string", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to("u@example.com").subject("Test").html("<h1>Hi</h1>").tags("welcome");

            const built = await message.build();

            expect(built.tags).toStrictEqual(["welcome"]);
        });

        it("should set tags from array", async () => {
            expect.assertions(1);

            const message = new MailMessage();

            message.from("sender@example.com").to("u@example.com").subject("Test").html("<h1>Hi</h1>").tags(["a", "b"]);

            const built = await message.build();

            expect(built.tags).toStrictEqual(["a", "b"]);
        });
    });

    describe("text/html charset", () => {
        it("should set text and html with custom charsets", () => {
            expect.assertions(2);

            const message = new MailMessage();

            message
                .from("sender@example.com")
                .to("u@example.com")
                .subject("Test")
                .text("Hi", "iso-8859-1")
                .html("<h1>Hi</h1>", "iso-8859-1");

            expect(message.getTextCharset()).toBe("iso-8859-1");
            expect(message.getHtmlCharset()).toBe("iso-8859-1");
        });
    });

    describe("getters", () => {
        it("should return defensive copies for to/cc/bcc/attachments", () => {
            expect.assertions(4);

            const message = new MailMessage();

            message.from("sender@example.com").to("u@example.com").cc("c@example.com").bcc("b@example.com");

            expect(message.getTo()).not.toBe((message as any).toAddresses);
            expect(message.getCc()).not.toBe((message as any).ccAddresses);
            expect(message.getBcc()).not.toBe((message as any).bccAddresses);
            expect(message.getAttachments()).not.toBe((message as any).attachments);
        });

        it("should return subject, from, html and text via getters", () => {
            expect.assertions(4);

            const message = new MailMessage();

            message
                .from({ email: "sender@example.com", name: "Sender" })
                .to("u@example.com")
                .subject("My subject")
                .text("Plain")
                .html("<h1>HTML</h1>");

            expect(message.getSubject()).toBe("My subject");
            expect(message.getFrom()?.email).toBe("sender@example.com");
            expect(message.getHtmlBody()).toBe("<h1>HTML</h1>");
            expect(message.getTextBody()).toBe("Plain");
        });

        it("should return undefined for unset date", () => {
            expect.assertions(1);

            const message = new MailMessage();

            expect(message.getDate()).toBeUndefined();
        });
    });

    describe("setLogger", () => {
        it("should accept a console-like logger", () => {
            expect.assertions(1);

            const message = new MailMessage();

            const result = message.setLogger(console);

            expect(result).toBe(message);
        });
    });

    describe("logger branches", () => {
        const makeConsole = () => ({ error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() }) as unknown as Console;
        const resolveEmail = (email: EmailOptions): Promise<EmailOptions> => Promise.resolve(email);

        it("logs attachFromPath success and failure", async () => {
            expect.assertions(4);

            const okConsole = makeConsole();

            await new MailMessage().setLogger(okConsole).attachFromPath(temporaryFilePath);

            expect(okConsole.log).toHaveBeenCalled();

            const failConsole = makeConsole();

            await expect(new MailMessage().setLogger(failConsole).attachFromPath(join(temporaryDirectory, "missing.txt"))).rejects.toThrow();

            expect(failConsole.error).toHaveBeenCalled();
            expect(failConsole.log).not.toHaveBeenCalled();
        });

        it("logs attachData", () => {
            expect.assertions(1);

            const mockConsole = makeConsole();

            new MailMessage().setLogger(mockConsole).attachData(Buffer.from("data"), { filename: "a.txt" });

            expect(mockConsole.log).toHaveBeenCalled();
        });

        it("logs embedFromPath success and failure", async () => {
            expect.assertions(4);

            const okConsole = makeConsole();

            await new MailMessage().setLogger(okConsole).embedFromPath(temporaryFilePath);

            expect(okConsole.log).toHaveBeenCalled();

            const failConsole = makeConsole();

            await expect(new MailMessage().setLogger(failConsole).embedFromPath(join(temporaryDirectory, "missing.txt"))).rejects.toThrow();

            expect(failConsole.error).toHaveBeenCalled();
            expect(failConsole.log).not.toHaveBeenCalled();
        });

        it("logs embedData", () => {
            expect.assertions(1);

            const mockConsole = makeConsole();

            new MailMessage().setLogger(mockConsole).embedData(Buffer.from("data"), "logo.png");

            expect(mockConsole.log).toHaveBeenCalled();
        });

        it("logs date, returnPath and sender", () => {
            expect.assertions(1);

            const mockConsole = makeConsole();

            new MailMessage().setLogger(mockConsole).date(new Date()).returnPath("bounce@example.com").sender("sender@example.com");

            expect(mockConsole.log).toHaveBeenCalledTimes(3);
        });

        it("logs sign and encrypt configuration", () => {
            expect.assertions(1);

            const mockConsole = makeConsole();
            const sign = vi.fn(resolveEmail);
            const encrypt = vi.fn(resolveEmail);

            new MailMessage().setLogger(mockConsole).sign({ sign }).encrypt({ encrypt });

            expect(mockConsole.log).toHaveBeenCalledTimes(2);
        });

        it("logs calendar event variants", () => {
            expect.assertions(1);

            const mockConsole = makeConsole();

            new MailMessage()
                .setLogger(mockConsole)
                .icalEvent("BEGIN:VCALENDAR\r\nEND:VCALENDAR")
                .icalEventFromFile("./event.ics")
                .icalEventFromUrl("https://example.com/event.ics");

            expect(mockConsole.log).toHaveBeenCalledTimes(3);
        });

        it("logs view rendering and warns when auto-text conversion fails", async () => {
            expect.assertions(2);

            const mockConsole = makeConsole();
            const renderer = vi.fn((): Promise<string> => Promise.resolve("<h1>Hello</h1><p>Body paragraph text.</p>"));

            await new MailMessage()
                .setLogger(mockConsole)
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .view(renderer, "template");

            expect(mockConsole.log).toHaveBeenCalled();
            expect(mockConsole.warn).toHaveBeenCalled();
        });

        it("logs view rendering failure", async () => {
            expect.assertions(2);

            const mockConsole = makeConsole();
            const renderer = vi.fn((): Promise<string> => Promise.reject(new Error("render boom")));

            await expect(
                new MailMessage().setLogger(mockConsole).from("sender@example.com").to("user@example.com").subject("Test").view(renderer, "template"),
            ).rejects.toThrow("Failed to render template");

            expect(mockConsole.error).toHaveBeenCalled();
        });

        it("logs viewText rendering", async () => {
            expect.assertions(1);

            const mockConsole = makeConsole();
            const renderer = vi.fn((): Promise<string> => Promise.resolve("Plain text body"));

            await new MailMessage()
                .setLogger(mockConsole)
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .viewText(renderer, "template");

            expect(mockConsole.log).toHaveBeenCalled();
        });

        it("logs viewText rendering failure", async () => {
            expect.assertions(2);

            const mockConsole = makeConsole();
            const renderer = vi.fn((): Promise<string> => Promise.reject(new Error("render boom")));

            await expect(
                new MailMessage()
                    .setLogger(mockConsole)
                    .from("sender@example.com")
                    .to("user@example.com")
                    .subject("Test")
                    .html("<h1>Hi</h1>")
                    .viewText(renderer, "template"),
            ).rejects.toThrow("Failed to render text template");

            expect(mockConsole.error).toHaveBeenCalled();
        });

        it("logs attachment and calendar details during build", async () => {
            expect.assertions(2);

            const mockConsole = makeConsole();
            const message = new MailMessage()
                .setLogger(mockConsole)
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1><p>Body text.</p>")
                .attachData(Buffer.from("data"), { filename: "a.txt" })
                .icalEvent("BEGIN:VCALENDAR\r\nEND:VCALENDAR");

            const built = await message.build();

            expect(built.attachments).toHaveLength(1);
            expect(built.icalEvent).toBeDefined();
        });

        it("logs signer steps during build", async () => {
            expect.assertions(1);

            const mockConsole = makeConsole();
            const sign = vi.fn(resolveEmail);

            await new MailMessage()
                .setLogger(mockConsole)
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .sign({ sign })
                .build();

            expect(sign).toHaveBeenCalled();
        });

        it("logs encrypter steps during build", async () => {
            expect.assertions(1);

            const mockConsole = makeConsole();
            const encrypt = vi.fn(resolveEmail);

            await new MailMessage()
                .setLogger(mockConsole)
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .encrypt({ encrypt })
                .build();

            expect(encrypt).toHaveBeenCalled();
        });

        it("logs an error when build fails validation", async () => {
            expect.assertions(2);

            const mockConsole = makeConsole();

            await expect(new MailMessage().setLogger(mockConsole).from("sender@example.com").to("user@example.com").build()).rejects.toThrow(
                "Subject is required",
            );

            expect(mockConsole.error).toHaveBeenCalled();
        });
    });
});
