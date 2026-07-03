import { describe, expect, it } from "vitest";

import decodeMimeHeaderValue from "../../src/utils/decode-mime-header";
import { encodeMimeHeaderValue } from "../../src/utils/encode-mime-header";
import { decodeQuotedPrintable, encodeQuotedPrintable } from "../../src/utils/quoted-printable";

describe(encodeMimeHeaderValue, () => {
    it("should leave ASCII unchanged", () => {
        expect.assertions(1);

        expect(encodeMimeHeaderValue("Hello World")).toBe("Hello World");
    });

    it("should encode non-ASCII as a B encoded-word", () => {
        expect.assertions(1);

        expect(encodeMimeHeaderValue("Grüße")).toBe("=?UTF-8?B?R3LDvMOfZQ==?=");
    });

    it("should split long non-ASCII values into multiple encoded-words", () => {
        expect.assertions(2);

        const encoded = encodeMimeHeaderValue("ä".repeat(100));
        const words = encoded.split(" ");

        expect(words.length).toBeGreaterThan(1);
        // Each encoded-word must stay <= 75 chars.
        expect(words.every((word) => word.length <= 75)).toBe(true);
    });
});

describe(decodeMimeHeaderValue, () => {
    it("should decode a B encoded-word", () => {
        expect.assertions(1);

        expect(decodeMimeHeaderValue("=?UTF-8?B?R3LDvMOfZQ==?=")).toBe("Grüße");
    });

    it("should decode a Q encoded-word", () => {
        expect.assertions(1);

        expect(decodeMimeHeaderValue("=?UTF-8?Q?Gr=C3=BC=C3=9Fe?=")).toBe("Grüße");
    });

    it("should round-trip with the encoder", () => {
        expect.assertions(1);

        const original = "Grüße aus München — café ☕";

        expect(decodeMimeHeaderValue(encodeMimeHeaderValue(original))).toBe(original);
    });

    it("should leave plain values unchanged", () => {
        expect.assertions(1);

        expect(decodeMimeHeaderValue("Plain Subject")).toBe("Plain Subject");
    });
});

describe("quoted-printable", () => {
    it("should encode non-ASCII octets", () => {
        expect.assertions(1);

        expect(encodeQuotedPrintable("Grüße")).toBe("Gr=C3=BC=C3=9Fe");
    });

    it("should round-trip (line breaks normalised to CRLF)", () => {
        expect.assertions(1);

        // The encoder emits MIME-standard CRLF line endings; round-trip preserves CRLF.
        const original = "Grüße aus München\r\nLine two — café ☕";

        expect(decodeQuotedPrintable(encodeQuotedPrintable(original))).toBe(original);
    });

    it("should encode an equals sign", () => {
        expect.assertions(1);

        expect(encodeQuotedPrintable("a=b")).toBe("a=3Db");
    });

    it("should encode trailing whitespace", () => {
        expect.assertions(1);

        expect(encodeQuotedPrintable("hello ")).toBe("hello=20");
    });
});
