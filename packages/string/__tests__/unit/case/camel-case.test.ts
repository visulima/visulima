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

    it("should handle special acronyms and cases", () => {
        expect(camelCase("XML_HTTP_request")).toBe("xmlHttpRequest");
        expect(camelCase("XMLHTTPRequest")).toBe("xmlhttpRequest");
        expect(camelCase("AJAXRequest")).toBe("ajaxRequest");
        expect(camelCase("IFrameElement")).toBe("iFrameElement");
        expect(camelCase("iOS_app")).toBe("iOsApp");
        expect(camelCase("NASA")).toBe("nasa");
        expect(camelCase("Fbi")).toBe("fbi");
        expect(camelCase("B-C-D")).toBe("bCD");
        expect(camelCase("CamelCase")).toBe("camelCase");
        expect(camelCase("dataTransfer")).toBe("dataTransfer");
        expect(camelCase("eniac_computer")).toBe("eniacComputer");
        expect(camelCase("FIBONACCI_NUMBER")).toBe("fibonacciNumber");
        expect(camelCase("v5.3.0")).toBe("v530");
        expect(camelCase("Good_Morning_Vietnam")).toBe("goodMorningVietnam");
    });

    it("should handle empty string and single characters", () => {
        expect(camelCase("")).toBe("");
        expect(camelCase("a")).toBe("a");
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

    it("should handle international characters", () => {
        expect(camelCase("Buenos Días")).toBe("buenosDías");
        expect(camelCase("Jag_förstår_inte")).toBe("jagFörstårInte");
        expect(camelCase("quicoYÑoño")).toBe("quicoYÑoño");
        expect(camelCase("Πολύ-καλό")).toBe("πολύΚαλό");
        expect(camelCase("ОЧЕНЬ_ПРИЯТНО")).toBe("оченьПриятно");
        expect(camelCase("Ես-հայերեն-չգիտեմ")).toBe("եսՀայերենՉգիտեմ");
        expect(camelCase("ĲSJE")).toBe("ĳsje");
    });

    it("should handle special formats and mixed cases", () => {
        expect(camelCase("C-3PO_and_R2-D2")).toBe("c3PoAndR2D2");
        expect(camelCase("non-SI units")).toBe("nonSiUnits");
        expect(camelCase("EstosSon_losActores")).toBe("estosSonLosActores");
    });

    it("should handle strings with numbers", () => {
        expect(camelCase("I-have-99-problems")).toBe("iHave99Problems");
        expect(camelCase("STARTER-FOR-10")).toBe("starterFor10");
        expect(camelCase("the__0__is_the_best")).toBe("the0IsTheBest");
        expect(camelCase("10-10-a-a-10-10")).toBe("1010AA1010");
        expect(camelCase("se7en")).toBe("se7En");
        expect(camelCase("Red1Green2Blue3")).toBe("red1Green2Blue3");
        expect(camelCase("REEL2REAL")).toBe("reel2Real");
        expect(camelCase("reel2real")).toBe("reel2Real");
        expect(camelCase("Reel2Real")).toBe("reel2Real");
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
