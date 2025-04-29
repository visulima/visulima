import { describe, expect, it } from "vitest";

import { getStringWidth } from "../../src";

describe("getStringWidth", () => {
    it("should handle various string types correctly", () => {
        expect.assertions(26);

        expect(getStringWidth("⛣", { ambiguousIsNarrow: false })).toBe(2);
        expect(getStringWidth("abcde")).toBe(5);
        expect(getStringWidth("古池や")).toBe(6);
        expect(getStringWidth("あいうabc")).toBe(9);
        expect(getStringWidth("あいう★")).toBe(8);
        expect(getStringWidth("あいう★", { ambiguousIsNarrow: true })).toBe(7);
        expect(getStringWidth("±")).toBe(1);
        expect(getStringWidth("ノード.js")).toBe(9);
        expect(getStringWidth("你好")).toBe(4);
        expect(getStringWidth("안녕하세요")).toBe(10);
        expect(getStringWidth("A\uD83C\uDE00BC")).toBe(5);
        expect(getStringWidth("\u001B[31m\u001B[39m")).toBe(0);
        expect(getStringWidth("\u001B[31m\u001B[39m", { countAnsiEscapeCodes: true })).toBe(10);
        expect(getStringWidth("\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007")).toBe(5);
        expect(getStringWidth("⌚")).toBe(2);
        expect(getStringWidth("↔️")).toBe(2);
        expect(getStringWidth("👩")).toBe(2);
        expect(getStringWidth("👩")).toBe(2);
        expect(getStringWidth("👩🏿")).toBe(2);
        expect(getStringWidth("葛󠄀")).toBe(2);
        expect(getStringWidth("ปฏัก")).toBe(3);
        expect(getStringWidth("_\u0E34")).toBe(1);
        expect(getStringWidth('"', { ambiguousIsNarrow: false })).toBe(1);
        expect(getStringWidth(" ")).toBe(1);
        expect(getStringWidth("🔀")).toBe(2);
        expect(getStringWidth("🇪")).toBe(2);
    });

    describe("control characters", () => {
        it("should ignore control characters", () => {
            expect.assertions(6);

            expect(getStringWidth(String.fromCodePoint(0))).toBe(0);
            expect(getStringWidth(String.fromCodePoint(31))).toBe(0);
            expect(getStringWidth(String.fromCodePoint(127))).toBe(0);
            expect(getStringWidth(String.fromCodePoint(134))).toBe(0);
            expect(getStringWidth(String.fromCodePoint(159))).toBe(0);
            expect(getStringWidth("\u001B")).toBe(0);
        });
    });

    describe("combining characters", () => {
        it("should handle combining characters correctly", () => {
            expect.assertions(5);

            expect(getStringWidth("x\u0300")).toBe(1);
            expect(getStringWidth("\u0300\u0301")).toBe(0);
            expect(getStringWidth("e\u0301e")).toBe(2);
            expect(getStringWidth("x\u036F")).toBe(1);
            expect(getStringWidth("\u036F\u036F")).toBe(0);
        });
    });

    describe("zWJ characters", () => {
        it("should handle ZWJ sequences correctly", () => {
            expect.assertions(4);

            expect(getStringWidth("👶")).toBe(2);
            expect(getStringWidth("👶🏽")).toBe(2);
            expect(getStringWidth("👩‍👩‍👦‍👦")).toBe(2);
            expect(getStringWidth("👨‍❤️‍💋‍👨")).toBe(2);
        });
    });

    describe("zero-width characters", () => {
        it("should handle zero-width characters correctly", () => {
            expect.assertions(8);

            expect(getStringWidth("\u200B")).toBe(0);
            expect(getStringWidth("x\u200Bx")).toBe(2);
            expect(getStringWidth("\u200C")).toBe(0);
            expect(getStringWidth("x\u200Cx")).toBe(2);
            expect(getStringWidth("\u200D")).toBe(0);
            expect(getStringWidth("x\u200Dx")).toBe(2);
            expect(getStringWidth("\uFEFF")).toBe(0);
            expect(getStringWidth("x\uFEFFx")).toBe(2);
        });
    });

    describe("surrogate pairs", () => {
        it("should handle surrogate pairs correctly", () => {
            expect.assertions(2);

            expect(getStringWidth("\uD83D\uDE00")).toBe(2);
            expect(getStringWidth("A\uD83D\uDE00B")).toBe(4);
        });
    });

    describe("variation selectors", () => {
        it("should handle variation selectors correctly", () => {
            expect.assertions(3);

            expect(getStringWidth("\u{1F1E6}\uFE0F")).toBe(2);
            expect(getStringWidth("A\uFE0F")).toBe(1);
            expect(getStringWidth("\uFE0F")).toBe(0);
        });
    });

    describe("edge cases", () => {
        it("should handle various edge cases correctly", () => {
            expect.assertions(10);

            expect(getStringWidth("")).toBe(0);
            expect(getStringWidth("\u200B\u200B")).toBe(0);
            expect(getStringWidth("x\u200Bx\u200B")).toBe(2);
            expect(getStringWidth("x\u0300x\u0300")).toBe(2);
            expect(getStringWidth("\uD83D\uDE00\uFE0F")).toBe(2);
            expect(getStringWidth("\uD83D\uDC69\u200D\uD83C\uDF93")).toBe(2);
            expect(getStringWidth("x\u1AB0x\u1AB0")).toBe(2);
            expect(getStringWidth("x\u1DC0x\u1DC0")).toBe(2);
            expect(getStringWidth("x\u20D0x\u20D0")).toBe(2);
            expect(getStringWidth("x\uFE20x\uFE20")).toBe(2);
        });
    });

    describe("default ignorable code points", () => {
        it("should ignore default ignorable code points", () => {
            expect.assertions(11);

            expect(getStringWidth("\u2060")).toBe(0);
            expect(getStringWidth("\u2061")).toBe(0);
            expect(getStringWidth("\u2062")).toBe(0);
            expect(getStringWidth("\u2063")).toBe(0);
            expect(getStringWidth("\u2064")).toBe(0);
            expect(getStringWidth("\uFEFF")).toBe(0);
            expect(getStringWidth("x\u2060x")).toBe(2);
            expect(getStringWidth("x\u2061x")).toBe(2);
            expect(getStringWidth("x\u2062x")).toBe(2);
            expect(getStringWidth("x\u2063x")).toBe(2);
            expect(getStringWidth("x\u2064x")).toBe(2);
        });
    });

    describe("complex emoji sequences", () => {
        it("should handle complex emoji sequences correctly", () => {
            expect.assertions(4);

            expect(getStringWidth("👩‍👩‍👦‍👦🏻")).toBe(2);
            expect(getStringWidth("👨‍👩‍👧‍👦")).toBe(2);
            expect(getStringWidth("🤝🏻👫")).toBe(4);
            expect(getStringWidth("🚀👽")).toBe(4);
        });
    });

    describe("combining character sequences", () => {
        it("should handle combining character sequences correctly", () => {
            expect.assertions(4);

            expect(getStringWidth("x\u0300\u0301")).toBe(1);
            expect(getStringWidth("e\u0301\u0302e")).toBe(2);
            expect(getStringWidth("x\u036F\u036F")).toBe(1);
            expect(getStringWidth("\u0300\u0301\u0302")).toBe(0);
        });
    });

    describe("aNSI escape code sequences", () => {
        it("should handle ANSI escape code sequences correctly", () => {
            expect.assertions(3);

            expect(getStringWidth("\u001B[31m\u001B[39m\u001B[40m")).toBe(0);
            expect(getStringWidth("\u001B[31m\u001B[39m\u001B[40m", { countAnsiEscapeCodes: true })).toBe(15);
            expect(getStringWidth("\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007\u001B[31m")).toBe(5);
        });
    });

    describe("hyperlinks", () => {
        it("should handle hyperlinks correctly", () => {
            expect.assertions(3);

            expect(getStringWidth("\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007")).toBe(5);
            expect(getStringWidth("\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007\u001B[31m")).toBe(5);
            expect(getStringWidth("\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007\u001B[31m\u001B[39m")).toBe(5);
        });
    });
});

describe("getStringWidth OSC 8 hyperlinks", () => {
    it("should ignore OSC 8 hyperlink sequences for width calculation", () => {
        expect.assertions(1);

        const url = "https://example.com";
        const linkText = "Example"; // Visual width = 7
        // Note: Need double backslashes for escape sequences within template literals in tests
        const osc8String = `\u001B]8;;${url}\u001B\\${linkText}\u001B]8;;\u001B\\`;

        // Expected width is just the width of "Example"
        expect(getStringWidth(osc8String)).toBe(linkText.length);
    });

    it("should handle OSC 8 combined with ANSI colors", () => {
        expect.assertions(1);

        const url = "https://example.com";
        const linkText = "\u001B[31mExample\u001B[0m"; // Visual width = 7
        // Note: Need double backslashes for escape sequences within template literals in tests
        const osc8String = `\u001B]8;;${url}\u001B\\${linkText}\u001B]8;;\u001B\\`;

        // Expected width is still just the width of "Example"
        expect(getStringWidth(osc8String)).toBe(7);
    });
});
