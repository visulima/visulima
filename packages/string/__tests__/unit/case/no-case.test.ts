import { describe, expect, it } from "vitest";

import { noCase } from "../../../src/case";

describe("noCase", () => {
    it("should handle empty string", () => {
        expect(noCase("")).toBe("");
    });

    it("should convert single word to no case", () => {
        expect(noCase("foo")).toBe("foo");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect(noCase("foo-bAr")).toBe("foo b ar");
    });

    it("should handle multiple separators", () => {
        expect(noCase("foo_bar-baz/qux")).toBe("foo bar baz qux");
    });

    it("should handle snake case", () => {
        expect(noCase("FOO_BAR")).toBe("foo bar");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect(noCase("foo--bar-Baz")).toBe("foo bar baz");
    });

    it("should convert snake_case to no case", () => {
        expect(noCase("foo_bar")).toBe("foo bar");
        expect(noCase("foo_bar_baz")).toBe("foo bar baz");
    });

    it("should convert kebab-case to no case", () => {
        expect(noCase("foo-bar")).toBe("foo bar");
        expect(noCase("foo-bar-baz")).toBe("foo bar baz");
    });

    it("should convert space separated to no case", () => {
        expect(noCase("foo bar")).toBe("foo bar");
        expect(noCase("foo bar baz")).toBe("foo bar baz");
    });

    it("should handle camelCase input", () => {
        expect(noCase("fooBar")).toBe("foo bar");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(noCase("Foo🐣Bar")).toBe("foo 🐣 bar");
            expect(noCase("hello🌍World")).toBe("hello 🌍 world");
            expect(noCase("test🎉Party🎈Fun")).toBe("test 🎉 party 🎈 fun");
            expect(noCase("EMOJI👾Gaming")).toBe("emoji 👾 gaming");
            expect(noCase("upper🚀Case")).toBe("upper 🚀 case");
            expect(noCase("snake_case_🐍_test")).toBe("snake case 🐍 test");
            expect(noCase("kebab-case-🍔-test")).toBe("kebab case 🍔 test");
            expect(noCase("no📝case")).toBe("no 📝 case");
        });
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(noCase("istanbul_city", { locale })).toBe("istanbul city");
            expect(noCase("İZMİR_CITY", { locale })).toBe("izmir city");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(noCase("GROSSE STRAßE", { locale })).toBe("grosse straße");
            expect(noCase("GROSSE STRASSE", { locale })).toBe("grosse strasse");
            expect(noCase("GROßE STRAßE", { locale })).toBe("große straße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect(noCase("test_string", { locale: "invalid-locale" })).toBe("test string");
        });
    });
});
