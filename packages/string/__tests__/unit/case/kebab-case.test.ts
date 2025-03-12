import { describe, expect, it } from "vitest";

import { kebabCase } from "../../../src/case";
import generateCacheKey from "../../../src/case/utils/generate-cache-key";

describe("kebabCase", () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            expect.assertions(4);
            const customCache = new Map<string, string>();
            const input = "testString";

            // First call should cache
            const result1 = kebabCase(input, { cache: true, cacheStore: customCache });
            expect(result1).toBe("test-string");
            expect(customCache.size).toBe(1);

            // Second call should use cache
            const result2 = kebabCase(input, { cache: true, cacheStore: customCache });
            expect(result2).toBe("test-string");
            expect(customCache.size).toBe(1);
        });

        it("should not use cache when disabled", () => {
            expect.assertions(4);
            const customCache = new Map<string, string>();
            const input = "testString";

            // First call without cache
            const result1 = kebabCase(input, { cache: false, cacheStore: customCache });
            expect(result1).toBe("test-string");
            expect(customCache.size).toBe(0);

            // Second call without cache
            const result2 = kebabCase(input, { cache: false, cacheStore: customCache });
            expect(result2).toBe("test-string");
            expect(customCache.size).toBe(0);
        });

        it("should respect cache size limit", () => {
            expect.assertions(5);
            const customCache = new Map<string, string>();
            const input1 = "testString1";
            const input2 = "testString2";

            const options1 = { cache: true, cacheMaxSize: 1, cacheStore: customCache };
            const options2 = { cache: true, cacheMaxSize: 1, cacheStore: customCache };

            // First string should be cached
            const result1 = kebabCase(input1, options1);
            expect(customCache.size).toBe(1);
            expect(customCache.get(generateCacheKey(input1, options1))).toBe(result1);

            // Second string should be cached due to size limit, the first string should be evicted
            const result2 = kebabCase(input2, options2);
            expect(customCache.size).toBe(1);
            expect(customCache.has(generateCacheKey(input1, options1))).toBeFalsy();
            expect(customCache.get(generateCacheKey(input2, options2))).toBe(result2);
        });

        it("should handle custom cache store", () => {
            expect.assertions(2);
            const defaultCache = new Map<string, string>();
            const customCache = new Map<string, string>();
            const input = "testString";

            // Use custom cache
            kebabCase(input, { cache: true, cacheStore: customCache });
            expect(customCache.size).toBe(1);
            expect(defaultCache.size).toBe(0);
        });
    });

    it("should handle empty string", () => {
        expect.assertions(1);
        expect(kebabCase("")).toBe("");
    });

    it("should preserve lowercase single word", () => {
        expect.assertions(1);
        expect(kebabCase("foo")).toBe("foo");
    });

    it("should handle mixed case with hyphen", () => {
        expect.assertions(2);
        expect(kebabCase("foo-bAr")).toBe("foo-b-ar");
        expect(kebabCase("XMLHttpRequest")).toBe("xml-http-request");
    });

    it("should convert mixed case to hyphen case", () => {
        expect.assertions(1);
        expect(kebabCase("FooBAR")).toBe("foo-bar");
    });

    it("should handle single uppercase letter prefix", () => {
        expect.assertions(1);
        expect(kebabCase("ALink")).toBe("a-link");
    });

    it("should convert snake case to kebab case", () => {
        expect.assertions(1);
        expect(kebabCase("FOO_BAR")).toBe("foo-bar");
    });

    it("should convert camelCase to kebab-case", () => {
        expect.assertions(2);
        expect(kebabCase("fooBar")).toBe("foo-bar");
        expect(kebabCase("fooBarBaz")).toBe("foo-bar-baz");
    });

    it("should convert PascalCase to kebab-case", () => {
        expect.assertions(2);
        expect(kebabCase("FooBar")).toBe("foo-bar");
        expect(kebabCase("FooBarBaz")).toBe("foo-bar-baz");
    });

    it("should convert snake_case to kebab-case", () => {
        expect.assertions(2);
        expect(kebabCase("foo_bar")).toBe("foo-bar");
        expect(kebabCase("foo_bar_baz")).toBe("foo-bar-baz");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with stripEmoji=true", () => {
            expect.assertions(7);
            expect(kebabCase("Foo🐣Bar", { stripEmoji: true })).toBe("foo-bar");
            expect(kebabCase("hello🌍World", { stripEmoji: true })).toBe("hello-world");
            expect(kebabCase("test🎉Party🎈Fun", { stripEmoji: true })).toBe("test-party-fun");
            expect(kebabCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("emoji-gaming");
            expect(kebabCase("upper🚀Case", { stripEmoji: true })).toBe("upper-case");
            expect(kebabCase("snake_case_🐍_test", { stripEmoji: true })).toBe("snake-case-test");
            expect(kebabCase("camelCase🍔Test", { stripEmoji: true })).toBe("camel-case-test");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect.assertions(7);
            expect(kebabCase("Foo🐣Bar", { handleEmoji: true })).toBe("foo-🐣-bar");
            expect(kebabCase("hello🌍World", { handleEmoji: true })).toBe("hello-🌍-world");
            expect(kebabCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("test-🎉-party-🎈-fun");
            expect(kebabCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("emoji-👾-gaming");
            expect(kebabCase("upper🚀Case", { handleEmoji: true })).toBe("upper-🚀-case");
            expect(kebabCase("snake_case_🐍_test", { handleEmoji: true })).toBe("snake-case-🐍-test");
            expect(kebabCase("camelCase🍔Test", { handleEmoji: true })).toBe("camel-case-🍔-test");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect.assertions(3);
            expect(kebabCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("red-text");
            expect(kebabCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("bold-text");
            expect(kebabCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("green-foo-blue-bar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect.assertions(3);
            expect(kebabCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mred-text\u001B[0m");
            expect(kebabCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mbold-text\u001B[0m");
            expect(kebabCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mgreen-foo\u001B[0m-\u001B[34mblue-bar\u001B[0m",
            );
        });
    });

    it("should convert space separated to kebab-case", () => {
        expect.assertions(2);
        expect(kebabCase("foo bar")).toBe("foo-bar");
        expect(kebabCase("foo bar baz")).toBe("foo-bar-baz");
    });

    it("should handle special formats and mixed cases", () => {
        expect.assertions(6);
        expect(kebabCase("7samurai")).toBe("7-samurai");
        expect(kebabCase("14BLADES")).toBe("14blades");
        expect(kebabCase("Happy2-see-you")).toBe("happy-2-see-you");
        expect(kebabCase("B-C-D")).toBe("b-c-d");
        expect(kebabCase("48-HOLA-mundo-6")).toBe("48-hola-mundo-6");
        expect(kebabCase("non-SI units")).toBe("non-si-units");
    });

    describe("locale support", () => {
        it("should handle German specific cases", () => {
            expect.assertions(3);
            const locale = "de-DE";
            expect(kebabCase("großeStrasse", { locale })).toBe("große-strasse");
            expect(kebabCase("GROSSE", { locale })).toBe("große");
            expect(kebabCase("GROßE STRAßE", { locale })).toBe("große-straße");
        });
    });
});
