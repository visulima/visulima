import { describe, expect, it } from "vitest";

import {
    extractReply,
    normalizeSubject,
    parseAddress,
    parseAddressList,
    parseCloudflareInbound,
    parseMailgunInbound,
    parsePostmarkInbound,
    parseSendGridInbound,
    parseSesInbound,
    stitchThreads,
} from "../../src/inbound";
import type { InboundEmail } from "../../src/inbound";

const baseMessage = (overrides: Partial<InboundEmail>): InboundEmail => ({
    attachments: [],
    bcc: [],
    cc: [],
    headers: {},
    provider: "test",
    references: [],
    to: [],
    ...overrides,
});

describe("inbound", () => {
    describe(extractReply, () => {
        it("strips an English quoted reply", () => {
            expect.assertions(1);

            const body = [
                "Thanks, that works for me!",
                "",
                "On Mon, Jan 1, 2024 at 10:00 AM, John Doe <john@example.com> wrote:",
                "> Are you available tomorrow?",
                "> Let me know.",
            ].join("\n");

            expect(extractReply(body)).toBe("Thanks, that works for me!");
        });

        it("strips a German attribution line", () => {
            expect.assertions(1);

            const body = ["Klingt gut.", "", "Am 01.01.2024 um 10:00 schrieb John Doe:", "> Passt dir morgen?"].join("\n");

            expect(extractReply(body)).toBe("Klingt gut.");
        });

        it("strips an Outlook original-message block", () => {
            expect.assertions(1);

            const body = ["My answer is yes.", "", "-----Original Message-----", "From: John", "Sent: yesterday"].join("\n");

            expect(extractReply(body)).toBe("My answer is yes.");
        });

        it("strips a signature when requested", () => {
            expect.assertions(2);

            const body = ["See you then.", "", "-- ", "John Doe", "CEO"].join("\n");

            expect(extractReply(body)).toBe("See you then.");
            expect(extractReply(body, { stripSignature: false })).toContain("John Doe");
        });
    });

    describe(stitchThreads, () => {
        it("groups messages by In-Reply-To / References", () => {
            expect.assertions(2);

            const messages = [
                baseMessage({ messageId: "<a@x>", subject: "Hi" }),
                baseMessage({ inReplyTo: "<a@x>", messageId: "<b@x>", references: ["<a@x>"], subject: "Re: Hi" }),
                baseMessage({ messageId: "<c@x>", subject: "Unrelated" }),
            ];

            const threads = stitchThreads(messages);

            expect(threads).toHaveLength(2);
            expect(threads.find((thread) => thread.messages.length === 2)).toBeDefined();
        });

        it("falls back to subject grouping when references are absent", () => {
            expect.assertions(1);

            const messages = [
                baseMessage({ messageId: "<a@x>", subject: "Project update" }),
                baseMessage({ messageId: "<b@x>", subject: "Re: Project update" }),
            ];

            const threads = stitchThreads(messages);

            expect(threads).toHaveLength(1);
        });
    });

    describe(normalizeSubject, () => {
        it("strips reply/forward prefixes", () => {
            expect.assertions(2);
            expect(normalizeSubject("Re: Fwd: Hello")).toBe("hello");
            expect(normalizeSubject("AW: Test")).toBe("test");
        });
    });

    describe(parseAddress, () => {
        it("parses name and email", () => {
            expect.assertions(2);
            expect(parseAddress("John Doe <john@example.com>")).toStrictEqual({ email: "john@example.com", name: "John Doe" });
            expect(parseAddress("bare@example.com")).toStrictEqual({ email: "bare@example.com" });
        });

        it("splits a list respecting quoted commas", () => {
            expect.assertions(1);
            expect(parseAddressList('"Doe, John" <john@x.com>, jane@x.com')).toStrictEqual([
                { email: "john@x.com", name: "Doe, John" },
                { email: "jane@x.com" },
            ]);
        });
    });

    describe("provider parsers", () => {
        it("normalizes a Postmark payload", () => {
            expect.assertions(4);

            const result = parsePostmarkInbound({
                FromFull: { Email: "sender@x.com", Name: "Sender" },
                Headers: [{ Name: "In-Reply-To", Value: "<prev@x.com>" }],
                HtmlBody: "<p>hi</p>",
                MessageID: "abc-123",
                Subject: "Hello",
                TextBody: "hi",
                ToFull: [{ Email: "inbox@x.com" }],
            });

            expect(result.provider).toBe("postmark");
            expect(result.from).toStrictEqual({ email: "sender@x.com", name: "Sender" });
            expect(result.messageId).toBe("<abc-123>");
            expect(result.inReplyTo).toBe("<prev@x.com>");
        });

        it("normalizes a SendGrid payload", () => {
            expect.assertions(2);

            const result = parseSendGridInbound({
                from: "Sender <sender@x.com>",
                headers: "Message-Id: <m@x.com>\r\nReferences: <a@x.com> <b@x.com>",
                subject: "Hello",
                text: "hi",
                to: "inbox@x.com",
            });

            expect(result.messageId).toBe("<m@x.com>");
            expect(result.references).toStrictEqual(["<a@x.com>", "<b@x.com>"]);
        });

        it("normalizes a Mailgun payload with JSON message-headers", () => {
            expect.assertions(2);

            const result = parseMailgunInbound({
                "body-plain": "full body",
                from: "Sender <sender@x.com>",
                "message-headers": JSON.stringify([["Message-Id", "<m@x.com>"]]),
                recipient: "inbox@x.com",
                "stripped-text": "stripped",
                subject: "Hello",
            });

            expect(result.text).toBe("stripped");
            expect(result.messageId).toBe("<m@x.com>");
        });

        it("normalizes a Cloudflare message with a Headers instance", () => {
            expect.assertions(2);

            const headers = new Headers({ "Message-ID": "<cf@x.com>", Subject: "Hello" });
            const result = parseCloudflareInbound({ from: "sender@x.com", headers, text: "hi", to: "inbox@x.com" });

            expect(result.provider).toBe("cloudflare");
            expect(result.subject).toBe("Hello");
        });

        it("normalizes an SES payload", () => {
            expect.assertions(2);

            const result = parseSesInbound({
                mail: {
                    commonHeaders: { from: ["Sender <sender@x.com>"], subject: "Hello", to: ["inbox@x.com"] },
                    messageId: "ses-msg-1",
                },
                text: "hi",
            });

            expect(result.messageId).toBe("<ses-msg-1>");
            expect(result.from).toStrictEqual({ email: "sender@x.com", name: "Sender" });
        });
    });
});
