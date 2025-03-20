import { describe, expect, it } from "vitest";

import { camelCase } from "../../../src/case";
import generateCacheKey from "../../../src/case/utils/generate-cache-key";
import LRUCache from "../../../src/utils/lru-cache";

describe("camelCase", () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            expect.assertions(4);
            const customCache = new LRUCache<string, string>(50);
            const input = "test-string";

            // First call should cache
            const result1 = camelCase(input, { cache: true, cacheStore: customCache });
            expect(result1).toBe("testString");
            expect(customCache.size()).toBe(1);

            // Second call should use cache
            const result2 = camelCase(input, { cache: true, cacheStore: customCache });
            expect(result2).toBe("testString");
            expect(customCache.size()).toBe(1);
        });

        it("should not use cache when disabled", () => {
            expect.assertions(4);
            const customCache = new LRUCache<string, string>(50);
            const input = "test-string";

            // First call without cache
            const result1 = camelCase(input, { cache: false, cacheStore: customCache });
            expect(result1).toBe("testString");
            expect(customCache.size()).toBe(0);

            // Second call without cache
            const result2 = camelCase(input, { cache: false, cacheStore: customCache });
            expect(result2).toBe("testString");
            expect(customCache.size()).toBe(0);
        });

        it("should handle custom cache store", () => {
            expect.assertions(1);
            const customCache = new LRUCache<string, string>(50);
            const input = "test-string";

            // Use custom cache
            camelCase(input, { cache: true, cacheStore: customCache });
            expect(customCache.size()).toBe(1);
        });
    });

    it("should convert FooBarBaz to fooBarBaz", () => {
        expect.assertions(2);
        expect(camelCase("FooBarBaz")).toBe("fooBarBaz");
        expect(camelCase("XMLHttpRequest")).toBe("xmlHttpRequest");
    });

    it("should convert FOO_BAR to fooBar", () => {
        expect.assertions(2);
        expect(camelCase("FOO_BAR")).toBe("fooBar");
        expect(camelCase("FOO_BAR_BAZ")).toBe("fooBarBaz");
    });

    it("should convert snake_case to camelCase", () => {
        expect.assertions(3);
        expect(camelCase("foo_bar")).toBe("fooBar");
        expect(camelCase("foo_bar_baz")).toBe("fooBarBaz");
        expect(camelCase("foo_BAR_baz")).toBe("fooBarBaz");
    });

    it("should convert kebab-case to camelCase", () => {
        expect.assertions(3);
        expect(camelCase("foo-bar")).toBe("fooBar");
        expect(camelCase("foo-bar-baz")).toBe("fooBarBaz");
        expect(camelCase("foo-BAR-baz")).toBe("fooBarBaz");
    });

    it("should convert space separated to camelCase", () => {
        expect.assertions(3);
        expect(camelCase("foo bar")).toBe("fooBar");
        expect(camelCase("foo bar baz")).toBe("fooBarBaz");
        expect(camelCase("foo BAR baz")).toBe("fooBarBaz");
    });

    it("should handle PascalCase input", () => {
        expect.assertions(3);
        expect(camelCase("FooBar")).toBe("fooBar");
        expect(camelCase("FooBarBaz")).toBe("fooBarBaz");
        expect(camelCase("FOOBarBAZ")).toBe("fooBarBaz");
    });

    it("should handle special acronyms and cases", () => {
        expect.assertions(14);
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
        expect.assertions(2);
        expect(camelCase("")).toBe("");
        expect(camelCase("a")).toBe("a");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with stripEmoji=true", () => {
            expect.assertions(8);
            expect(camelCase("Foo🐣Bar", { stripEmoji: true })).toBe("fooBar");
            expect(camelCase("hello🌍World", { stripEmoji: true })).toBe("helloWorld");
            expect(camelCase("test🎉Party🎈Fun", { stripEmoji: true })).toBe("testPartyFun");
            expect(camelCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("emojiGaming");
            expect(camelCase("upper🚀Case", { stripEmoji: true })).toBe("upperCase");
            expect(camelCase("snake_case_🐍_test", { stripEmoji: true })).toBe("snakeCaseTest");
            expect(camelCase("kebab-case-🍔-test", { stripEmoji: true })).toBe("kebabCaseTest");
            expect(camelCase("welcome to the 🎉party", { stripEmoji: true })).toBe("welcomeToTheParty");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect.assertions(8);
            expect(camelCase("Foo🐣Bar", { handleEmoji: true })).toBe("foo🐣Bar");
            expect(camelCase("hello🌍World", { handleEmoji: true })).toBe("hello🌍World");
            expect(camelCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("test🎉Party🎈Fun");
            expect(camelCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("emoji👾Gaming");
            expect(camelCase("upper🚀Case", { handleEmoji: true })).toBe("upper🚀Case");
            expect(camelCase("snake_case_🐍_test", { handleEmoji: true })).toBe("snakeCase🐍Test");
            expect(camelCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("kebabCase🍔Test");
            expect(camelCase("welcome to the 🎉party", { handleEmoji: true })).toBe("welcomeToThe🎉Party");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect.assertions(3);
            expect(camelCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("redText");
            expect(camelCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("boldText");
            expect(camelCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("greenFooBlueBar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect.assertions(3);
            expect(camelCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mredText\u001B[0m");
            expect(camelCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mboldText\u001B[0m");
            expect(camelCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mgreenFoo\u001B[0m\u001B[34mBlueBar\u001B[0m",
            );
        });
    });

    it("should handle international characters", () => {
        expect.assertions(7);
        expect(camelCase("Buenos Días")).toBe("buenosDías");
        expect(camelCase("Jag_förstår_inte")).toBe("jagFörstårInte");
        expect(camelCase("quicoYÑoño")).toBe("quicoYñoño");
        expect(camelCase("Πολύ-καλό")).toBe("πολύΚαλό");
        expect(camelCase("ОЧЕНЬ_ПРИЯТНО")).toBe("оченьПриятно");
        expect(camelCase("Ես-հայերեն-չգիտեմ")).toBe("եսՀայերենՉգիտեմ");
        expect(camelCase("ĲSJE")).toBe("ĳsje");
    });

    it("should handle special formats and mixed cases", () => {
        expect.assertions(3);
        expect(camelCase("C-3PO_and_R2-D2")).toBe("c3poAndR2D2");
        expect(camelCase("non-SI units")).toBe("nonSiUnits");
        expect(camelCase("EstosSon_losActores")).toBe("estosSonLosActores");
    });

    it("should handle strings with numbers", () => {
        expect.assertions(9);
        expect(camelCase("I-have-99-problems")).toBe("iHave99Problems");
        expect(camelCase("STARTER-FOR-10")).toBe("starterFor10");
        expect(camelCase("the__0__is_the_best")).toBe("the0IsTheBest");
        expect(camelCase("10-10-a-a-10-10")).toBe("1010AA1010");
        expect(camelCase("se7en")).toBe("se7En");
        expect(camelCase("Red1Green2Blue3")).toBe("red1Green2Blue3");
        expect(camelCase("REEL2REAL")).toBe("reel2real");
        expect(camelCase("reel2real")).toBe("reel2Real");
        expect(camelCase("Reel2Real")).toBe("reel2Real");
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            expect.assertions(2);
            const locale = "tr-TR";
            expect(camelCase("istanbul_city", { locale })).toBe("istanbulCity");
            expect(camelCase("İZMİR_CITY", { locale })).toBe("izmirCıty");
        });

        it("should handle German specific cases", () => {
            expect.assertions(3);
            const locale = "de-DE";
            expect(camelCase("GROSSE STRAßE", { locale })).toBe("großeStraße");
            expect(camelCase("GROSSE STRASSE", { locale })).toBe("großeStraße");
            expect(camelCase("GROßE STRAßE", { locale })).toBe("großeStraße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect.assertions(1);
            expect(camelCase("test_string", { locale: "invalid-locale" })).toBe("testString");
        });
    });
});
