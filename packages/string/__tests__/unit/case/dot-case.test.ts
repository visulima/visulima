import { describe, expect, it } from "vitest";

import { dotCase } from "../../../src/case";
import { generateCacheKey } from "../../../src/case/utils/generate-cache-key";

describe("dotCase", () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            const customCache = new Map<string, string>();
            const input = "testString";
            const options = { cache: true, cacheStore: customCache, joiner: "." };

            // First call should cache
            const result1 = dotCase(input, options);
            expect(result1).toBe("test.string");
            expect(customCache.size).toBe(1);
            expect(customCache.get(generateCacheKey(input, options))).toBe(result1);

            // Second call should use cache
            const result2 = dotCase(input, options);
            expect(result2).toBe("test.string");
            expect(customCache.size).toBe(1);
        });

        it("should not use cache when disabled", () => {
            const customCache = new Map<string, string>();
            const input = "testString";
            const options = { cache: false, cacheStore: customCache };

            // First call without cache
            const result1 = dotCase(input, options);
            expect(result1).toBe("test.string");
            expect(customCache.size).toBe(0);

            // Second call without cache
            const result2 = dotCase(input, options);
            expect(result2).toBe("test.string");
            expect(customCache.size).toBe(0);
        });

        it("should respect cache size limit", () => {
            const customCache = new Map<string, string>();
            const input1 = "testString1";
            const input2 = "testString2";
            const options = { cache: true, cacheMaxSize: 1, cacheStore: customCache, joiner: "." };

            // First string should be cached
            const result1 = dotCase(input1, options);
            expect(customCache.size).toBe(1);
            expect(customCache.get(generateCacheKey(input1, options))).toBe(result1);

            // Second string should be cached due to size limit, the first string should be evicted
            const result2 = dotCase(input2, options);
            expect(customCache.size).toBe(1);
            expect(customCache.has(generateCacheKey(input1, options))).toBeFalsy();
            expect(customCache.get(generateCacheKey(input2, options))).toBe(result2);
        });

        it("should handle custom cache store", () => {
            const defaultCache = new Map<string, string>();
            const customCache = new Map<string, string>();
            const input = "testString";
            const options = { cache: true, cacheStore: customCache };

            // Use custom cache
            dotCase(input, options);
            expect(customCache.size).toBe(1);
            expect(defaultCache.size).toBe(0);
        });
    });

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
        it("should handle emojis in text with stripEmoji=true", () => {
            expect(dotCase("Foo🐣Bar", { stripEmoji: true })).toBe("foo.bar");
            expect(dotCase("hello🌍World", { stripEmoji: true })).toBe("hello.world");
            expect(dotCase("test🎉Party🎈Fun", { stripEmoji: true })).toBe("test.party.fun");
            expect(dotCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("emoji.gaming");
            expect(dotCase("upper🚀Case", { stripEmoji: true })).toBe("upper.case");
            expect(dotCase("snake_case_🐍_test", { stripEmoji: true })).toBe("snake.case.test");
            expect(dotCase("kebab-case-🍔-test", { stripEmoji: true })).toBe("kebab.case.test");
            expect(dotCase("welcome to the 🎉party", { stripEmoji: true })).toBe("welcome.to.the.party");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect(dotCase("Foo🐣Bar", { handleEmoji: true })).toBe("foo.🐣.bar");
            expect(dotCase("hello🌍World", { handleEmoji: true })).toBe("hello.🌍.world");
            expect(dotCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("test.🎉.party.🎈.fun");
            expect(dotCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("emoji.👾.gaming");
            expect(dotCase("upper🚀Case", { handleEmoji: true })).toBe("upper.🚀.case");
            expect(dotCase("snake_case_🐍_test", { handleEmoji: true })).toBe("snake.case.🐍.test");
            expect(dotCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("kebab.case.🍔.test");
            expect(dotCase("welcome to the 🎉party", { handleEmoji: true })).toBe("welcome.to.the.🎉.party");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect(dotCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("red.text");
            expect(dotCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("bold.text");
            expect(dotCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("green.foo.blue.bar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect(dotCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mred.text\u001B[0m");
            expect(dotCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mbold.text\u001B[0m");
            expect(dotCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mgreen.foo\u001B[0m.\u001B[34mblue.bar\u001B[0m",
            );
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
