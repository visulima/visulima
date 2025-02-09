import { describe, expect, it } from "vitest";

import { constantCase } from "../../../src/case";

describe("constantCase", () => {
    it("should handle empty string", () => {
        expect(constantCase("")).toBe("");
    });

    it("should convert single word to constant case", () => {
        expect(constantCase("foo")).toBe("FOO");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect(constantCase("foo-bAr")).toBe("FOO_B_AR");
        expect(constantCase("XMLHttpRequest")).toBe("XML_HTTP_REQUEST");
    });

    it("should handle multiple separators", () => {
        expect(constantCase("foo_bar-baz/qux")).toBe("FOO_BAR_BAZ_QUX");
        expect(constantCase("foo_BAR-baz/QUX")).toBe("FOO_BAR_BAZ_QUX");
    });

    it("should handle snake case", () => {
        expect(constantCase("FOO_BAR")).toBe("FOO_BAR");
        expect(constantCase("FOO_BAR_BAZ")).toBe("FOO_BAR_BAZ");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect(constantCase("foo--bar-Baz")).toBe("FOO_BAR_BAZ");
        expect(constantCase("foo--BAR-baz")).toBe("FOO_BAR_BAZ");
    });

    it("should convert snake_case to CONSTANT_CASE", () => {
        expect(constantCase("foo_bar")).toBe("FOO_BAR");
        expect(constantCase("foo_bar_baz")).toBe("FOO_BAR_BAZ");
        expect(constantCase("foo_BAR_baz")).toBe("FOO_BAR_BAZ");
    });

    it("should convert kebab-case to CONSTANT_CASE", () => {
        expect(constantCase("foo-bar")).toBe("FOO_BAR");
        expect(constantCase("foo-bar-baz")).toBe("FOO_BAR_BAZ");
        expect(constantCase("foo-BAR-baz")).toBe("FOO_BAR_BAZ");
    });

    it("should convert space separated to CONSTANT_CASE", () => {
        expect(constantCase("foo bar")).toBe("FOO_BAR");
        expect(constantCase("foo bar baz")).toBe("FOO_BAR_BAZ");
        expect(constantCase("foo BAR baz")).toBe("FOO_BAR_BAZ");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(constantCase("Foo🐣Bar")).toBe("FOO_🐣_BAR");
            expect(constantCase("hello🌍World")).toBe("HELLO_🌍_WORLD");
            expect(constantCase("test🎉Party🎈Fun")).toBe("TEST_🎉_PARTY_🎈_FUN");
            expect(constantCase("EMOJI👾Gaming")).toBe("EMOJI_👾_GAMING");
            expect(constantCase("upper🚀Case")).toBe("UPPER_🚀_CASE");
            expect(constantCase("snake_case_🐍_test")).toBe("SNAKE_CASE_🐍_TEST");
            expect(constantCase("kebab-case-🍔-test")).toBe("KEBAB_CASE_🍔_TEST");
        });
    });

    it("should handle camelCase input", () => {
        expect(constantCase("fooBar")).toBe("FOO_BAR");
        expect(constantCase("fooBarBaz")).toBe("FOO_BAR_BAZ");
        expect(constantCase("fooBarBAZ")).toBe("FOO_BAR_BAZ");
    });

    it("should handle special acronyms", () => {
        expect(constantCase("XML_HTTP_request")).toBe("XML_HTTP_REQUEST");
        expect(constantCase("XMLHTTPRequest")).toBe("XMLHTTP_REQUEST");
        expect(constantCase("AJAXRequest")).toBe("AJAX_REQUEST");
        expect(constantCase("IFrameElement")).toBe("I_FRAME_ELEMENT");
        expect(constantCase("iOS_app")).toBe("I_OS_APP");
    });

    it("should handle special formats and mixed cases", () => {
        expect(constantCase("fantastic-4")).toBe("FANTASTIC_4");
        expect(constantCase("Apollo13")).toBe("APOLLO_13");
        expect(constantCase("you-have-0-money")).toBe("YOU_HAVE_0_MONEY");
        expect(constantCase("123BC456BC789")).toBe("123_B_C_456_B_C_789");
        expect(constantCase("DISTRICT_9")).toBe("DISTRICT_9");
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(constantCase("istanbul_city", { locale })).toBe("İSTANBUL_CİTY");
            expect(constantCase("İZMİR_CITY", { locale })).toBe("İZMİR_CİTY");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(constantCase("GROSSE STRAßE", { locale })).toBe("GROSSE_STRAßE");
            expect(constantCase("GROSSE STRASSE", { locale })).toBe("GROSSE_STRASSE");
            expect(constantCase("GROßE STRAßE", { locale })).toBe("GROßE_STRAßE");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect(constantCase("test_string", { locale: "invalid-locale" })).toBe("TEST_STRING");
        });
    });
});
