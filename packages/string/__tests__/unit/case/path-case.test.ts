import { describe, expect, it } from "vitest";

import { pathCase } from "../../../src/case";
import LRUCache from "../../../src/utils/lru-cache";

describe("pathCase", () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            expect.assertions(4);
            const customCache = new LRUCache<string, string>(50);
            const input = "testString";

            // First call should cache
            const result1 = pathCase(input, { cache: true, cacheStore: customCache });
            expect(result1).toBe("test/string");
            expect(customCache.size()).toBe(1);

            // Second call should use cache
            const result2 = pathCase(input, { cache: true, cacheStore: customCache });
            expect(result2).toBe("test/string");
            expect(customCache.size()).toBe(1);
        });

        it("should not use cache when disabled", () => {
            expect.assertions(4);
            const customCache = new LRUCache<string, string>(50);
            const input = "testString";

            // First call without cache
            const result1 = pathCase(input, { cache: false, cacheStore: customCache });
            expect(result1).toBe("test/string");
            expect(customCache.size()).toBe(0);

            // Second call without cache
            const result2 = pathCase(input, { cache: false, cacheStore: customCache });
            expect(result2).toBe("test/string");
            expect(customCache.size()).toBe(0);
        });

        it("should handle custom cache store", () => {
            expect.assertions(1);

            const customCache = new LRUCache<string, string>(50);
            const input = "testString";

            // Use custom cache
            pathCase(input, { cache: true, cacheStore: customCache });
            expect(customCache.size()).toBe(1);
        });
    });

    it("should handle empty string", () => {
        expect.assertions(1);
        expect(pathCase("")).toBe("");
    });

    it("should convert single word to path case", () => {
        expect.assertions(1);
        expect(pathCase("foo")).toBe("foo");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect.assertions(2);
        expect(pathCase("foo-bAr")).toBe("foo/b/ar");
        expect(pathCase("XMLHttpRequest")).toBe("xml/http/request");
    });

    it("should handle multiple separators", () => {
        expect.assertions(1);
        expect(pathCase("foo_bar-baz/qux")).toBe("foo/bar/baz/qux");
    });

    it("should handle snake case", () => {
        expect.assertions(1);
        expect(pathCase("FOO_BAR")).toBe("foo/bar");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect.assertions(1);
        expect(pathCase("foo--bar-Baz")).toBe("foo/bar/baz");
    });

    it("should convert snake_case to path/case", () => {
        expect.assertions(2);
        expect(pathCase("foo_bar")).toBe("foo/bar");
        expect(pathCase("foo_bar_baz")).toBe("foo/bar/baz");
    });

    it("should convert kebab-case to path/case", () => {
        expect.assertions(2);
        expect(pathCase("foo-bar")).toBe("foo/bar");
        expect(pathCase("foo-bar-baz")).toBe("foo/bar/baz");
    });

    it("should convert space separated to path/case", () => {
        expect.assertions(2);
        expect(pathCase("foo bar")).toBe("foo/bar");
        expect(pathCase("foo bar baz")).toBe("foo/bar/baz");
    });

    it("should handle camelCase input", () => {
        expect.assertions(1);
        expect(pathCase("fooBar")).toBe("foo/bar");
    });

    it("should handle special formats and mixed cases", () => {
        expect.assertions(6);
        expect(pathCase("C-3PO_and_R2-D2")).toBe("c/3po/and/r2/d2");
        expect(pathCase("src/components/Button.tsx")).toBe("src/components/button/tsx");
        expect(pathCase("path/to/file/v1.2.3")).toBe("path/to/file/v/1/2/3");
        expect(pathCase("48-HOLA-mundo-6")).toBe("48/hola/mundo/6");
        expect(pathCase("non-SI units")).toBe("non/si/units");
        expect(pathCase("Red1Green2Blue3")).toBe("red/1/green/2/blue/3");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with stripEmoji=true", () => {
            expect.assertions(9);
            expect(pathCase("Foo🐣Bar", { stripEmoji: true })).toBe("foo/bar");
            expect(pathCase("hello🌍World", { stripEmoji: true })).toBe("hello/world");
            expect(pathCase("test🎉Party🎈Fun", { stripEmoji: true })).toBe("test/party/fun");
            expect(pathCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("emoji/gaming");
            expect(pathCase("upper🚀Case", { stripEmoji: true })).toBe("upper/case");
            expect(pathCase("snake_case_🐍_test", { stripEmoji: true })).toBe("snake/case/test");
            expect(pathCase("kebab-case-🍔-test", { stripEmoji: true })).toBe("kebab/case/test");
            expect(pathCase("path/to/📁/file", { stripEmoji: true })).toBe("path/to/file");
            expect(pathCase("welcome to the 🎉party", { stripEmoji: true })).toBe("welcome/to/the/party");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect.assertions(9);
            expect(pathCase("Foo🐣Bar", { handleEmoji: true })).toBe("foo/🐣/bar");
            expect(pathCase("hello🌍World", { handleEmoji: true })).toBe("hello/🌍/world");
            expect(pathCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("test/🎉/party/🎈/fun");
            expect(pathCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("emoji/👾/gaming");
            expect(pathCase("upper🚀Case", { handleEmoji: true })).toBe("upper/🚀/case");
            expect(pathCase("snake_case_🐍_test", { handleEmoji: true })).toBe("snake/case/🐍/test");
            expect(pathCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("kebab/case/🍔/test");
            expect(pathCase("path/to/📁/file", { handleEmoji: true })).toBe("path/to/📁/file");
            expect(pathCase("welcome to the 🎉party", { handleEmoji: true })).toBe("welcome/to/the/🎉/party");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect.assertions(3);
            expect(pathCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("red/text");
            expect(pathCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("bold/text");
            expect(pathCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("green/foo/blue/bar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect.assertions(3);
            expect(pathCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mred/text\u001B[0m");
            expect(pathCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mbold/text\u001B[0m");
            expect(pathCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mgreen/foo\u001B[0m/\u001B[34mblue/bar\u001B[0m",
            );
        });
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            expect.assertions(2);
            const locale = "tr-TR";
            expect(pathCase("istanbul_city", { locale })).toBe("istanbul/city");
            expect(pathCase("İZMİR_CITY", { locale })).toBe("izmir/cıty");
        });

        it("should handle German specific cases", () => {
            expect.assertions(3);
            const locale = "de-DE";
            expect(pathCase("GROSSE STRAßE", { locale })).toBe("große/straße");
            expect(pathCase("GROSSE STRASSE", { locale })).toBe("große/straße");
            expect(pathCase("GROßE STRAßE", { locale })).toBe("große/straße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect.assertions(1);
            expect(pathCase("test_string", { locale: "invalid-locale" })).toBe("test/string");
        });
    });
});
