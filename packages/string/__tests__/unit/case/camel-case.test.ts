import { describe, expect, it, test } from "vitest";

import { camelCase } from "../../../src/case";

describe("camelCase", () => {
    it("should convert FooBarBaz to fooBarBaz", () => {
        expect(camelCase("FooBarBaz")).toBe("fooBarBaz");
        expect(camelCase("XMLHttpRequest")).toBe("xmlHttpRequest");
    });

    it("should convert FOO_BAR to fooBar", () => {
        expect(camelCase("FOO_BAR")).toBe("fooBar");
        expect(camelCase("FOO_BAR_BAZ")).toBe("fooBarBaz");
    });

    it("should convert snake_case to camelCase", () => {
        expect(camelCase("foo_bar")).toBe("fooBar");
        expect(camelCase("foo_bar_baz")).toBe("fooBarBaz");
        expect(camelCase("foo_BAR_baz")).toBe("fooBarBaz");
    });

    it("should convert kebab-case to camelCase", () => {
        expect(camelCase("foo-bar")).toBe("fooBar");
        expect(camelCase("foo-bar-baz")).toBe("fooBarBaz");
        expect(camelCase("foo-BAR-baz")).toBe("fooBarBaz");
    });

    it("should convert space separated to camelCase", () => {
        expect(camelCase("foo bar")).toBe("fooBar");
        expect(camelCase("foo bar baz")).toBe("fooBarBaz");
        expect(camelCase("foo BAR baz")).toBe("fooBarBaz");
    });

    it("should handle PascalCase input", () => {
        expect(camelCase("FooBar")).toBe("fooBar");
        expect(camelCase("FooBarBaz")).toBe("fooBarBaz");
        expect(camelCase("FOOBarBAZ")).toBe("fooBarBaz");
    });

    it("should handle special acronyms", () => {
        expect(camelCase("XML_HTTP_request")).toBe("xmlHttpRequest");
        expect(camelCase("XMLHTTPRequest")).toBe("xmlhttpRequest");
        expect(camelCase("AJAXRequest")).toBe("ajaxRequest");
        expect(camelCase("IFrameElement")).toBe("iFrameElement");
        expect(camelCase("iOS_app")).toBe("iosApp");
    });

    it("should handle empty string", () => {
        expect(camelCase("")).toBe("");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(camelCase("Foo🐣Bar")).toBe("foo🐣Bar");
            expect(camelCase("hello🌍World")).toBe("hello🌍World");
            expect(camelCase("test🎉Party🎈Fun")).toBe("test🎉Party🎈Fun");
            expect(camelCase("EMOJI👾Gaming")).toBe("emoji👾Gaming");
            expect(camelCase("upper🚀Case")).toBe("upper🚀Case");
            expect(camelCase("snake_case_🐍_test")).toBe("snakeCase🐍Test");
            expect(camelCase("kebab-case-🍔-test")).toBe("kebabCase🍔Test");
        });
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(camelCase("istanbul_city", { locale })).toBe("istanbulCity");
            expect(camelCase("İZMİR_CITY", { locale })).toBe("izmirCıty");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(camelCase("GROSSE STRAßE", { locale })).toBe("großeStraße");
            expect(camelCase("GROSSE STRASSE", { locale })).toBe("großeStraße");
            expect(camelCase("GROßE STRAßE", { locale })).toBe("großeStraße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect(camelCase("test_string", { locale: "invalid-locale" })).toBe("testString");
        });
    });
});
