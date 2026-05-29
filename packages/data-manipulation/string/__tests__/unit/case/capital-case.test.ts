import { describe, expect, it } from "vitest";

import { capitalCase } from "../../../src/case";
import LRUCache from "../../../src/utils/lru-cache";

describe(capitalCase, () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            expect.assertions(4);

            const customCache = new LRUCache<string, string>(50);
            const input = "test-string";

            // First call should cache
            const result1 = capitalCase(input, { cache: true, cacheStore: customCache });

            expect(result1).toBe("Test String");
            expect(customCache.size()).toBe(1);

            // Second call should use cache
            const result2 = capitalCase(input, { cache: true, cacheStore: customCache });

            expect(result2).toBe("Test String");
            expect(customCache.size()).toBe(1);
        });

        it("should not use cache when disabled", () => {
            expect.assertions(4);

            const customCache = new LRUCache<string, string>(50);
            const input = "test-string";

            // First call without cache
            const result1 = capitalCase(input, { cache: false, cacheStore: customCache });

            expect(result1).toBe("Test String");
            expect(customCache.size()).toBe(0);

            // Second call without cache
            const result2 = capitalCase(input, { cache: false, cacheStore: customCache });

            expect(result2).toBe("Test String");
            expect(customCache.size()).toBe(0);
        });

        it("should handle custom cache store", () => {
            expect.assertions(1);

            const customCache = new LRUCache<string, string>(50);
            const input = "test-string";

            // Use custom cache
            capitalCase(input, { cache: true, cacheStore: customCache });

            expect(customCache.size()).toBe(1);
        });
    });

    it("should handle empty string", () => {
        expect.assertions(1);
        expect(capitalCase("")).toBe("");
    });

    it("should convert single word to capital case", () => {
        expect.assertions(1);
        expect(capitalCase("foo")).toBe("Foo");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect.assertions(2);
        expect(capitalCase("foo-bAr")).toBe("Foo B Ar");
        expect(capitalCase("XMLHttpRequest")).toBe("Xml Http Request");
    });

    it("should handle multiple separators", () => {
        expect.assertions(2);
        expect(capitalCase("foo_bar-baz/qux")).toBe("Foo Bar Baz Qux");
        expect(capitalCase("foo_BAR-baz/QUX")).toBe("Foo Bar Baz Qux");
    });

    it("should handle snake case", () => {
        expect.assertions(2);
        expect(capitalCase("FOO_BAR")).toBe("Foo Bar");
        expect(capitalCase("FOO_BAR_BAZ")).toBe("Foo Bar Baz");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect.assertions(2);
        expect(capitalCase("foo--bar-Baz")).toBe("Foo Bar Baz");
        expect(capitalCase("foo--BAR-baz")).toBe("Foo Bar Baz");
    });

    it("should convert snake_case to Capital Case", () => {
        expect.assertions(3);
        expect(capitalCase("foo_bar")).toBe("Foo Bar");
        expect(capitalCase("foo_bar_baz")).toBe("Foo Bar Baz");
        expect(capitalCase("foo_BAR_baz")).toBe("Foo Bar Baz");
    });

    it("should convert kebab-case to Capital Case", () => {
        expect.assertions(3);
        expect(capitalCase("foo-bar")).toBe("Foo Bar");
        expect(capitalCase("foo-bar-baz")).toBe("Foo Bar Baz");
        expect(capitalCase("foo-BAR-baz")).toBe("Foo Bar Baz");
    });

    it("should convert space separated to Capital Case", () => {
        expect.assertions(3);
        expect(capitalCase("foo bar")).toBe("Foo Bar");
        expect(capitalCase("foo bar baz")).toBe("Foo Bar Baz");
        expect(capitalCase("foo BAR baz")).toBe("Foo Bar Baz");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with stripEmoji=true", () => {
            expect.assertions(9);
            expect(capitalCase("Foo🐣Bar", { stripEmoji: true })).toBe("Foo Bar");
            expect(capitalCase("hello🌍World", { stripEmoji: true })).toBe("Hello World");
            expect(capitalCase("test🎉Party🎈Fun", { stripEmoji: true })).toBe("Test Party Fun");
            expect(capitalCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("Emoji Gaming");
            expect(capitalCase("upper🚀Case", { stripEmoji: true })).toBe("Upper Case");
            expect(capitalCase("snake_case_🐍_test", { stripEmoji: true })).toBe("Snake Case Test");
            expect(capitalCase("kebab-case-🍔-test", { stripEmoji: true })).toBe("Kebab Case Test");
            expect(capitalCase("capital👑text", { stripEmoji: true })).toBe("Capitaltext");
            expect(capitalCase("welcome to the 🎉party", { stripEmoji: true })).toBe("Welcome To The Party");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect.assertions(9);
            expect(capitalCase("Foo🐣Bar", { handleEmoji: true })).toBe("Foo 🐣 Bar");
            expect(capitalCase("hello🌍World", { handleEmoji: true })).toBe("Hello 🌍 World");
            expect(capitalCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("Test 🎉 Party 🎈 Fun");
            expect(capitalCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("Emoji 👾 Gaming");
            expect(capitalCase("upper🚀Case", { handleEmoji: true })).toBe("Upper 🚀 Case");
            expect(capitalCase("snake_case_🐍_test", { handleEmoji: true })).toBe("Snake Case 🐍 Test");
            expect(capitalCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("Kebab Case 🍔 Test");
            expect(capitalCase("capital👑text", { handleEmoji: true })).toBe("Capital 👑 Text");
            expect(capitalCase("welcome to the 🎉party", { handleEmoji: true })).toBe("Welcome To The 🎉 Party");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect.assertions(3);
            expect(capitalCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("Red Text");
            expect(capitalCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("Bold Text");
            expect(capitalCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("Green Foo Blue Bar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect.assertions(3);
            expect(capitalCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mRed Text\u001B[0m");
            expect(capitalCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mBold Text\u001B[0m");
            expect(capitalCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mGreen Foo\u001B[0m \u001B[34mBlue Bar\u001B[0m",
            );
        });
    });

    it("should handle camelCase input", () => {
        expect.assertions(3);
        expect(capitalCase("fooBar")).toBe("Foo Bar");
        expect(capitalCase("fooBarBaz")).toBe("Foo Bar Baz");
        expect(capitalCase("fooBarBAZ")).toBe("Foo Bar Baz");
    });

    it("should handle special acronyms", () => {
        expect.assertions(5);
        expect(capitalCase("XML_HTTP_request")).toBe("Xml Http Request");
        expect(capitalCase("XMLHTTPRequest")).toBe("Xmlhttp Request");
        expect(capitalCase("AJAXRequest")).toBe("Ajax Request");
        expect(capitalCase("IFrameElement")).toBe("I Frame Element");
        expect(capitalCase("iOS_app")).toBe("I Os App");
    });

    it("should handle special formats and mixed cases", () => {
        expect.assertions(6);
        expect(capitalCase("C-3PO_and_R2-D2")).toBe("C 3po And R2 D2");
        expect(capitalCase("The Taking of Pelham 123")).toBe("The Taking Of Pelham 123");
        expect(capitalCase("Ocean's 11")).toBe("Ocean's 11");
        expect(capitalCase("21-JUMP-STREET")).toBe("21 Jump Street");
        expect(capitalCase("non-SI units")).toBe("Non Si Units");
        expect(capitalCase("Red1Green2Blue3")).toBe("Red 1 Green 2 Blue 3");
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            expect.assertions(2);

            const locale = "tr-TR";

            expect(capitalCase("istanbul_city", { locale })).toBe("İstanbul City");
            expect(capitalCase("İZMİR_CITY", { locale })).toBe("İzmir Cıty");
        });

        it("should handle German specific cases", () => {
            expect.assertions(3);

            const locale = "de-DE";

            expect(capitalCase("GROSSE STRAßE", { locale })).toBe("Große Straße");
            expect(capitalCase("GROSSE STRASSE", { locale })).toBe("Große Straße");
            expect(capitalCase("GROßE STRAßE", { locale })).toBe("Große Straße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect.assertions(1);
            expect(capitalCase("test_string", { locale: "invalid-locale" })).toBe("Test String");
        });
    });

    describe("invalid input", () => {
        it("should return an empty string for non-string input", () => {
            expect.assertions(2);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(capitalCase(123 as any)).toBe("");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(capitalCase(undefined as any)).toBe("");
        });
    });
});
