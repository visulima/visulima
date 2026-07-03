import { describe, expect, it } from "vitest";

import type { EmailOptions } from "../../src/types";
import buildMimeMessage from "../../src/utils/build-mime-message";
import parseEml from "../../src/utils/parse-eml";

describe(parseEml, () => {
    it("should round-trip a message built by buildMimeMessage", async () => {
        expect.assertions(5);

        const options: EmailOptions = {
            from: { email: "sender@example.com", name: "Sender" },
            html: "<p>Hello world</p>",
            subject: "Round trip subject",
            text: "Hello world",
            to: { email: "recipient@example.com" },
        };

        const eml = await buildMimeMessage(options, { includeBcc: true });
        const parsed = parseEml(eml);

        expect(parsed.from).toStrictEqual({ email: "sender@example.com", name: "Sender" });
        expect(parsed.to).toStrictEqual({ email: "recipient@example.com" });
        expect(parsed.subject).toBe("Round trip subject");
        expect(parsed.text).toBe("Hello world");
        expect(parsed.html).toBe("<p>Hello world</p>");
    });

    it("should round-trip a non-ASCII subject and quoted-printable body", async () => {
        expect.assertions(2);

        const eml = await buildMimeMessage({
            from: { email: "a@example.com" },
            subject: "Grüße aus München",
            text: "Grüße",
            to: { email: "b@example.com" },
        });

        const parsed = parseEml(eml);

        expect(parsed.subject).toBe("Grüße aus München");
        expect(parsed.text).toBe("Grüße");
    });

    it("should parse multiple to/cc recipients", async () => {
        expect.assertions(2);

        const eml = await buildMimeMessage({
            cc: { email: "cc@example.com", name: "CC" },
            from: { email: "a@example.com" },
            subject: "x",
            text: "hi",
            to: [{ email: "b@example.com" }, { email: "c@example.com" }],
        });

        const parsed = parseEml(eml);

        expect(parsed.to).toStrictEqual([{ email: "b@example.com" }, { email: "c@example.com" }]);
        expect(parsed.cc).toStrictEqual({ email: "cc@example.com", name: "CC" });
    });

    it("should throw when From is missing", () => {
        expect.assertions(1);

        expect(() => parseEml("To: a@example.com\r\nSubject: x\r\n\r\nbody")).toThrow("From");
    });

    it("should throw when no recipient is present", () => {
        expect.assertions(1);

        expect(() => parseEml("From: a@example.com\r\nSubject: x\r\n\r\nbody")).toThrow("recipient");
    });

    it("should parse a simple single-part text message", () => {
        expect.assertions(2);

        const parsed = parseEml("From: a@example.com\r\nTo: b@example.com\r\nSubject: Hi\r\nContent-Type: text/plain\r\n\r\nplain body");

        expect(parsed.subject).toBe("Hi");
        expect(parsed.text).toBe("plain body");
    });
});
