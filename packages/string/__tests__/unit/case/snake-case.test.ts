import { describe, expect, it } from "vitest";

import { snakeCase } from "../../../src/case";
import LRUCache from "../../../src/utils/lru-cache";

describe(snakeCase, () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            expect.assertions(4);

            const customCache = new LRUCache<string, string>(50);
            const input = "testString";

            // First call should cache
            const result1 = snakeCase(input, { cache: true, cacheStore: customCache });

            expect(result1).toBe("test_string");
            expect(customCache.size()).toBe(1);

            // Second call should use cache
            const result2 = snakeCase(input, { cache: true, cacheStore: customCache });

            expect(result2).toBe("test_string");
            expect(customCache.size()).toBe(1);
        });

        it("should not use cache when disabled", () => {
            expect.assertions(4);

            const customCache = new LRUCache<string, string>(50);
            const input = "testString";

            // First call without cache
            const result1 = snakeCase(input, { cache: false, cacheStore: customCache });

            expect(result1).toBe("test_string");
            expect(customCache.size()).toBe(0);

            // Second call without cache
            const result2 = snakeCase(input, { cache: false, cacheStore: customCache });

            expect(result2).toBe("test_string");
            expect(customCache.size()).toBe(0);
        });

        it("should handle custom cache store", () => {
            expect.assertions(1);

            const customCache = new LRUCache<string, string>(50);
            const input = "testString";

            // Use custom cache
            snakeCase(input, { cache: true, cacheStore: customCache });

            expect(customCache.size()).toBe(1);
        });
    });

    it("should convert pascal case to snake case", () => {
        expect.assertions(2);
        expect(snakeCase("FooBarBaz")).toBe("foo_bar_baz");
        expect(snakeCase("XMLHttpRequest")).toBe("xml_http_request");
    });

    it("should normalize uppercase snake case", () => {
        expect.assertions(1);
        expect(snakeCase("FOO_BAR")).toBe("foo_bar");
    });

    it("should convert camelCase to snake_case", () => {
        expect.assertions(2);
        expect(snakeCase("fooBar")).toBe("foo_bar");
        expect(snakeCase("fooBarBaz")).toBe("foo_bar_baz");
    });

    it("should convert PascalCase to snake_case", () => {
        expect.assertions(2);
        expect(snakeCase("FooBar")).toBe("foo_bar");
        expect(snakeCase("FooBarBaz")).toBe("foo_bar_baz");
    });

    it("should convert kebab-case to snake_case", () => {
        expect.assertions(2);
        expect(snakeCase("foo-bar")).toBe("foo_bar");
        expect(snakeCase("foo-bar-baz")).toBe("foo_bar_baz");
    });

    it("should convert space separated to snake_case", () => {
        expect.assertions(2);
        expect(snakeCase("foo bar")).toBe("foo_bar");
        expect(snakeCase("foo bar baz")).toBe("foo_bar_baz");
    });

    it("should handle empty string", () => {
        expect.assertions(1);
        expect(snakeCase("")).toBe("");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with stripEmoji=true", () => {
            expect.assertions(8);
            expect(snakeCase("Foo🐣Bar", { stripEmoji: true })).toBe("foo_bar");
            expect(snakeCase("hello🌍World", { stripEmoji: true })).toBe("hello_world");
            expect(snakeCase("test🎉Party🎈Fun", { stripEmoji: true })).toBe("test_party_fun");
            expect(snakeCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("emoji_gaming");
            expect(snakeCase("upper🚀Case", { stripEmoji: true })).toBe("upper_case");
            expect(snakeCase("camelCase🐪Test", { stripEmoji: true })).toBe("camel_case_test");
            expect(snakeCase("kebab-case-🍔-test", { stripEmoji: true })).toBe("kebab_case_test");
            expect(snakeCase("welcome to the 🎉party", { stripEmoji: true })).toBe("welcome_to_the_party");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect.assertions(8);
            expect(snakeCase("Foo🐣Bar", { handleEmoji: true })).toBe("foo_🐣_bar");
            expect(snakeCase("hello🌍World", { handleEmoji: true })).toBe("hello_🌍_world");
            expect(snakeCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("test_🎉_party_🎈_fun");
            expect(snakeCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("emoji_👾_gaming");
            expect(snakeCase("upper🚀Case", { handleEmoji: true })).toBe("upper_🚀_case");
            expect(snakeCase("camelCase🐪Test", { handleEmoji: true })).toBe("camel_case_🐪_test");
            expect(snakeCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("kebab_case_🍔_test");
            expect(snakeCase("welcome to the 🎉party", { handleEmoji: true })).toBe("welcome_to_the_🎉_party");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect.assertions(3);
            expect(snakeCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("red_text");
            expect(snakeCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("bold_text");
            expect(snakeCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("green_foo_blue_bar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect.assertions(3);
            expect(snakeCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mred_text\u001B[0m");
            expect(snakeCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mbold_text\u001B[0m");
            expect(snakeCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mgreen_foo\u001B[0m_\u001B[34mblue_bar\u001B[0m",
            );
        });
    });

    it("should handle special formats and mixed cases", () => {
        expect.assertions(5);
        expect(snakeCase("C-3PO_and_R2-D2")).toBe("c_3po_and_r2_d2");
        expect(snakeCase("3_idiots_2009")).toBe("3_idiots_2009");
        expect(snakeCase("12_angry_men")).toBe("12_angry_men");
        expect(snakeCase("48-HOLA-mundo-6")).toBe("48_hola_mundo_6");
        expect(snakeCase("IDoNot0LikeNumber0")).toBe("i_do_not_0_like_number_0");
    });

    describe("locale support", () => {
        it("should handle German specific cases", () => {
            expect.assertions(3);

            const locale = "de-DE";

            expect(snakeCase("großeStrasse", { locale })).toBe("große_strasse");
            expect(snakeCase("GROSSE", { locale })).toBe("große");
            expect(snakeCase("GROßE STRAßE", { locale })).toBe("große_straße");
        });
    });
});
