import { describe, expect, it } from "vitest";

import { sentenceCase } from "../../../src/case";

describe("sentenceCase", () => {
    it("should handle empty string", () => {
        expect(sentenceCase("")).toBe("");
    });

    it("should convert single word to sentence case", () => {
        expect(sentenceCase("foo")).toBe("Foo");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect(sentenceCase("foo-bAr")).toBe("Foo b ar");
    });

    it("should handle multiple separators", () => {
        expect(sentenceCase("foo_bar-baz/qux")).toBe("Foo bar baz qux");
        expect(sentenceCase("foo_BAR-baz/QUX")).toBe("Foo bar baz qux");
    });

    it("should handle snake case", () => {
        expect(sentenceCase("FOO_BAR")).toBe("Foo bar");
        expect(sentenceCase("FOO_BAR_BAZ")).toBe("Foo bar baz");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect(sentenceCase("foo--bar-Baz")).toBe("Foo bar baz");
        expect(sentenceCase("foo--BAR-baz")).toBe("Foo bar baz");
    });

    it("should convert snake_case to Sentence case", () => {
        expect(sentenceCase("foo_bar")).toBe("Foo bar");
        expect(sentenceCase("foo_bar_baz")).toBe("Foo bar baz");
        expect(sentenceCase("foo_BAR_baz")).toBe("Foo bar baz");
    });

    it("should convert kebab-case to Sentence case", () => {
        expect(sentenceCase("foo-bar")).toBe("Foo bar");
        expect(sentenceCase("foo-bar-baz")).toBe("Foo bar baz");
        expect(sentenceCase("foo-BAR-baz")).toBe("Foo bar baz");
    });

    it("should convert space separated to Sentence case", () => {
        expect(sentenceCase("foo bar")).toBe("Foo bar");
        expect(sentenceCase("foo bar baz")).toBe("Foo bar baz");
        expect(sentenceCase("foo BAR baz")).toBe("Foo bar baz");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(sentenceCase("Foo🐣Bar")).toBe("Foo 🐣 bar");
            expect(sentenceCase("hello🌍World")).toBe("Hello 🌍 world");
            expect(sentenceCase("test🎉Party🎈Fun")).toBe("Test 🎉 party 🎈 fun");
            expect(sentenceCase("EMOJI👾Gaming")).toBe("Emoji 👾 gaming");
            expect(sentenceCase("upper🚀Case")).toBe("Upper 🚀 case");
            expect(sentenceCase("snake_case_🐍_test")).toBe("Snake case 🐍 test");
            expect(sentenceCase("kebab-case-🍔-test")).toBe("Kebab case 🍔 test");
        });
    });

    it("should handle camelCase input", () => {
        expect(sentenceCase("fooBar")).toBe("Foo bar");
        expect(sentenceCase("fooBarBaz")).toBe("Foo bar baz");
        expect(sentenceCase("fooBarBAZ")).toBe("Foo bar baz");
    });

    it("should handle special acronyms", () => {
        expect(sentenceCase("XML_HTTP_request")).toBe("Xml http request");
        expect(sentenceCase("XMLHTTPRequest")).toBe("Xmlhttp request");
        expect(sentenceCase("AJAXRequest")).toBe("Ajax request");
        expect(sentenceCase("IFrameElement")).toBe("I frame element");
        expect(sentenceCase("iOS_app")).toBe("I os app");
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(sentenceCase("istanbul_city", { locale })).toBe("İstanbul city");
            expect(sentenceCase("İZMİR_CITY", { locale })).toBe("İzmir cıty");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(sentenceCase("GROSSE STRAßE", { locale })).toBe("Große straße");
            expect(sentenceCase("GROSSE STRASSE", { locale })).toBe("Große straße");
            expect(sentenceCase("GROßE STRAßE", { locale })).toBe("Große straße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect(sentenceCase("test_string", { locale: "invalid-locale" })).toBe("Test string");
        });
    });
});
