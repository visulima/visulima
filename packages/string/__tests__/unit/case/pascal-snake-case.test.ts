import { describe, expect, it } from "vitest";

import { pascalSnakeCase } from "../../../src/case";
import generateCacheKey from "../../../src/case/utils/generate-cache-key";

describe("pascalSnakeCase", () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            const customCache = new Map<string, string>();
            const input = "test-string";

            // First call should cache
            const result1 = pascalSnakeCase(input, { cache: true, cacheStore: customCache });
            expect(result1).toBe("Test_String");
            expect(customCache.size).toBe(1);

            // Second call should use cache
            const result2 = pascalSnakeCase(input, { cache: true, cacheStore: customCache });
            expect(result2).toBe("Test_String");
            expect(customCache.size).toBe(1);
        });

        it("should not use cache when disabled", () => {
            const customCache = new Map<string, string>();
            const input = "test-string";

            // First call without cache
            const result1 = pascalSnakeCase(input, { cache: false, cacheStore: customCache });
            expect(result1).toBe("Test_String");
            expect(customCache.size).toBe(0);

            // Second call without cache
            const result2 = pascalSnakeCase(input, { cache: false, cacheStore: customCache });
            expect(result2).toBe("Test_String");
            expect(customCache.size).toBe(0);
        });

        it("should respect cache size limit", () => {
            const customCache = new Map<string, string>();
            const input1 = "test-string-1";
            const input2 = "test-string-2";

            const options = { cache: true, cacheMaxSize: 1, cacheStore: customCache };

            // First string should be cached
            const result1 = pascalSnakeCase(input1, options);
            expect(customCache.size).toBe(1);
            expect(customCache.get(generateCacheKey(input1, options))).toBe(result1);

            // Second string should be cached due to size limit, the first string should be evicted
            const result2 = pascalSnakeCase(input2, options);
            expect(customCache.size).toBe(1);
            expect(customCache.has(generateCacheKey(input1, options))).toBeFalsy();
            expect(customCache.get(generateCacheKey(input2, options))).toBe(result2);
        });

        it("should handle custom cache store", () => {
            const defaultCache = new Map<string, string>();
            const customCache = new Map<string, string>();
            const input = "test-string";

            // Use custom cache
            pascalSnakeCase(input, { cache: true, cacheStore: customCache });
            expect(customCache.size).toBe(1);
            expect(defaultCache.size).toBe(0);
        });
    });

    it("should handle empty string", () => {
        expect(pascalSnakeCase("")).toBe("");
    });

    it("should convert single word to Pascal_Snake case", () => {
        expect(pascalSnakeCase("foo")).toBe("Foo");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect(pascalSnakeCase("foo-bAr")).toBe("Foo_B_Ar");
        expect(pascalSnakeCase("XMLHttpRequest")).toBe("Xml_Http_Request");
    });

    it("should handle multiple separators", () => {
        expect(pascalSnakeCase("foo_bar-baz/qux")).toBe("Foo_Bar_Baz_Qux");
        expect(pascalSnakeCase("foo_BAR-baz/QUX")).toBe("Foo_Bar_Baz_Qux");
    });

    it("should handle snake case", () => {
        expect(pascalSnakeCase("FOO_BAR")).toBe("Foo_Bar");
        expect(pascalSnakeCase("FOO_BAR_BAZ")).toBe("Foo_Bar_Baz");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect(pascalSnakeCase("foo--bar-Baz")).toBe("Foo_Bar_Baz");
        expect(pascalSnakeCase("foo--BAR-baz")).toBe("Foo_Bar_Baz");
    });

    it("should convert snake_case to Pascal_Snake case", () => {
        expect(pascalSnakeCase("foo_bar")).toBe("Foo_Bar");
        expect(pascalSnakeCase("foo_bar_baz")).toBe("Foo_Bar_Baz");
        expect(pascalSnakeCase("foo_BAR_baz")).toBe("Foo_Bar_Baz");
    });

    it("should convert kebab-case to Pascal_Snake case", () => {
        expect(pascalSnakeCase("foo-bar")).toBe("Foo_Bar");
        expect(pascalSnakeCase("foo-bar-baz")).toBe("Foo_Bar_Baz");
        expect(pascalSnakeCase("foo-BAR-baz")).toBe("Foo_Bar_Baz");
    });

    it("should convert space separated to Pascal_Snake case", () => {
        expect(pascalSnakeCase("foo bar")).toBe("Foo_Bar");
        expect(pascalSnakeCase("foo bar baz")).toBe("Foo_Bar_Baz");
        expect(pascalSnakeCase("foo BAR baz")).toBe("Foo_Bar_Baz");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(pascalSnakeCase("Foo🐣Bar", { handleEmoji: true })).toBe("Foo_🐣_Bar");
            expect(pascalSnakeCase("hello🌍World", { handleEmoji: true })).toBe("Hello_🌍_World");
            expect(pascalSnakeCase("test🎉Party🎈Fun", { handleEmoji: true })).toBe("Test_🎉_Party_🎈_Fun");
            expect(pascalSnakeCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("Emoji_👾_Gaming");
            expect(pascalSnakeCase("upper🚀Case", { handleEmoji: true })).toBe("Upper_🚀_Case");
            expect(pascalSnakeCase("snake_case_🐍_test", { handleEmoji: true })).toBe("Snake_Case_🐍_Test");
            expect(pascalSnakeCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("Kebab_Case_🍔_Test");
            expect(pascalSnakeCase("pascal🦆snake", { handleEmoji: true })).toBe("Pascal_🦆_Snake");
        });
    });

    it("should handle camelCase input", () => {
        expect(pascalSnakeCase("fooBar")).toBe("Foo_Bar");
        expect(pascalSnakeCase("fooBarBaz")).toBe("Foo_Bar_Baz");
        expect(pascalSnakeCase("fooBarBAZ")).toBe("Foo_Bar_Baz");
    });

    it("should handle special acronyms", () => {
        expect(pascalSnakeCase("XML_HTTP_request")).toBe("Xml_Http_Request");
        expect(pascalSnakeCase("XMLHTTPRequest")).toBe("Xmlhttp_Request");
        expect(pascalSnakeCase("AJAXRequest")).toBe("Ajax_Request");
        expect(pascalSnakeCase("IFrameElement")).toBe("I_Frame_Element");
        expect(pascalSnakeCase("iOS_app")).toBe("I_Os_App");
    });

    it("should handle special formats and mixed cases", () => {
        expect(pascalSnakeCase("C-3PO_and_R2-D2")).toBe("C_3po_And_R2_D2");
        expect(pascalSnakeCase("The Taking of Pelham 123")).toBe("The_Taking_Of_Pelham_123");
        expect(pascalSnakeCase("Ocean's 11")).toBe("Ocean's_11");
        expect(pascalSnakeCase("21-JUMP-STREET")).toBe("21_Jump_Street");
        expect(pascalSnakeCase("non-SI units")).toBe("Non_Si_Units");
        expect(pascalSnakeCase("Red1Green2Blue3")).toBe("Red_1_Green_2_Blue_3");
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(pascalSnakeCase("istanbul_city", { locale })).toBe("İstanbul_City");
            expect(pascalSnakeCase("İZMİR_CITY", { locale })).toBe("İzmir_Cıty");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(pascalSnakeCase("GROSSE STRAßE", { locale })).toBe("Große_Straße");
            expect(pascalSnakeCase("GROSSE STRASSE", { locale })).toBe("Große_Straße");
            expect(pascalSnakeCase("GROßE STRAßE", { locale })).toBe("Große_Straße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect(pascalSnakeCase("test_string", { locale: "invalid-locale" })).toBe("Test_String");
        });
    });
});
