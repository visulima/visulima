import { describe, expect, it } from "vitest";

import { dotCase } from "../../../src/case";

describe("dotCase", () => {
    it("should handle empty string", () => {
        expect(dotCase("")).toBe("");
    });

    it("should convert single word to dot case", () => {
        expect(dotCase("foo")).toBe("foo");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect(dotCase("foo-bAr")).toBe("foo.b.ar");
        expect(dotCase("XMLHttpRequest")).toBe("xml.http.request");
    });

    it("should handle multiple separators", () => {
        expect(dotCase("foo_bar-baz/qux")).toBe("foo.bar.baz.qux");
        expect(dotCase("foo_BAR-baz/QUX")).toBe("foo.bar.baz.qux");
    });

    it("should handle snake case", () => {
        expect(dotCase("FOO_BAR")).toBe("foo.bar");
        expect(dotCase("FOO_BAR_BAZ")).toBe("foo.bar.baz");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect(dotCase("foo--bar-Baz")).toBe("foo.bar.baz");
        expect(dotCase("foo--BAR-baz")).toBe("foo.bar.baz");
    });

    it("should convert snake_case to dot.case", () => {
        expect(dotCase("foo_bar")).toBe("foo.bar");
        expect(dotCase("foo_bar_baz")).toBe("foo.bar.baz");
        expect(dotCase("foo_BAR_baz")).toBe("foo.bar.baz");
    });

    it("should convert kebab-case to dot.case", () => {
        expect(dotCase("foo-bar")).toBe("foo.bar");
        expect(dotCase("foo-bar-baz")).toBe("foo.bar.baz");
        expect(dotCase("foo-BAR-baz")).toBe("foo.bar.baz");
    });

    it("should convert space separated to dot.case", () => {
        expect(dotCase("foo bar")).toBe("foo.bar");
        expect(dotCase("foo bar baz")).toBe("foo.bar.baz");
        expect(dotCase("foo BAR baz")).toBe("foo.bar.baz");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(dotCase("Foo🐣Bar")).toBe("foo.🐣.bar");
            expect(dotCase("hello🌍World")).toBe("hello.🌍.world");
            expect(dotCase("test🎉Party🎈Fun")).toBe("test.🎉.party.🎈.fun");
            expect(dotCase("EMOJI👾Gaming")).toBe("emoji.👾.gaming");
            expect(dotCase("upper🚀Case")).toBe("upper.🚀.case");
            expect(dotCase("snake_case_🐍_test")).toBe("snake.case.🐍.test");
            expect(dotCase("kebab-case-🍔-test")).toBe("kebab.case.🍔.test");
        });
    });

    it("should handle camelCase input", () => {
        expect(dotCase("fooBar")).toBe("foo.bar");
        expect(dotCase("fooBarBaz")).toBe("foo.bar.baz");
        expect(dotCase("fooBarBAZ")).toBe("foo.bar.baz");
    });

    it("should handle special acronyms consistently", () => {
        expect(dotCase("XML_HTTP_request")).toBe("xml.http.request");
        expect(dotCase("XMLHTTPRequest")).toBe("xmlhttp.request");
        expect(dotCase("AJAXRequest")).toBe("ajax.request");
        expect(dotCase("IFrameElement")).toBe("i.frame.element");
        expect(dotCase("iOS_app")).toBe("i.os.app");
    });

    it("should handle first character correctly", () => {
        expect(dotCase("XMLHttpRequest")).toBe("xml.http.request");
        expect(dotCase("AJAXRequest")).toBe("ajax.request");
        expect(dotCase("fooBar")).toBe("foo.bar");
    });

    it("should handle special formats and mixed cases", () => {
        expect(dotCase("EstosSon_losActores")).toBe("estos.son.los.actores");
        expect(dotCase("Red1Green2Blue3")).toBe("red.1.green.2.blue.3");
        expect(dotCase("REEL2REAL")).toBe("reel.2.real");
        expect(dotCase("reel2real")).toBe("reel.2.real");
        expect(dotCase("Reel2Real")).toBe("reel.2.real");
        expect(dotCase("non-SI units")).toBe("non.si.units");
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(dotCase("istanbul_city", { locale })).toBe("istanbul.city");
            expect(dotCase("İZMİR_CITY", { locale })).toBe("izmir.cıty");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(dotCase("GROSSE STRAßE", { locale })).toBe("große.straße");
            expect(dotCase("GROSSE STRASSE", { locale })).toBe("große.straße");
            expect(dotCase("GROßE STRAßE", { locale })).toBe("große.straße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect(dotCase("test_string", { locale: "invalid-locale" })).toBe("test.string");
        });
    });
});
