import { describe, expect, it } from "vitest";

import { titleCase } from "../../../src/case";

describe("titleCase", () => {
    it("should handle empty string", () => {
        expect(titleCase("")).toBe("");
    });

    it("should capitalize single letter", () => {
        expect(titleCase("f")).toBe("F");
    });

    it("should capitalize single word", () => {
        expect(titleCase("foo")).toBe("Foo");
    });

    it("should convert kebab-case to title case", () => {
        expect(titleCase("foo-bar")).toBe("Foo Bar");
    });

    it("should handle mixed case with hyphens", () => {
        expect(titleCase("this-IS-aTitle")).toBe("This Is A Title");
        expect(titleCase("XMLHttpRequest")).toBe("Xml Http Request");
    });

    it("should handle mixed separators", () => {
        expect(titleCase("is_this ATitle")).toBe("Is This A Title");
    });

    it("should handle punctuation", () => {
        expect(titleCase("hello, world!")).toBe("Hello, World!");
    });

    it("should convert camelCase to Title Case", () => {
        expect(titleCase("fooBar")).toBe("Foo Bar");
        expect(titleCase("fooBarBaz")).toBe("Foo Bar Baz");
    });

    it("should convert PascalCase to Title Case", () => {
        expect(titleCase("FooBar")).toBe("Foo Bar");
        expect(titleCase("FooBarBaz")).toBe("Foo Bar Baz");
    });

    it("should convert snake_case to Title Case", () => {
        expect(titleCase("foo_bar")).toBe("Foo Bar");
        expect(titleCase("foo_bar_baz")).toBe("Foo Bar Baz");
    });

    it("should convert kebab-case to Title Case", () => {
        expect(titleCase("foo-bar")).toBe("Foo Bar");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(titleCase("Foo🐣Bar")).toBe("Foo 🐣 Bar");
            expect(titleCase("hello🌍World")).toBe("Hello 🌍 World");
            expect(titleCase("test🎉Party🎈Fun")).toBe("Test 🎉 Party 🎈 Fun");
            expect(titleCase("EMOJI👾Gaming")).toBe("Emoji 👾 Gaming");
            expect(titleCase("upper🚀Case")).toBe("Upper 🚀 Case");
            expect(titleCase("snake_case_🐍_test")).toBe("Snake Case 🐍 Test");
            expect(titleCase("kebab-case-🍔-test")).toBe("Kebab Case 🍔 Test");
            expect(titleCase("welcome to the 🎉party")).toBe("Welcome To The 🎉 Party");
        });
    });

    it("should convert kebab-case to Title Case", () => {
        expect(titleCase("foo-bar")).toBe("Foo Bar");
        expect(titleCase("foo-bar-baz")).toBe("Foo Bar Baz");
    });

    it("should handle minor words correctly", () => {
        expect(titleCase("the quick brown fox")).toBe("The Quick Brown Fox");
        expect(titleCase("a tale of two cities")).toBe("A Tale Of Two Cities");
        expect(titleCase("to kill a mockingbird")).toBe("To Kill A Mockingbird");
    });

    it("should handle empty string", () => {
        expect(titleCase("")).toBe("");
    });

    it("should handle mixed case with numbers and special characters", () => {
        expect(titleCase("foo123Bar")).toBe("Foo 123 Bar");
        expect(titleCase("foo_bar-baz")).toBe("Foo Bar Baz");
        expect(titleCase("FOO BAR_BAZ-QUX")).toBe("Foo Bar Baz Qux");
        expect(titleCase("session9")).toBe("Session9");
        expect(titleCase("planet_51")).toBe("Planet 51");
        expect(titleCase("United9")).toBe("United9");
        expect(titleCase("The Taking of Pelham 123")).toBe("The Taking Of Pelham 123");
        expect(titleCase("Ocean's 11")).toBe("Ocean's 11");
    });

    describe("locale support", () => {
        const locale = "tr-TR";

        it("should handle Turkish specific cases", () => {
            expect(titleCase("istanbul", { locale })).toBe("İstanbul");
            expect(titleCase("İSTANBUL", { locale })).toBe("İstanbul");
            expect(titleCase("izmir ankara", { locale })).toBe("İzmir Ankara");
        });

        it("should handle locale array", () => {
            expect(titleCase("istanbul izmir", { locale: ["tr-TR", "en-US"] })).toBe("İstanbul İzmir");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(titleCase("GROSSE STRAßE", { locale })).toBe("Große Straße");
            expect(titleCase("GROSSE STRASSE", { locale })).toBe("Große Straße");
            expect(titleCase("GROßE STRAßE", { locale })).toBe("Große Straße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect(titleCase("test string", { locale: "invalid-locale" })).toBe("Test String");
        });
    });
});
