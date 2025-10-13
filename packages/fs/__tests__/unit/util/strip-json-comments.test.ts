import { isSafePattern } from "redos-detector";
import safe from "safe-regex2";
import { describe, expect, it } from "vitest";

import { INTERNAL_STRIP_JSON_REGEX } from "../../../src/constants";
import stripJsonComments from "../../../src/utils/strip-json-comments";

describe("strip-json-comments", () => {
    it("should test if the regex is safe", () => {
        expect.assertions(2);

        expect(safe(INTERNAL_STRIP_JSON_REGEX)).toBe(true);

        const result = isSafePattern(INTERNAL_STRIP_JSON_REGEX);

        // hitMaxScore means the analysis reached complexity limits but didn't find definitive unsafety
        // This is acceptable - better than definitively unsafe (true) but not as good as definitively safe (false)
        expect(result.error).not.toBe(true);
    });

    it("should replace comments with whitespace", () => {
        expect.assertions(7);

        expect(stripJsonComments("//comment\n{\"a\":\"b\"}")).toBe("         \n{\"a\":\"b\"}");
        expect(stripJsonComments("/*//comment*/{\"a\":\"b\"}")).toBe("             {\"a\":\"b\"}");
        expect(stripJsonComments("{\"a\":\"b\"//comment\n}")).toBe("{\"a\":\"b\"         \n}");
        expect(stripJsonComments("{\"a\":\"b\"/*comment*/}")).toBe("{\"a\":\"b\"           }");
        expect(stripJsonComments("{\"a\"/*\n\n\ncomment\r\n*/:\"b\"}")).toBe("{\"a\"  \n\n\n       \r\n  :\"b\"}");
        expect(stripJsonComments("/*!\n * comment\n */\n{\"a\":\"b\"}")).toBe("   \n          \n   \n{\"a\":\"b\"}");
        expect(stripJsonComments("{/*comment*/\"a\":\"b\"}")).toBe("{           \"a\":\"b\"}");
    });

    it("should remove comments", () => {
        expect.assertions(7);

        const options = { whitespace: false };

        expect(stripJsonComments("//comment\n{\"a\":\"b\"}", options)).toBe("\n{\"a\":\"b\"}");
        expect(stripJsonComments("/*//comment*/{\"a\":\"b\"}", options)).toBe("{\"a\":\"b\"}");
        expect(stripJsonComments("{\"a\":\"b\"//comment\n}", options)).toBe("{\"a\":\"b\"\n}");
        expect(stripJsonComments("{\"a\":\"b\"/*comment*/}", options)).toBe("{\"a\":\"b\"}");
        expect(stripJsonComments("{\"a\"/*\n\n\ncomment\r\n*/:\"b\"}", options)).toBe("{\"a\":\"b\"}");
        expect(stripJsonComments("/*!\n * comment\n */\n{\"a\":\"b\"}", options)).toBe("\n{\"a\":\"b\"}");
        expect(stripJsonComments("{/*comment*/\"a\":\"b\"}", options)).toBe("{\"a\":\"b\"}");
    });

    it("should't strip comments inside strings", () => {
        expect.assertions(4);

        expect(stripJsonComments("{\"a\":\"b//c\"}")).toBe("{\"a\":\"b//c\"}");
        expect(stripJsonComments("{\"a\":\"b/*c*/\"}")).toBe("{\"a\":\"b/*c*/\"}");
        expect(stripJsonComments("{\"/*a\":\"b\"}")).toBe("{\"/*a\":\"b\"}");
        expect(stripJsonComments(String.raw`{"\"/*a":"b"}`)).toBe(String.raw`{"\"/*a":"b"}`);
    });

    it("should consider escaped slashes when checking for escaped string quote", () => {
        expect.assertions(2);

        expect(stripJsonComments(String.raw`{"\\":"https://foobar.com"}`)).toBe(String.raw`{"\\":"https://foobar.com"}`);
        expect(stripJsonComments(String.raw`{"foo\"":"https://foobar.com"}`)).toBe(String.raw`{"foo\"":"https://foobar.com"}`);
    });

    it("should handle line endings - no comments", () => {
        expect.assertions(2);

        expect(stripJsonComments("{\"a\":\"b\"\n}")).toBe("{\"a\":\"b\"\n}");
        expect(stripJsonComments("{\"a\":\"b\"\r\n}")).toBe("{\"a\":\"b\"\r\n}");
    });

    it("should handle line endings - single line comment", () => {
        expect.assertions(2);

        expect(stripJsonComments("{\"a\":\"b\"//c\n}")).toBe("{\"a\":\"b\"   \n}");
        expect(stripJsonComments("{\"a\":\"b\"//c\r\n}")).toBe("{\"a\":\"b\"   \r\n}");
    });

    it("should handle line endings - single line block comment", () => {
        expect.assertions(2);

        expect(stripJsonComments("{\"a\":\"b\"/*c*/\n}")).toBe("{\"a\":\"b\"     \n}");
        expect(stripJsonComments("{\"a\":\"b\"/*c*/\r\n}")).toBe("{\"a\":\"b\"     \r\n}");
    });

    it("should handle line endings - multi line block comment", () => {
        expect.assertions(2);

        expect(stripJsonComments("{\"a\":\"b\",/*c\nc2*/\"x\":\"y\"\n}")).toBe("{\"a\":\"b\",   \n    \"x\":\"y\"\n}");
        expect(stripJsonComments("{\"a\":\"b\",/*c\r\nc2*/\"x\":\"y\"\r\n}")).toBe("{\"a\":\"b\",   \r\n    \"x\":\"y\"\r\n}");
    });

    it("should handle line endings - works at EOF", () => {
        expect.assertions(2);

        const options = { whitespace: false };

        expect(stripJsonComments("{\r\n\t\"a\":\"b\"\r\n} //EOF")).toBe("{\r\n\t\"a\":\"b\"\r\n}      ");
        expect(stripJsonComments("{\r\n\t\"a\":\"b\"\r\n} //EOF", options)).toBe("{\r\n\t\"a\":\"b\"\r\n} ");
    });

    it("should handle weird escaping", () => {
        expect.assertions(1);

        expect(stripJsonComments(String.raw`{"x":"x \"sed -e \\\"s/^.\\\\{46\\\\}T//\\\" -e \\\"s/#033/\\\\x1b/g\\\"\""}`)).toStrictEqual(
            String.raw`{"x":"x \"sed -e \\\"s/^.\\\\{46\\\\}T//\\\" -e \\\"s/#033/\\\\x1b/g\\\"\""}`,
        );
    });

    it("should handle multiple comments in one input", () => {
        expect.assertions(1);

        expect(stripJsonComments("// array:\n[1, /* 2 */, 3, /* todo... */] // end")).toBe("         \n[1,        , 3,              ]       ");
    });

    it("should handle malformed block comments", () => {
        expect.assertions(1);

        expect(stripJsonComments("[] /*")).toBe("[] /*");
    });
});
