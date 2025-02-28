import { describe, expect, it } from "vitest";

import { flipCase } from "../../../src/case";
import { generateCacheKey } from "../../../src/case/utils/generate-cache-key";

describe("flipCase", () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            const customCache = new Map<string, string>();
            const input = "testString";

            // First call should cache
            const result1 = flipCase(input, { cache: true, cacheStore: customCache });
            expect(result1).toBe("TESTsTRING");
            expect(customCache.size).toBe(1);

            // Second call should use cache
            const result2 = flipCase(input, { cache: true, cacheStore: customCache });
            expect(result2).toBe("TESTsTRING");
            expect(customCache.size).toBe(1);
        });

        it("should not use cache when disabled", () => {
            const customCache = new Map<string, string>();
            const input = "testString";

            // First call without cache
            const result1 = flipCase(input, { cache: false, cacheStore: customCache });
            expect(result1).toBe("TESTsTRING");
            expect(customCache.size).toBe(0);

            // Second call without cache
            const result2 = flipCase(input, { cache: false, cacheStore: customCache });
            expect(result2).toBe("TESTsTRING");
            expect(customCache.size).toBe(0);
        });

        it("should respect cache size limit", () => {
            const customCache = new Map<string, string>();
            const input1 = "testString1";
            const input2 = "testString2";

            const options = { cache: true, cacheMaxSize: 1, cacheStore: customCache };

            // First string should be cached
            const result1 = flipCase(input1, options);
            expect(customCache.size).toBe(1);
            expect(customCache.get(generateCacheKey(input1, options))).toBe(result1);

            // Second string should be cached due to size limit, the first string should be evicted
            const result2 = flipCase(input2, options);
            expect(customCache.size).toBe(1);
            expect(customCache.has(generateCacheKey(input1, options))).toBeFalsy();
            expect(customCache.get(generateCacheKey(input2, options))).toBe(result2);
        });

        it("should handle custom cache store", () => {
            const defaultCache = new Map<string, string>();
            const customCache = new Map<string, string>();
            const input = "testString";

            // Use custom cache
            flipCase(input, { cache: true, cacheStore: customCache });
            expect(customCache.size).toBe(1);
            expect(defaultCache.size).toBe(0);
        });
    });

    it("should flip case of mixed case string", () => {
        expect(flipCase("FooBar")).toBe("fOObAR");
        expect(flipCase("fooBar")).toBe("FOObAR");
    });

    it("should flip case of uppercase string", () => {
        expect(flipCase("FOO")).toBe("foo");
        expect(flipCase("FOOBAR")).toBe("foobar");
    });

    it("should flip case of lowercase string", () => {
        expect(flipCase("foo")).toBe("FOO");
        expect(flipCase("foobar")).toBe("FOOBAR");
    });

    it("should handle non-letter characters", () => {
        expect(flipCase("Foo123Bar")).toBe("fOO123bAR");
        expect(flipCase("foo-bar")).toBe("FOO-BAR");
    });

    it("should handle empty string", () => {
        expect(flipCase("")).toBe("");
    });

    it("should handle special formats and mixed cases", () => {
        expect(flipCase("C-3PO_and_R2-D2")).toBe("c-3po_AND_r2-d2");
        expect(flipCase("The Taking of Pelham 123")).toBe("tHE tAKING OF pELHAM 123");
        expect(flipCase("Ocean's 11")).toBe("oCEAN'S 11");
        expect(flipCase("21-JUMP-STREET")).toBe("21-jump-street");
        expect(flipCase("non-SI units")).toBe("NON-si UNITS");
        expect(flipCase("Red1Green2Blue3")).toBe("rED1gREEN2bLUE3");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with stripEmoji=true", () => {
            expect(flipCase("Foo🐣Bar", { stripEmoji: true })).toBe("fOObAR");
            expect(flipCase("hello🌍World", { stripEmoji: true })).toBe("HELLOwORLD");
            expect(flipCase("test🎉Party🎈Fun", { stripEmoji: true })).toBe("TESTpARTYfUN");
            expect(flipCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("emojigAMING");
            expect(flipCase("upper🚀Case", { stripEmoji: true })).toBe("UPPERcASE");
            expect(flipCase("snake_case_🐍_test", { stripEmoji: true })).toBe("SNAKE_CASE__TEST");
            expect(flipCase("kebab-case-🍔-test", { stripEmoji: true })).toBe("KEBAB-CASE--TEST");
            expect(flipCase("flip🤭Case", { stripEmoji: true })).toBe("FLIPcASE");
            expect(flipCase("welcome to the 🎉party", { stripEmoji: true })).toBe("WELCOME TO THE PARTY");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect(flipCase("Foo🐣Bar", { handleEmoji: true })).toBe("fOO🐣bAR");
            expect(flipCase("hello🌍World", { handleEmoji: true })).toBe("HELLO🌍wORLD");
            expect(flipCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("TEST🎉pARTY🎈fUN");
            expect(flipCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("emoji👾gAMING");
            expect(flipCase("upper🚀Case", { handleEmoji: true })).toBe("UPPER🚀cASE");
            expect(flipCase("snake_case_🐍_test", { handleEmoji: true })).toBe("SNAKE_CASE_🐍_TEST");
            expect(flipCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("KEBAB-CASE-🍔-TEST");
            expect(flipCase("flip🤭Case", { handleEmoji: true })).toBe("FLIP🤭cASE");
            expect(flipCase("welcome to the 🎉party", { handleEmoji: true })).toBe("WELCOME TO THE 🎉PARTY");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect(flipCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("rEDtEXT");
            expect(flipCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("bOLDtEXT");
            expect(flipCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("gREENfoo_bLUEbar");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect(flipCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mrEDtEXT\u001B[0m");
            expect(flipCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mbOLDtEXT\u001B[0m");
            expect(flipCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mgREENfoo\u001B[0m_\u001B[34mbLUEbar\u001B[0m",
            );
        });
    });
});
