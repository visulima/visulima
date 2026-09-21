import { describe, expect, it } from "vitest";

import { parseInlineStyle } from "../../../src/apps/inspector/parse-inline-style";

describe(parseInlineStyle, () => {
    it("camelCases hyphenated property names", () => {
        expect.hasAssertions();

        expect(parseInlineStyle("background-color: red; font-size: 12px")).toStrictEqual({ backgroundColor: "red", fontSize: "12px" });
    });

    it("camelCases every hyphen, not just the first", () => {
        expect.hasAssertions();

        expect(parseInlineStyle("border-top-left-radius: 4px")).toStrictEqual({ borderTopLeftRadius: "4px" });
    });

    it("keeps colons inside the value, such as a url", () => {
        expect.hasAssertions();

        expect(parseInlineStyle("background: url(https://example.com/a.png)")).toStrictEqual({ background: "url(https://example.com/a.png)" });
    });

    it("ignores a trailing semicolon rather than adding a blank entry", () => {
        expect.hasAssertions();

        expect(parseInlineStyle("color: red;")).toStrictEqual({ color: "red" });
    });

    it("skips a declaration with no colon", () => {
        expect.hasAssertions();

        expect(parseInlineStyle("color: red; nonsense; margin: 0")).toStrictEqual({ color: "red", margin: "0" });
    });

    it("skips a declaration with an empty name or value", () => {
        expect.hasAssertions();

        expect(parseInlineStyle(": red; color: ; margin: 0")).toStrictEqual({ margin: "0" });
    });

    it("returns nothing for an empty string", () => {
        expect.hasAssertions();

        expect(parseInlineStyle("")).toStrictEqual({});
    });
});
