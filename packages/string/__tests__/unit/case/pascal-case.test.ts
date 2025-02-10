import { describe, expect, it, test } from "vitest";

import { pascalCase } from "../../../src/case";

describe("pascalCase", () => {
    it("should handle empty string", () => {
        expect(pascalCase("")).toBe("");
    });

    it("should convert single word to pascal case", () => {
        expect(pascalCase("foo")).toBe("Foo");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect(pascalCase("foo-bAr")).toBe("FooBAr");
        expect(pascalCase("XMLHttpRequest")).toBe("XmlHttpRequest");
    });

    it("should preserve mixed case", () => {
        expect(pascalCase("FooBARb")).toBe("FooBaRb");
    });

    it("should handle multiple separators", () => {
        expect(pascalCase("foo_bar-baz/qux")).toBe("FooBarBazQux");
    });

    it("should handle snake case", () => {
        expect(pascalCase("FOO_BAR")).toBe("FooBar");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect(pascalCase("foo--bar-Baz")).toBe("FooBarBaz");
    });

    it("should convert snake_case to PascalCase", () => {
        expect(pascalCase("foo_bar")).toBe("FooBar");
        expect(pascalCase("foo_bar_baz")).toBe("FooBarBaz");
    });

    it("should convert kebab-case to PascalCase", () => {
        expect(pascalCase("foo-bar")).toBe("FooBar");
        expect(pascalCase("foo-bar-baz")).toBe("FooBarBaz");
    });

    it("should convert space separated to PascalCase", () => {
        expect(pascalCase("foo bar")).toBe("FooBar");
        expect(pascalCase("foo bar baz")).toBe("FooBarBaz");
    });

    it("should handle camelCase input", () => {
        expect(pascalCase("fooBar")).toBe("FooBar");
    });

    it("should handle special formats and mixed cases", () => {
        expect(pascalCase("C-3PO_and_R2-D2")).toBe("C3PoAndR2D2");
        expect(pascalCase("The Taking of Pelham 123")).toBe("TheTakingOfPelham123");
        expect(pascalCase("Ocean's 11")).toBe("Ocean's11");
        expect(pascalCase("Hello5My5Name5Is5Bond")).toBe("Hello5My5Name5Is5Bond");
        expect(pascalCase("i-do--not--0like--number0")).toBe("IDoNot0LikeNumber0");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(pascalCase("Foo🐣Bar")).toBe("Foo🐣Bar");
            expect(pascalCase("hello🌍World")).toBe("Hello🌍World");
            expect(pascalCase("test🎉Party🎈Fun")).toBe("Test🎉Party🎈Fun");
            expect(pascalCase("EMOJI👾Gaming")).toBe("Emoji👾Gaming");
            expect(pascalCase("upper🚀Case")).toBe("Upper🚀Case");
            expect(pascalCase("snake_case_🐍_test")).toBe("SnakeCase🐍Test");
            expect(pascalCase("kebab-case-🍔-test")).toBe("KebabCase🍔Test");
        });
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(pascalCase("istanbul_city", { locale })).toBe("İstanbulCity");
            expect(pascalCase("izmir_city", { locale })).toBe("İzmirCity");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(pascalCase("GROSSE STRAßE", { locale })).toBe("GroßeStraße");
            expect(pascalCase("GROSSE STRASSE", { locale })).toBe("GroßeStraße");
            expect(pascalCase("GROßE STRAßE", { locale })).toBe("GroßeStraße");
        });
    });
});
