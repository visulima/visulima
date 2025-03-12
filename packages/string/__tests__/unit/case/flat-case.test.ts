import { describe, expect, it } from "vitest";

import { flatCase } from "../../../src/case";
import generateCacheKey from "../../../src/case/utils/generate-cache-key";

describe("flatCase", () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            expect.assertions(5);
            const customCache = new Map<string, string>();
            const input = "testString";
            const options = { cache: true, cacheStore: customCache };

            // First call should cache
            const result1 = flatCase(input, options);
            expect(result1).toBe("teststring");
            expect(customCache.size).toBe(1);
            expect(customCache.get(generateCacheKey(input, options))).toBe(result1);

            // Second call should use cache
            const result2 = flatCase(input, options);
            expect(result2).toBe("teststring");
            expect(customCache.size).toBe(1);
        });

        it("should not use cache when disabled", () => {
            expect.assertions(4);
            const customCache = new Map<string, string>();
            const input = "testString";
            const options = { cache: false, cacheStore: customCache };

            // First call without cache
            const result1 = flatCase(input, options);
            expect(result1).toBe("teststring");
            expect(customCache.size).toBe(0);

            // Second call without cache
            const result2 = flatCase(input, options);
            expect(result2).toBe("teststring");
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
            flatCase(input1, options1);
            expect(customCache.size).toBe(1);
            expect(customCache.get(generateCacheKey(input1, options1))).toBeDefined();

            // Second string should be cached due to size limit, the first string should be evicted
            flatCase(input2, options2);
            expect(customCache.size).toBe(1);
            expect(customCache.has(generateCacheKey(input1, options1))).toBeFalsy();
            expect(customCache.has(generateCacheKey(input2, options2))).toBeTruthy();
        });

        it("should handle custom cache store", () => {
            expect.assertions(2);
            const defaultCache = new Map<string, string>();
            const customCache = new Map<string, string>();
            const input = "testString";
            const options = { cache: true, cacheStore: customCache };

            // Use custom cache
            flatCase(input, options);
            expect(customCache.size).toBe(1);
            expect(defaultCache.size).toBe(0);
        });
    });

    it("should convert camelCase to flat case", () => {
        expect.assertions(3);
        expect(flatCase("fooBar")).toBe("foobar");
        expect(flatCase("fooBarBaz")).toBe("foobarbaz");
        expect(flatCase("fooBarBAZ")).toBe("foobarbaz");
    });

    it("should handle special acronyms", () => {
        expect.assertions(5);
        expect(flatCase("XML_HTTP_request")).toBe("xmlhttprequest");
        expect(flatCase("XMLHTTPRequest")).toBe("xmlhttprequest");
        expect(flatCase("AJAXRequest")).toBe("ajaxrequest");
        expect(flatCase("IFrameElement")).toBe("iframeelement");
        expect(flatCase("iOS_app")).toBe("iosapp");
    });

    it("should convert PascalCase to flat case", () => {
        expect.assertions(3);
        expect(flatCase("FooBar")).toBe("foobar");
        expect(flatCase("FooBarBaz")).toBe("foobarbaz");
        expect(flatCase("FOOBarBAZ")).toBe("foobarbaz");
    });

    it("should convert snake_case to flat case", () => {
        expect.assertions(4);
        expect(flatCase("foo_bar")).toBe("foobar");
        expect(flatCase("foo_bar_baz")).toBe("foobarbaz");
        expect(flatCase("foo_BAR_baz")).toBe("foobarbaz");
        expect(flatCase("FOO_BAR_BAZ")).toBe("foobarbaz");
    });

    it("should convert kebab-case to flat case", () => {
        expect.assertions(4);
        expect(flatCase("foo-bar")).toBe("foobar");
        expect(flatCase("foo-bar-baz")).toBe("foobarbaz");
        expect(flatCase("foo-BAR-baz")).toBe("foobarbaz");
        expect(flatCase("FOO-BAR-BAZ")).toBe("foobarbaz");
    });

    it("should convert space separated to flat case", () => {
        expect.assertions(4);
        expect(flatCase("foo bar")).toBe("foobar");
        expect(flatCase("foo bar baz")).toBe("foobarbaz");
        expect(flatCase("foo BAR baz")).toBe("foobarbaz");
        expect(flatCase("FOO BAR BAZ")).toBe("foobarbaz");
    });

    it("should handle empty string", () => {
        expect.assertions(1);
        expect(flatCase("")).toBe("");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with stripEmoji=true", () => {
            expect.assertions(9);
            expect(flatCase("Foo🐣Bar", { stripEmoji: true })).toBe("foobar");
            expect(flatCase("hello🌍World", { stripEmoji: true })).toBe("helloworld");
            expect(flatCase("test🎉Party🎈Fun", { stripEmoji: true })).toBe("testpartyfun");
            expect(flatCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("emojigaming");
            expect(flatCase("upper🚀Case", { stripEmoji: true })).toBe("uppercase");
            expect(flatCase("snake_case_🐍_test", { stripEmoji: true })).toBe("snakecasetest");
            expect(flatCase("kebab-case-🍔-test", { stripEmoji: true })).toBe("kebabcasetest");
            expect(flatCase("flat📝text", { stripEmoji: true })).toBe("flattext");
            expect(flatCase("welcome to the 🎉party", { stripEmoji: true })).toBe("welcometotheparty");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect.assertions(9);
            expect(flatCase("Foo🐣Bar", { handleEmoji: true })).toBe("foo🐣bar");
            expect(flatCase("hello🌍World", { handleEmoji: true })).toBe("hello🌍world");
            expect(flatCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("test🎉party🎈fun");
            expect(flatCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("emoji👾gaming");
            expect(flatCase("upper🚀Case", { handleEmoji: true })).toBe("upper🚀case");
            expect(flatCase("snake_case_🐍_test", { handleEmoji: true })).toBe("snakecase🐍test");
            expect(flatCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("kebabcase🍔test");
            expect(flatCase("flat📝text", { handleEmoji: true })).toBe("flat📝text");
            expect(flatCase("welcome to the 🎉party", { handleEmoji: true })).toBe("welcometothe🎉party");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect.assertions(3);
            expect(flatCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("redtext");
            expect(flatCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("boldtext");
            expect(flatCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("greenfoobluebar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect.assertions(5);
            expect(flatCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mredtext\u001B[0m");
            expect(flatCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mboldtext\u001B[0m");
            expect(flatCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mgreenfoo\u001B[0m\u001B[34mbluebar\u001B[0m",
            );
            expect(flatCase("\u001B[31mRed\u001B[0m_\u001B[32mGreen\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mred\u001B[0m\u001B[32mgreen\u001B[0m");
            expect(flatCase("\u001B[1mBold\u001B[0m-\u001B[31mRed\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mbold\u001B[0m\u001B[31mred\u001B[0m");
        });
    });

    it("should handle mixed case with numbers and special characters", () => {
        expect.assertions(3);
        expect(flatCase("Foo123Bar")).toBe("foo123bar");
        expect(flatCase("foo_bar-baz")).toBe("foobarbaz");
        expect(flatCase("FOO BAR_BAZ-QUX")).toBe("foobarbazqux");
    });

    it("should handle special formats and mixed cases", () => {
        expect.assertions(6);
        expect(flatCase("C-3PO_and_R2-D2")).toBe("c3poandr2d2");
        expect(flatCase("The Taking of Pelham 123")).toBe("thetakingofpelham123");
        expect(flatCase("Ocean's 11")).toBe("ocean's11");
        expect(flatCase("21-JUMP-STREET")).toBe("21jumpstreet");
        expect(flatCase("non-SI units")).toBe("nonsiunits");
        expect(flatCase("Red1Green2Blue3")).toBe("red1green2blue3");
    });

    describe("locale support", () => {
        it("should handle German specific cases", () => {
            expect.assertions(2);
            const locale = "de-DE";
            expect(flatCase("großeStrasse", { locale })).toBe("großestrasse");
            expect(flatCase("GROßE", { locale })).toBe("große");
        });
    });
});
