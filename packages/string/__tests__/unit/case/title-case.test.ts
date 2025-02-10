import { describe, expect, it } from "vitest";

import { titleCase } from "../../../src/case";
import { generateCacheKey } from "../../../src/case/utils/generate-cache-key";

describe("titleCase", () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            const customCache = new Map<string, string>();
            const input = "test-string";

            // First call should cache
            const result1 = titleCase(input, { cache: true, cacheStore: customCache });
            expect(result1).toBe("Test String");
            expect(customCache.size).toBe(1);

            // Second call should use cache
            const result2 = titleCase(input, { cache: true, cacheStore: customCache });
            expect(result2).toBe("Test String");
            expect(customCache.size).toBe(1);
        });

        it("should not use cache when disabled", () => {
            const customCache = new Map<string, string>();
            const input = "test-string";

            // First call without cache
            const result1 = titleCase(input, { cache: false, cacheStore: customCache });
            expect(result1).toBe("Test String");
            expect(customCache.size).toBe(0);

            // Second call without cache
            const result2 = titleCase(input, { cache: false, cacheStore: customCache });
            expect(result2).toBe("Test String");
            expect(customCache.size).toBe(0);
        });

        it("should respect cache size limit", () => {
            const customCache = new Map<string, string>();
            const input1 = "test-string-1";
            const input2 = "test-string-2";

            const options1 = { cache: true, cacheMaxSize: 1, cacheStore: customCache };
            const options2 = { cache: true, cacheMaxSize: 1, cacheStore: customCache };

            // First string should be cached
            const result1 = titleCase(input1, options1);
            expect(customCache.size).toBe(1);
            expect(customCache.get(generateCacheKey(input1, options1))).toBe(result1);

            // Second string should be cached due to size limit, the first string should be evicted
            const result2 = titleCase(input2, options2);
            expect(customCache.size).toBe(1);
            expect(customCache.has(generateCacheKey(input1, options1))).toBeFalsy();
            expect(customCache.get(generateCacheKey(input2, options2))).toBe(result2);
        });

        it("should handle custom cache store", () => {
            const defaultCache = new Map<string, string>();
            const customCache = new Map<string, string>();
            const input = "test-string";

            // Use custom cache
            titleCase(input, { cache: true, cacheStore: customCache });
            expect(customCache.size).toBe(1);
            expect(defaultCache.size).toBe(0);
        });
    });

    it("should handle empty string", () => {
        expect(titleCase("")).toBe("");
    });

    it("should capitalize single letter", () => {
        expect(titleCase("f")).toBe("F");
    });

    it("should capitalize single word", () => {
        expect(titleCase("foo")).toBe("Foo");
    });

    it("should handle mixed case with hyphens", () => {
        expect(titleCase("this-IS-aTitle")).toBe("This Is A Title");
        expect(titleCase("XMLHttpRequest")).toBe("Xml Http Request");
    });

    it("should handle mixed separators", () => {
        expect(titleCase("is_this ATitle")).toBe("Is This A Title");
    });

    it("should handle punctuation", () => {
        expect(titleCase("hello, world!")).toBe("Hello, World!");
    });

    it("should convert camelCase to Title Case", () => {
        expect(titleCase("fooBar")).toBe("Foo Bar");
        expect(titleCase("fooBarBaz")).toBe("Foo Bar Baz");
    });

    it("should convert PascalCase to Title Case", () => {
        expect(titleCase("FooBar")).toBe("Foo Bar");
        expect(titleCase("FooBarBaz")).toBe("Foo Bar Baz");
    });

    it("should convert snake_case to Title Case", () => {
        expect(titleCase("foo_bar")).toBe("Foo Bar");
        expect(titleCase("foo_bar_baz")).toBe("Foo Bar Baz");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with handleEmoji=false (default)", () => {
            expect(titleCase("Foo🐣Bar")).toBe("Foo Bar");
            expect(titleCase("hello🌍World")).toBe("Hello World");
            expect(titleCase("test🎉Party🎈Fun")).toBe("Test Party Fun");
            expect(titleCase("EMOJI👾Gaming")).toBe("Emoji Gaming");
            expect(titleCase("upper🚀Case")).toBe("Upper Case");
            expect(titleCase("snake_case_🐍_test")).toBe("Snake Case  Test");
            expect(titleCase("kebab-case-🍔-test")).toBe("Kebab Case Test");
            expect(titleCase("welcome to the 🎉party")).toBe("Welcome To The Party");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect(titleCase("Foo🐣Bar", { handleEmoji: true })).toBe("Foo 🐣 Bar");
            expect(titleCase("hello🌍World", { handleEmoji: true })).toBe("Hello 🌍 World");
            expect(titleCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("Test 🎉 Party 🎈 Fun");
            expect(titleCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("Emoji 👾 Gaming");
            expect(titleCase("upper🚀Case", { handleEmoji: true })).toBe("Upper 🚀 Case");
            expect(titleCase("snake_case_🐍_test", { handleEmoji: true })).toBe("Snake Case 🐍 Test");
            expect(titleCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("Kebab Case 🍔 Test");
            expect(titleCase("welcome to the 🎉party", { handleEmoji: true })).toBe("Welcome To The 🎉 Party");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with handleAnsi=false (default)", () => {
            expect(titleCase("\u001B[31mRedText\u001B[0m")).toBe("Red Text");
            expect(titleCase("\u001B[1mBoldText\u001B[0m")).toBe("Bold Text");
            expect(titleCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m")).toBe("Green Foo Blue Bar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect(titleCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31m Red Text \u001B[0m");
            expect(titleCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1m Bold Text \u001B[0m");
            expect(titleCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32m Green Foo \u001B[0m \u001B[34m Blue Bar \u001B[0m",
            );
        });
    });

    it("should convert kebab-case to Title Case", () => {
        expect(titleCase("foo-bar")).toBe("Foo Bar");
        expect(titleCase("foo-bar-baz")).toBe("Foo Bar Baz");
    });

    it("should handle minor words correctly", () => {
        expect(titleCase("the quick brown fox")).toBe("The Quick Brown Fox");
        expect(titleCase("a tale of two cities")).toBe("A Tale Of Two Cities");
        expect(titleCase("to kill a mockingbird")).toBe("To Kill A Mockingbird");
    });

    it("should handle mixed case with numbers and special characters", () => {
        expect(titleCase("foo123Bar")).toBe("Foo 123 Bar");
        expect(titleCase("foo_bar-baz")).toBe("Foo Bar Baz");
        expect(titleCase("FOO BAR_BAZ-QUX")).toBe("Foo Bar Baz Qux");
        expect(titleCase("session9")).toBe("Session 9");
        expect(titleCase("planet_51")).toBe("Planet 51");
        expect(titleCase("United9")).toBe("United 9");
        expect(titleCase("The Taking of Pelham 123")).toBe("The Taking Of Pelham 123");
        expect(titleCase("Ocean's 11")).toBe("Ocean's 11");
    });

    describe("locale support", () => {
        const locale = "tr-TR";

        it("should handle Turkish specific cases", () => {
            expect(titleCase("istanbul", { locale })).toBe("İstanbul");
            expect(titleCase("İSTANBUL", { locale })).toBe("İstanbul");
            expect(titleCase("izmir ankara", { locale })).toBe("İzmir Ankara");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(titleCase("GROSSE STRAßE", { locale })).toBe("Große Straße");
            expect(titleCase("GROSSE STRASSE", { locale })).toBe("Große Straße");
            expect(titleCase("GROßE STRAßE", { locale })).toBe("Große Straße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect(titleCase("test string", { locale: "invalid-locale" })).toBe("Test String");
        });
    });
});
