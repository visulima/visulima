import { describe, expect, it } from "vitest";

import { sentenceCase } from "../../../src/case";
import { generateCacheKey } from "../../../src/case/utils/generate-cache-key";

describe("sentenceCase", () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            const customCache = new Map<string, string>();
            const input = "testString";

            // First call should cache
            const result1 = sentenceCase(input, { cache: true, cacheStore: customCache });
            expect(result1).toBe("Test string");
            expect(customCache.size).toBe(1);

            // Second call should use cache
            const result2 = sentenceCase(input, { cache: true, cacheStore: customCache });
            expect(result2).toBe("Test string");
            expect(customCache.size).toBe(1);
        });

        it("should not use cache when disabled", () => {
            const customCache = new Map<string, string>();
            const input = "testString";

            // First call without cache
            const result1 = sentenceCase(input, { cache: false, cacheStore: customCache });
            expect(result1).toBe("Test string");
            expect(customCache.size).toBe(0);

            // Second call without cache
            const result2 = sentenceCase(input, { cache: false, cacheStore: customCache });
            expect(result2).toBe("Test string");
            expect(customCache.size).toBe(0);
        });

        it("should respect cache size limit", () => {
            const customCache = new Map<string, string>();
            const input1 = "testString1";
            const input2 = "testString2";

            const options = { cache: true, cacheMaxSize: 1, cacheStore: customCache };

            // First string should be cached
            const result1 = sentenceCase(input1, options);
            expect(customCache.size).toBe(1);
            expect(customCache.get(generateCacheKey(input1, options))).toBe(result1);

            // Second string should be cached due to size limit, the first string should be evicted
            const result2 = sentenceCase(input2, options);
            expect(customCache.size).toBe(1);
            expect(customCache.has(generateCacheKey(input1, options))).toBeFalsy();
            expect(customCache.get(generateCacheKey(input2, options))).toBe(result2);
        });

        it("should handle custom cache store", () => {
            const defaultCache = new Map<string, string>();
            const customCache = new Map<string, string>();
            const input = "testString";

            // Use custom cache
            sentenceCase(input, { cache: true, cacheStore: customCache });
            expect(customCache.size).toBe(1);
            expect(defaultCache.size).toBe(0);
        });
    });

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
        it("should handle emojis in text with stripEmoji=true", () => {
            expect(sentenceCase("Foo🐣Bar", { stripEmoji: true })).toBe("Foo bar");
            expect(sentenceCase("hello🌍World", { stripEmoji: true })).toBe("Hello world");
            expect(sentenceCase("test🎉Party🎈Fun", { stripEmoji: true })).toBe("Test party fun");
            expect(sentenceCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("Emoji gaming");
            expect(sentenceCase("upper🚀Case", { stripEmoji: true })).toBe("Upper case");
            expect(sentenceCase("snake_case_🐍_test", { stripEmoji: true })).toBe("Snake case test");
            expect(sentenceCase("kebab-case-🍔-test", { stripEmoji: true })).toBe("Kebab case test");
            expect(sentenceCase("no📝case", { stripEmoji: true })).toBe("Nocase");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect(sentenceCase("Foo🐣Bar", { handleEmoji: true })).toBe("Foo 🐣 bar");
            expect(sentenceCase("hello🌍World", { handleEmoji: true })).toBe("Hello 🌍 world");
            expect(sentenceCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("Test 🎉 party 🎈 fun");
            expect(sentenceCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("Emoji 👾 gaming");
            expect(sentenceCase("upper🚀Case", { handleEmoji: true })).toBe("Upper 🚀 case");
            expect(sentenceCase("snake_case_🐍_test", { handleEmoji: true })).toBe("Snake case 🐍 test");
            expect(sentenceCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("Kebab case 🍔 test");
            expect(sentenceCase("no📝case", { handleEmoji: true })).toBe("No 📝 case");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect(sentenceCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("Red text");
            expect(sentenceCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("Bold text");
            expect(sentenceCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("Green foo blue bar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect(sentenceCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31m Red text \u001B[0m");
            expect(sentenceCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1m Bold text \u001B[0m");
            expect(sentenceCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32m Green foo \u001B[0m \u001B[34m blue bar \u001B[0m",
            );
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

    it("should handle special formats and mixed cases", () => {
        expect(sentenceCase("C-3PO_and_R2-D2")).toBe("C 3 po and r 2 d 2");
        expect(sentenceCase("The Taking of Pelham 123")).toBe("The taking of pelham 123");
        expect(sentenceCase("Ocean's 11")).toBe("Ocean's 11");
        expect(sentenceCase("21-JUMP-STREET")).toBe("21 jump street");
        expect(sentenceCase("non-SI units")).toBe("Non si units");
        expect(sentenceCase("Red1Green2Blue3")).toBe("Red 1 green 2 blue 3");
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
