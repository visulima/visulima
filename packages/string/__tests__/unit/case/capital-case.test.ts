import { describe, expect, it } from "vitest";

import { capitalCase } from "../../../src/case";

describe("capitalCase", () => {
    it("should handle empty string", () => {
        expect(capitalCase("")).toBe("");
    });

    it("should convert single word to capital case", () => {
        expect(capitalCase("foo")).toBe("Foo");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect(capitalCase("foo-bAr")).toBe("Foo B Ar");
        expect(capitalCase("XMLHttpRequest")).toBe("Xml Http Request");
    });

    it("should handle multiple separators", () => {
        expect(capitalCase("foo_bar-baz/qux")).toBe("Foo Bar Baz Qux");
        expect(capitalCase("foo_BAR-baz/QUX")).toBe("Foo Bar Baz Qux");
    });

    it("should handle snake case", () => {
        expect(capitalCase("FOO_BAR")).toBe("Foo Bar");
        expect(capitalCase("FOO_BAR_BAZ")).toBe("Foo Bar Baz");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect(capitalCase("foo--bar-Baz")).toBe("Foo Bar Baz");
        expect(capitalCase("foo--BAR-baz")).toBe("Foo Bar Baz");
    });

    it("should convert snake_case to Capital Case", () => {
        expect(capitalCase("foo_bar")).toBe("Foo Bar");
        expect(capitalCase("foo_bar_baz")).toBe("Foo Bar Baz");
        expect(capitalCase("foo_BAR_baz")).toBe("Foo Bar Baz");
    });

    it("should convert kebab-case to Capital Case", () => {
        expect(capitalCase("foo-bar")).toBe("Foo Bar");
        expect(capitalCase("foo-bar-baz")).toBe("Foo Bar Baz");
        expect(capitalCase("foo-BAR-baz")).toBe("Foo Bar Baz");
    });

    it("should convert space separated to Capital Case", () => {
        expect(capitalCase("foo bar")).toBe("Foo Bar");
        expect(capitalCase("foo bar baz")).toBe("Foo Bar Baz");
        expect(capitalCase("foo BAR baz")).toBe("Foo Bar Baz");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(capitalCase("Foo🐣Bar")).toBe("Foo 🐣 Bar");
            expect(capitalCase("hello🌍World")).toBe("Hello 🌍 World");
            expect(capitalCase("test🎉Party🎈Fun")).toBe("Test 🎉 Party 🎈 Fun");
            expect(capitalCase("EMOJI👾Gaming")).toBe("Emoji 👾 Gaming");
            expect(capitalCase("upper🚀Case")).toBe("Upper 🚀 Case");
            expect(capitalCase("snake_case_🐍_test")).toBe("Snake Case 🐍 Test");
            expect(capitalCase("kebab-case-🍔-test")).toBe("Kebab Case 🍔 Test");
            expect(capitalCase("capital👑text")).toBe("Capital 👑 Text");
        });
    });

    it("should handle camelCase input", () => {
        expect(capitalCase("fooBar")).toBe("Foo Bar");
        expect(capitalCase("fooBarBaz")).toBe("Foo Bar Baz");
        expect(capitalCase("fooBarBAZ")).toBe("Foo Bar Baz");
    });

    it("should handle special acronyms", () => {
        expect(capitalCase("XML_HTTP_request")).toBe("Xml Http Request");
        expect(capitalCase("XMLHTTPRequest")).toBe("Xmlhttp Request");
        expect(capitalCase("AJAXRequest")).toBe("Ajax Request");
        expect(capitalCase("IFrameElement")).toBe("I Frame Element");
        expect(capitalCase("iOS_app")).toBe("I Os App");
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(capitalCase("istanbul_city", { locale })).toBe("İstanbul City");
            expect(capitalCase("İZMİR_CITY", { locale })).toBe("İzmir Cıty");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(capitalCase("GROSSE STRAßE", { locale })).toBe("Große Straße");
            expect(capitalCase("GROSSE STRASSE", { locale })).toBe("Große Straße");
            expect(capitalCase("GROßE STRAßE", { locale })).toBe("Große Straße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect(capitalCase("test_string", { locale: "invalid-locale" })).toBe("Test String");
        });
    });
});
