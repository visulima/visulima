import { describe, expect, it } from "vitest";

import { trainCase } from "../../../src/case";
import LRUCache from "../../../src/utils/lru-cache";

describe(trainCase, () => {
    describe("caching", () => {
        it("should use cache when enabled", () => {
            expect.assertions(4);

            const customCache = new LRUCache<string, string>(50);
            const input = "testString";

            // First call should cache
            const result1 = trainCase(input, { cache: true, cacheStore: customCache });

            expect(result1).toBe("Test-String");
            expect(customCache.size()).toBe(1);

            // Second call should use cache
            const result2 = trainCase(input, { cache: true, cacheStore: customCache });

            expect(result2).toBe("Test-String");
            expect(customCache.size()).toBe(1);
        });

        it("should not use cache when disabled", () => {
            expect.assertions(4);

            const customCache = new LRUCache<string, string>(50);
            const input = "testString";

            // First call without cache
            const result1 = trainCase(input, { cache: false, cacheStore: customCache });

            expect(result1).toBe("Test-String");
            expect(customCache.size()).toBe(0);

            // Second call without cache
            const result2 = trainCase(input, { cache: false, cacheStore: customCache });

            expect(result2).toBe("Test-String");
            expect(customCache.size()).toBe(0);
        });

        it("should handle custom cache store", () => {
            expect.assertions(1);

            const customCache = new LRUCache<string, string>(50);
            const input = "testString";

            // Use custom cache
            trainCase(input, { cache: true, cacheStore: customCache });

            expect(customCache.size()).toBe(1);
        });
    });

    it("should handle empty string", () => {
        expect.assertions(1);
        expect(trainCase("")).toBe("");
    });

    it("should handle single letter", () => {
        expect.assertions(1);
        expect(trainCase("f")).toBe("F");
    });

    it("should handle single word", () => {
        expect.assertions(1);
        expect(trainCase("foo")).toBe("Foo");
    });

    it("should handle mixed case with hyphen", () => {
        expect.assertions(2);
        expect(trainCase("foo-bAr")).toBe("Foo-B-Ar");
        expect(trainCase("XMLHttpRequest")).toBe("XML-Http-Request");
    });

    it("should preserve acronyms", () => {
        expect.assertions(1);
        expect(trainCase("AcceptCH")).toBe("Accept-CH");
    });

    it("should handle multiple separators", () => {
        expect.assertions(1);
        expect(trainCase("foo_bar-baz/qux")).toBe("Foo-Bar-Baz-Qux");
    });

    it("should preserve uppercase segments", () => {
        expect.assertions(1);
        expect(trainCase("FOO_BAR")).toBe("FOO-BAR");
    });

    it("should handle multiple hyphens", () => {
        expect.assertions(1);
        expect(trainCase("foo--bar-Baz")).toBe("Foo-Bar-Baz");
    });

    it("should handle existing train case", () => {
        expect.assertions(1);
        expect(trainCase("WWW-authenticate")).toBe("WWW-Authenticate");
    });

    it("should convert camelCase to train case", () => {
        expect.assertions(1);
        expect(trainCase("WWWAuthenticate")).toBe("WWW-Authenticate");
    });

    it("should convert camelCase to Train-Case", () => {
        expect.assertions(2);
        expect(trainCase("fooBar")).toBe("Foo-Bar");
        expect(trainCase("fooBarBaz")).toBe("Foo-Bar-Baz");
    });

    it("should convert PascalCase to Train-Case", () => {
        expect.assertions(2);
        expect(trainCase("FooBar")).toBe("Foo-Bar");
        expect(trainCase("FooBarBaz")).toBe("Foo-Bar-Baz");
    });

    it("should convert snake_case to Train-Case", () => {
        expect.assertions(2);
        expect(trainCase("foo_bar")).toBe("Foo-Bar");
        expect(trainCase("foo_bar_baz")).toBe("Foo-Bar-Baz");
    });

    it("should convert kebab-case to Train-Case", () => {
        expect.assertions(2);
        expect(trainCase("foo-bar")).toBe("Foo-Bar");
        expect(trainCase("foo-bar-baz")).toBe("Foo-Bar-Baz");
    });

    it("should convert space separated to Train-Case", () => {
        expect.assertions(2);
        expect(trainCase("foo bar")).toBe("Foo-Bar");
        expect(trainCase("foo bar baz")).toBe("Foo-Bar-Baz");
    });

    it("should handle mixed case with numbers and special characters", () => {
        expect.assertions(8);
        expect(trainCase("Foo123Bar")).toBe("Foo-123-Bar");
        expect(trainCase("foo_bar-baz")).toBe("Foo-Bar-Baz");
        expect(trainCase("FOO BAR_BAZ-QUX")).toBe("FOO-BAR-BAZ-QUX");
        expect(trainCase("C-3PO_and_R2-D2")).toBe("C-3PO-And-R2-D2");
        expect(trainCase("21-JUMP-STREET")).toBe("21-JUMP-STREET");
        expect(trainCase("21-test-test21-21Test")).toBe("21-Test-Test-21-21-Test");
        expect(trainCase("8Mm")).toBe("8-Mm");
        expect(trainCase("Friday-the-13th")).toBe("Friday-The-13-Th");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text with stripEmoji=true", () => {
            expect.assertions(8);
            expect(trainCase("Foo🐣Bar", { stripEmoji: true })).toBe("Foo-Bar");
            expect(trainCase("Hello🌍World", { stripEmoji: true })).toBe("Hello-World");
            expect(trainCase("Test🎉Party🎈Fun", { stripEmoji: true })).toBe("Test-Party-Fun");
            expect(trainCase("EMOJI👾Gaming", { stripEmoji: true })).toBe("EMOJI-Gaming");
            expect(trainCase("upper🚀Case", { stripEmoji: true })).toBe("Upper-Case");
            expect(trainCase("snake_case_🐍_test", { stripEmoji: true })).toBe("Snake-Case-Test");
            expect(trainCase("kebab-case-🍔-test", { stripEmoji: true })).toBe("Kebab-Case-Test");
            expect(trainCase("welcome to the 🎉party", { stripEmoji: true })).toBe("Welcome-To-The-Party");
        });

        it("should handle emojis in text with handleEmoji=true", () => {
            expect.assertions(8);
            expect(trainCase("Foo🐣Bar", { handleEmoji: true })).toBe("Foo-🐣-Bar");
            expect(trainCase("Hello🌍World", { handleEmoji: true })).toBe("Hello-🌍-World");
            expect(trainCase("Test🎉Party🎈Fun", { handleEmoji: true })).toBe("Test-🎉-Party-🎈-Fun");
            expect(trainCase("EMOJI👾Gaming", { handleEmoji: true })).toBe("EMOJI-👾-Gaming");
            expect(trainCase("upper🚀Case", { handleEmoji: true })).toBe("Upper-🚀-Case");
            expect(trainCase("snake_case_🐍_test", { handleEmoji: true })).toBe("Snake-Case-🐍-Test");
            expect(trainCase("kebab-case-🍔-test", { handleEmoji: true })).toBe("Kebab-Case-🍔-Test");
            expect(trainCase("welcome to the 🎉party", { handleEmoji: true })).toBe("Welcome-To-The-🎉-Party");
        });
    });

    describe("aNSI support", () => {
        it("should handle ANSI sequences with stripAnsi=true", () => {
            expect.assertions(3);
            expect(trainCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toBe("Red-Text");
            expect(trainCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toBe("Bold-Text");
            expect(trainCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toBe("Green-FOO-Blue-BAR");
        });

        it("should handle ANSI sequences with handleAnsi=true", () => {
            expect.assertions(3);
            expect(trainCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toBe("\u001B[31mRed-Text\u001B[0m");
            expect(trainCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toBe("\u001B[1mBold-Text\u001B[0m");
            expect(trainCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toBe(
                "\u001B[32mGreen-FOO\u001B[0m-\u001B[34mBlue-BAR\u001B[0m",
            );
        });
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            expect.assertions(3);
            expect(trainCase("İSTANBUL ŞEHİR", { locale: "tr" })).toBe("İSTANBUL-ŞEHİR");

            const locale = "tr-TR";

            expect(trainCase("istanbulCity", { locale })).toBe("İstanbul-City");
            expect(trainCase("izmirAnkara", { locale })).toBe("İzmir-Ankara");
        });

        it("should handle German specific cases", () => {
            expect.assertions(3);

            const locale = "de-DE";

            expect(trainCase("GROSSE STRAßE", { locale })).toBe("GROSSE-STRAßE");
            expect(trainCase("GROSSE STRASSE", { locale })).toBe("GROSSE-STRASSE");
            expect(trainCase("GROßE STRAßE", { locale })).toBe("GROßE-STRAßE");
        });
    });
});
