import { describe, expect, it } from "vitest";

import { CRLF, detect, format, LF } from "../../src/eol";

const CRLF_INPUT = "this\r\nis a\r\ntest";
const MIXED_INPUT = "this\nis a\r\ntest";
const MIXED_INPUT2 = "this\r\nis a\ntest";
const LF_INPUT = "this\nis a\ntest";
const NO_NL_INPUT = "this is a test";

describe("eol", () => {
    it("should detect CRLF as the end-of-line character", () => {
        expect.assertions(2);

        expect(detect(CRLF_INPUT)).toStrictEqual(CRLF);
        expect(detect("foo\r\nbar\r\nbaz\n")).toStrictEqual(CRLF);
    });

    it("should detect LF as the end-of-line character", () => {
        expect.assertions(4);

        expect(detect(LF_INPUT)).toStrictEqual(LF);
        expect(detect("foo\r\nbar\r\nbaz\n\n\n")).toStrictEqual(LF);
        expect(detect("foo\nbar\nbaz\r\n")).toStrictEqual(LF);
        expect(detect("foo\nbar\r\n")).toStrictEqual(LF);
    });

    it("should return null for a string with no end-of-line character", () => {
        expect.assertions(1);

        expect(detect(NO_NL_INPUT)).toBeNull();
    });

    it("should convert the end-of-line character to the specified one", () => {
        expect.assertions(10);

        expect(format(CRLF_INPUT, LF)).toStrictEqual(LF_INPUT);
        expect(format(LF_INPUT, LF)).toStrictEqual(LF_INPUT);
        expect(format(LF_INPUT, CRLF)).toStrictEqual(CRLF_INPUT);
        expect(format(CRLF_INPUT, CRLF)).toStrictEqual(CRLF_INPUT);
        expect(format(CRLF_INPUT, CRLF)).toStrictEqual(CRLF_INPUT);
        expect(format(NO_NL_INPUT, CRLF)).toStrictEqual(NO_NL_INPUT);
        expect(format(MIXED_INPUT, CRLF)).toStrictEqual(CRLF_INPUT);
        expect(format(MIXED_INPUT, LF)).toStrictEqual(LF_INPUT);
        expect(format(MIXED_INPUT2, CRLF)).toStrictEqual(CRLF_INPUT);
        expect(format(MIXED_INPUT2, LF)).toStrictEqual(LF_INPUT);
    });
});
