import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { canonicalizeBody, canonicalizeHeader, signMessageWithDkim } from "../../src/providers/smtp/dkim";

const DKIM_SIGNATURE_VALUE_REGEX = /;\s*b=.+$/;

describe("smtp dkim canonicalization", () => {
    describe(canonicalizeHeader, () => {
        it("should lowercase the field name", () => {
            expect.assertions(1);

            expect(canonicalizeHeader("Subject: Hello")).toBe("subject:Hello");
        });

        it("should collapse internal whitespace runs to a single space", () => {
            expect.assertions(1);

            expect(canonicalizeHeader("Subject:   Hello    World")).toBe("subject:Hello World");
        });

        it("should unfold folded header values", () => {
            expect.assertions(1);

            expect(canonicalizeHeader("Subject: Hello\r\n World")).toBe("subject:Hello World");
        });

        it("should strip leading and trailing whitespace around the value", () => {
            expect.assertions(1);

            expect(canonicalizeHeader("Subject:  \t Hello \t ")).toBe("subject:Hello");
        });

        it("should trim and lowercase a header with no colon", () => {
            expect.assertions(1);

            expect(canonicalizeHeader("  Broken-Header  ")).toBe("broken-header:");
        });

        it("should keep an empty value after the colon", () => {
            expect.assertions(1);

            expect(canonicalizeHeader("X-Empty:")).toBe("x-empty:");
        });
    });

    describe(canonicalizeBody, () => {
        it("should normalize line endings to CRLF", () => {
            expect.assertions(1);

            expect(canonicalizeBody("line1\nline2")).toBe("line1\r\nline2\r\n");
        });

        it("should collapse whitespace runs within a line to a single space", () => {
            expect.assertions(1);

            expect(canonicalizeBody("a  \t  b\r\n")).toBe("a b\r\n");
        });

        it("should strip trailing whitespace per line", () => {
            expect.assertions(1);

            expect(canonicalizeBody("hello   \r\n")).toBe("hello\r\n");
        });

        it("should drop trailing empty lines and terminate with a single CRLF", () => {
            expect.assertions(1);

            expect(canonicalizeBody("body\r\n\r\n\r\n")).toBe("body\r\n");
        });

        it("should return an empty string for an empty body", () => {
            expect.assertions(1);

            expect(canonicalizeBody("")).toBe("");
        });

        it("should return an empty string when the body is only blank lines", () => {
            expect.assertions(1);

            expect(canonicalizeBody("\r\n   \r\n\t\r\n")).toBe("");
        });

        it("should preserve internal blank lines between content", () => {
            expect.assertions(1);

            expect(canonicalizeBody("a\r\n\r\nb\r\n")).toBe("a\r\n\r\nb\r\n");
        });
    });

    describe(signMessageWithDkim, () => {
        const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
        const pem = privateKey.export({ format: "pem", type: "pkcs1" });

        const dkim = {
            domainName: "example.com",
            keySelector: "default",
            privateKey: pem,
        };

        it("should return the message unchanged when there is no header/body separator", () => {
            expect.assertions(1);

            const message = "From: a@example.com\r\nSubject: hi";

            expect(signMessageWithDkim(message, dkim)).toBe(message);
        });

        it("should prepend a DKIM-Signature header while preserving headers and body", () => {
            expect.assertions(4);

            const message = "From: a@example.com\r\nTo: b@example.com\r\nSubject: hi\r\nDate: today\r\n\r\nHello body\r\n";
            const signed = signMessageWithDkim(message, dkim);

            expect(signed.startsWith("DKIM-Signature: ")).toBe(true);
            expect(signed).toContain("d=example.com");
            expect(signed).toContain("s=default");
            expect(signed).toContain("Hello body\r\n");
        });

        it("should include the signed header list and a non-empty b= signature", () => {
            expect.assertions(2);

            const message = "From: a@example.com\r\nTo: b@example.com\r\nSubject: hi\r\nDate: today\r\n\r\nHello body\r\n";
            const signed = signMessageWithDkim(message, dkim);
            const dkimLine = signed.split("\r\n")[0] as string;

            expect(dkimLine).toContain("h=from:to:subject:date");
            expect(DKIM_SIGNATURE_VALUE_REGEX.test(dkimLine)).toBe(true);
        });
    });
});
