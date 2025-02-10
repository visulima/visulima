import { describe, expect, it, test } from "vitest";

import { pascalCase } from "../../../src/case";
import { generateCacheKey } from "../../../src/case/utils/generate-cache-key";

describe("pascalCase", () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            const customCache = new Map<string, string>();
            const input = "test-string";

            // First call should cache
            const result1 = pascalCase(input, { cache: true, cacheStore: customCache });
            expect(result1).toBe("TestString");
            expect(customCache.size).toBe(1);

            // Second call should use cache
            const result2 = pascalCase(input, { cache: true, cacheStore: customCache });
            expect(result2).toBe("TestString");
            expect(customCache.size).toBe(1);
        });

        it("should not use cache when disabled", () => {
            const customCache = new Map<string, string>();
            const input = "test-string";

            // First call without cache
            const result1 = pascalCase(input, { cache: false, cacheStore: customCache });
            expect(result1).toBe("TestString");
            expect(customCache.size).toBe(0);

            // Second call without cache
            const result2 = pascalCase(input, { cache: false, cacheStore: customCache });
            expect(result2).toBe("TestString");
            expect(customCache.size).toBe(0);
        });

        it("should respect cache size limit", () => {
            const customCache = new Map<string, string>();
            const input1 = "test-string-1";
            const input2 = "test-string-2";

            const options1 = { cache: true, cacheMaxSize: 1, cacheStore: customCache };
            const options2 = { cache: true, cacheMaxSize: 1, cacheStore: customCache };

            // First string should be cached
            const result1 = pascalCase(input1, options1);
            expect(customCache.size).toBe(1);
            expect(customCache.get(generateCacheKey(input1, options1))).toBe(result1);

            // Second string should be cached due to size limit, the first string should be evicted
            const result2 = pascalCase(input2, options2);
            expect(customCache.size).toBe(1);
            expect(customCache.has(generateCacheKey(input1, options1))).toBeFalsy();
            expect(customCache.get(generateCacheKey(input2, options2))).toBe(result2);
        });

        it("should handle custom cache store", () => {
            const defaultCache = new Map<string, string>();
            const customCache = new Map<string, string>();
            const input = "test-string";

            // Use custom cache
            pascalCase(input, { cache: true, cacheStore: customCache });
            expect(customCache.size).toBe(1);
            expect(defaultCache.size).toBe(0);
        });
    });

    it("should handle empty string", () => {
        expect(pascalCase("")).toBe("");
    });

    it("should convert single word to pascal case", () => {
        expect(pascalCase("foo")).toBe("Foo");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect(pascalCase("foo-bAr")).toBe("FooBAr");
        expect(pascalCase("XMLHttpRequest")).toBe("XmlHttpRequest");
    });

    it("should preserve mixed case", () => {
        expect(pascalCase("FooBARb")).toBe("FooBaRb");
    });

    it("should handle multiple separators", () => {
        expect(pascalCase("foo_bar-baz/qux")).toBe("FooBarBazQux");
    });

    it("should handle snake case", () => {
        expect(pascalCase("FOO_BAR")).toBe("FooBar");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect(pascalCase("foo--bar-Baz")).toBe("FooBarBaz");
    });

    it("should convert snake_case to PascalCase", () => {
        expect(pascalCase("foo_bar")).toBe("FooBar");
        expect(pascalCase("foo_bar_baz")).toBe("FooBarBaz");
    });

    it("should convert kebab-case to PascalCase", () => {
        expect(pascalCase("foo-bar")).toBe("FooBar");
        expect(pascalCase("foo-bar-baz")).toBe("FooBarBaz");
    });

    it("should convert space separated to PascalCase", () => {
        expect(pascalCase("foo bar")).toBe("FooBar");
        expect(pascalCase("foo bar baz")).toBe("FooBarBaz");
    });

    it("should handle camelCase input", () => {
        expect(pascalCase("fooBar")).toBe("FooBar");
    });

    it("should handle special formats and mixed cases", () => {
        expect(pascalCase("C-3PO_and_R2-D2")).toBe("C3PoAndR2D2");
        expect(pascalCase("The Taking of Pelham 123")).toBe("TheTakingOfPelham123");
        expect(pascalCase("Ocean's 11")).toBe("Ocean's11");
        expect(pascalCase("Hello5My5Name5Is5Bond")).toBe("Hello5My5Name5Is5Bond");
        expect(pascalCase("i-do--not--0like--number0")).toBe("IDoNot0LikeNumber0");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with handleEmoji=false (default)", () => {
            expect(pascalCase("Foo🐣Bar")).toBe("FooBar");
            expect(pascalCase("hello🌍World")).toBe("HelloWorld");
            expect(pascalCase("test🎉Party🎈Fun")).toBe("TestPartyFun");
            expect(pascalCase("EMOJI👾Gaming")).toBe("EmojiGaming");
            expect(pascalCase("upper🚀Case")).toBe("UpperCase");
            expect(pascalCase("snake_case_🐍_test")).toBe("SnakeCaseTest");
            expect(pascalCase("kebab-case-🍔-test")).toBe("KebabCaseTest");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect(pascalCase("Foo🐣Bar", { handleEmoji: true })).toBe("Foo🐣Bar");
            expect(pascalCase("hello🌍World", { handleEmoji: true })).toBe("Hello🌍World");
            expect(pascalCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("Test🎉Party🎈Fun");
            expect(pascalCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("Emoji👾Gaming");
            expect(pascalCase("upper🚀Case", { handleEmoji: true })).toBe("Upper🚀Case");
            expect(pascalCase("snake_case_🐍_test", { handleEmoji: true })).toBe("SnakeCase🐍Test");
            expect(pascalCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("KebabCase🍔Test");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with handleAnsi=false (default)", () => {
            expect(pascalCase("\u001B[31mRedText\u001B[0m")).toBe("RedText");
            expect(pascalCase("\u001B[1mBoldText\u001B[0m")).toBe("BoldText");
            expect(pascalCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m")).toBe("GreenFooBlueBar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect(pascalCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mRedText\u001B[0m");
            expect(pascalCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mBoldText\u001B[0m");
            expect(pascalCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mGreenFoo\u001B[0m\u001B[34mBlueBar\u001B[0m",
            );
        });
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(pascalCase("istanbul_city", { locale })).toBe("İstanbulCity");
            expect(pascalCase("izmir_city", { locale })).toBe("İzmirCity");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(pascalCase("GROSSE STRAßE", { locale })).toBe("GroßeStraße");
            expect(pascalCase("GROSSE STRASSE", { locale })).toBe("GroßeStraße");
            expect(pascalCase("GROßE STRAßE", { locale })).toBe("GroßeStraße");
        });
    });
});
