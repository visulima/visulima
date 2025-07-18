import { describe, expect, it } from "vitest";

import { noCase } from "../../../src/case";

describe(noCase, () => {
    it("should handle empty string", () => {
        expect.assertions(1);
        expect(noCase("")).toBe("");
    });

    it("should convert single word to no case", () => {
        expect.assertions(1);
        expect(noCase("foo")).toBe("foo");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect.assertions(1);
        expect(noCase("foo-bAr")).toBe("foo b ar");
    });

    it("should handle multiple separators", () => {
        expect.assertions(1);
        expect(noCase("foo_bar-baz/qux")).toBe("foo bar baz qux");
    });

    it("should handle snake case", () => {
        expect.assertions(1);
        expect(noCase("FOO_BAR")).toBe("foo bar");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect.assertions(1);
        expect(noCase("foo--bar-Baz")).toBe("foo bar baz");
    });

    it("should convert snake_case to no case", () => {
        expect.assertions(2);
        expect(noCase("foo_bar")).toBe("foo bar");
        expect(noCase("foo_bar_baz")).toBe("foo bar baz");
    });

    it("should convert kebab-case to no case", () => {
        expect.assertions(2);
        expect(noCase("foo-bar")).toBe("foo bar");
        expect(noCase("foo-bar-baz")).toBe("foo bar baz");
    });

    it("should convert space separated to no case", () => {
        expect.assertions(2);
        expect(noCase("foo bar")).toBe("foo bar");
        expect(noCase("foo bar baz")).toBe("foo bar baz");
    });

    it("should handle camelCase input", () => {
        expect.assertions(1);
        expect(noCase("fooBar")).toBe("foo bar");
    });

    it("should handle special formats and mixed cases", () => {
        expect.assertions(6);
        expect(noCase("C-3PO_and_R2-D2")).toBe("c 3po and r2 d2");
        expect(noCase("The Taking of Pelham 123")).toBe("the taking of pelham 123");
        expect(noCase("Ocean's 11")).toBe("ocean's 11");
        expect(noCase("21-JUMP-STREET")).toBe("21 jump street");
        expect(noCase("non-SI units")).toBe("non si units");
        expect(noCase("Red1Green2Blue3")).toBe("red 1 green 2 blue 3");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with stripEmoji=true", () => {
            expect.assertions(8);
            expect(noCase("Foo🐣Bar", { stripEmoji: true })).toBe("foo bar");
            expect(noCase("hello🌍World", { stripEmoji: true })).toBe("hello world");
            expect(noCase("test🎉Party🎈Fun", { stripEmoji: true })).toBe("test party fun");
            expect(noCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("emoji gaming");
            expect(noCase("upper🚀Case", { stripEmoji: true })).toBe("upper case");
            expect(noCase("snake_case_🐍_test", { stripEmoji: true })).toBe("snake case test");
            expect(noCase("kebab-case-🍔-test", { stripEmoji: true })).toBe("kebab case test");
            expect(noCase("no📝case", { stripEmoji: true })).toBe("nocase");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect.assertions(8);
            expect(noCase("Foo🐣Bar", { handleEmoji: true })).toBe("foo 🐣 bar");
            expect(noCase("hello🌍World", { handleEmoji: true })).toBe("hello 🌍 world");
            expect(noCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("test 🎉 party 🎈 fun");
            expect(noCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("emoji 👾 gaming");
            expect(noCase("upper🚀Case", { handleEmoji: true })).toBe("upper 🚀 case");
            expect(noCase("snake_case_🐍_test", { handleEmoji: true })).toBe("snake case 🐍 test");
            expect(noCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("kebab case 🍔 test");
            expect(noCase("no📝case", { handleEmoji: true })).toBe("no 📝 case");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect.assertions(3);
            expect(noCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("red text");
            expect(noCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("bold text");
            expect(noCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("green foo blue bar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect.assertions(3);
            expect(noCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mred text\u001B[0m");
            expect(noCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mbold text\u001B[0m");
            expect(noCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mgreen foo\u001B[0m \u001B[34mblue bar\u001B[0m",
            );
        });
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            expect.assertions(2);

            const locale = "tr-TR";

            expect(noCase("istanbul_city", { locale })).toBe("istanbul city");
            expect(noCase("İZMİR_CITY", { locale })).toBe("izmir cıty");
        });

        it("should handle German specific cases", () => {
            expect.assertions(3);

            const locale = "de-DE";

            expect(noCase("GROSSE STRAßE", { locale })).toBe("große straße");
            expect(noCase("GROSSE STRASSE", { locale })).toBe("große straße");
            expect(noCase("GROßE STRAßE", { locale })).toBe("große straße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect.assertions(1);
            expect(noCase("test_string", { locale: "invalid-locale" })).toBe("test string");
        });
    });
});
