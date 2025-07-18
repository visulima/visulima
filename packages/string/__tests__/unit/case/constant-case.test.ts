import { describe, expect, it } from "vitest";

import { constantCase } from "../../../src/case";
import LRUCache from "../../../src/utils/lru-cache";

describe(constantCase, () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            expect.assertions(4);

            const customCache = new LRUCache<string, string>(50);
            const input = "test-string";

            // First call should cache
            const result1 = constantCase(input, { cache: true, cacheStore: customCache });

            expect(result1).toBe("TEST_STRING");
            expect(customCache.size()).toBe(1);

            // Second call should use cache
            const result2 = constantCase(input, { cache: true, cacheStore: customCache });

            expect(result2).toBe("TEST_STRING");
            expect(customCache.size()).toBe(1);
        });

        it("should not use cache when disabled", () => {
            expect.assertions(4);

            const customCache = new LRUCache<string, string>(50);
            const input = "test-string";

            // First call without cache
            const result1 = constantCase(input, { cache: false, cacheStore: customCache });

            expect(result1).toBe("TEST_STRING");
            expect(customCache.size()).toBe(0);

            // Second call without cache
            const result2 = constantCase(input, { cache: false, cacheStore: customCache });

            expect(result2).toBe("TEST_STRING");
            expect(customCache.size()).toBe(0);
        });

        it("should handle custom cache store", () => {
            expect.assertions(1);

            const customCache = new LRUCache<string, string>(50);
            const input = "test-string";

            // Use custom cache
            constantCase(input, { cache: true, cacheStore: customCache });

            expect(customCache.size()).toBe(1);
        });
    });

    it("should handle empty string", () => {
        expect.assertions(1);
        expect(constantCase("")).toBe("");
    });

    it("should convert single word to constant case", () => {
        expect.assertions(1);
        expect(constantCase("foo")).toBe("FOO");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect.assertions(2);
        expect(constantCase("foo-bAr")).toBe("FOO_B_AR");
        expect(constantCase("XMLHttpRequest")).toBe("XML_HTTP_REQUEST");
    });

    it("should handle multiple separators", () => {
        expect.assertions(2);
        expect(constantCase("foo_bar-baz/qux")).toBe("FOO_BAR_BAZ_QUX");
        expect(constantCase("foo_BAR-baz/QUX")).toBe("FOO_BAR_BAZ_QUX");
    });

    it("should handle snake case", () => {
        expect.assertions(2);
        expect(constantCase("FOO_BAR")).toBe("FOO_BAR");
        expect(constantCase("FOO_BAR_BAZ")).toBe("FOO_BAR_BAZ");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect.assertions(2);
        expect(constantCase("foo--bar-Baz")).toBe("FOO_BAR_BAZ");
        expect(constantCase("foo--BAR-baz")).toBe("FOO_BAR_BAZ");
    });

    it("should convert snake_case to CONSTANT_CASE", () => {
        expect.assertions(3);
        expect(constantCase("foo_bar")).toBe("FOO_BAR");
        expect(constantCase("foo_bar_baz")).toBe("FOO_BAR_BAZ");
        expect(constantCase("foo_BAR_baz")).toBe("FOO_BAR_BAZ");
    });

    it("should convert kebab-case to CONSTANT_CASE", () => {
        expect.assertions(3);
        expect(constantCase("foo-bar")).toBe("FOO_BAR");
        expect(constantCase("foo-bar-baz")).toBe("FOO_BAR_BAZ");
        expect(constantCase("foo-BAR-baz")).toBe("FOO_BAR_BAZ");
    });

    it("should convert space separated to CONSTANT_CASE", () => {
        expect.assertions(3);
        expect(constantCase("foo bar")).toBe("FOO_BAR");
        expect(constantCase("foo bar baz")).toBe("FOO_BAR_BAZ");
        expect(constantCase("foo BAR baz")).toBe("FOO_BAR_BAZ");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with stripEmoji=true", () => {
            expect.assertions(8);
            expect(constantCase("Foo🐣Bar", { stripEmoji: true })).toBe("FOO_BAR");
            expect(constantCase("hello🌍World", { stripEmoji: true })).toBe("HELLO_WORLD");
            expect(constantCase("test🎉Party🎈Fun", { stripEmoji: true })).toBe("TEST_PARTY_FUN");
            expect(constantCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("EMOJI_GAMING");
            expect(constantCase("upper🚀Case", { stripEmoji: true })).toBe("UPPER_CASE");
            expect(constantCase("snake_case_🐍_test", { stripEmoji: true })).toBe("SNAKE_CASE_TEST");
            expect(constantCase("kebab-case-🍔-test", { stripEmoji: true })).toBe("KEBAB_CASE_TEST");
            expect(constantCase("welcome to the 🎉party", { stripEmoji: true })).toBe("WELCOME_TO_THE_PARTY");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect.assertions(8);
            expect(constantCase("Foo🐣Bar", { handleEmoji: true })).toBe("FOO_🐣_BAR");
            expect(constantCase("hello🌍World", { handleEmoji: true })).toBe("HELLO_🌍_WORLD");
            expect(constantCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("TEST_🎉_PARTY_🎈_FUN");
            expect(constantCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("EMOJI_👾_GAMING");
            expect(constantCase("upper🚀Case", { handleEmoji: true })).toBe("UPPER_🚀_CASE");
            expect(constantCase("snake_case_🐍_test", { handleEmoji: true })).toBe("SNAKE_CASE_🐍_TEST");
            expect(constantCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("KEBAB_CASE_🍔_TEST");
            expect(constantCase("welcome to the 🎉party", { handleEmoji: true })).toBe("WELCOME_TO_THE_🎉_PARTY");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect.assertions(3);
            expect(constantCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("RED_TEXT");
            expect(constantCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("BOLD_TEXT");
            expect(constantCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("GREEN_FOO_BLUE_BAR");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect.assertions(3);
            expect(constantCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mRED_TEXT\u001B[0m");
            expect(constantCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mBOLD_TEXT\u001B[0m");
            expect(constantCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mGREEN_FOO\u001B[0m_\u001B[34mBLUE_BAR\u001B[0m",
            );
        });
    });

    it("should handle camelCase input", () => {
        expect.assertions(3);
        expect(constantCase("fooBar")).toBe("FOO_BAR");
        expect(constantCase("fooBarBaz")).toBe("FOO_BAR_BAZ");
        expect(constantCase("fooBarBAZ")).toBe("FOO_BAR_BAZ");
    });

    it("should handle special acronyms", () => {
        expect.assertions(5);
        expect(constantCase("XML_HTTP_request")).toBe("XML_HTTP_REQUEST");
        expect(constantCase("XMLHTTPRequest")).toBe("XMLHTTP_REQUEST");
        expect(constantCase("AJAXRequest")).toBe("AJAX_REQUEST");
        expect(constantCase("IFrameElement")).toBe("I_FRAME_ELEMENT");
        expect(constantCase("iOS_app")).toBe("I_OS_APP");
    });

    it("should handle special formats and mixed cases", () => {
        expect.assertions(5);
        expect(constantCase("fantastic-4")).toBe("FANTASTIC_4");
        expect(constantCase("Apollo13")).toBe("APOLLO_13");
        expect(constantCase("you-have-0-money")).toBe("YOU_HAVE_0_MONEY");
        expect(constantCase("123BC456BC789")).toBe("123BC456BC789");
        expect(constantCase("DISTRICT_9")).toBe("DISTRICT_9");
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            expect.assertions(2);

            const locale = "tr-TR";

            expect(constantCase("istanbul_city", { locale })).toBe("İSTANBUL_CİTY");
            expect(constantCase("İZMİR_CITY", { locale })).toBe("İZMİR_CITY");
        });

        it("should handle German specific cases", () => {
            expect.assertions(3);

            const locale = "de-DE";

            expect(constantCase("GROSSE STRAßE", { locale })).toBe("GROSSE_STRASSE");
            expect(constantCase("GROSSE STRASSE", { locale })).toBe("GROSSE_STRASSE");
            expect(constantCase("GROßE STRAßE", { locale })).toBe("GROSSE_STRASSE");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect.assertions(1);
            expect(constantCase("test_string", { locale: "invalid-locale" })).toBe("TEST_STRING");
        });
    });
});
