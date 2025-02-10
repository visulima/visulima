import { describe, expect, it } from "vitest";

import { pathCase } from "../../../src/case";

describe("pathCase", () => {
    it("should handle empty string", () => {
        expect(pathCase("")).toBe("");
    });

    it("should convert single word to path case", () => {
        expect(pathCase("foo")).toBe("foo");
    });

    it("should handle hyphenated words with mixed case", () => {
        expect(pathCase("foo-bAr")).toBe("foo/b/ar");
        expect(pathCase("XMLHttpRequest")).toBe("xml/http/request");
    });

    it("should handle multiple separators", () => {
        expect(pathCase("foo_bar-baz/qux")).toBe("foo/bar/baz/qux");
    });

    it("should handle snake case", () => {
        expect(pathCase("FOO_BAR")).toBe("foo/bar");
    });

    it("should handle multiple hyphens and mixed case", () => {
        expect(pathCase("foo--bar-Baz")).toBe("foo/bar/baz");
    });

    it("should convert snake_case to path/case", () => {
        expect(pathCase("foo_bar")).toBe("foo/bar");
        expect(pathCase("foo_bar_baz")).toBe("foo/bar/baz");
    });

    it("should convert kebab-case to path/case", () => {
        expect(pathCase("foo-bar")).toBe("foo/bar");
        expect(pathCase("foo-bar-baz")).toBe("foo/bar/baz");
    });

    it("should convert space separated to path/case", () => {
        expect(pathCase("foo bar")).toBe("foo/bar");
        expect(pathCase("foo bar baz")).toBe("foo/bar/baz");
    });

    it("should handle camelCase input", () => {
        expect(pathCase("fooBar")).toBe("foo/bar");
    });

    it("should handle special formats and mixed cases", () => {
        expect(pathCase("C-3PO_and_R2-D2")).toBe("c/3/po/and/r/2/d/2");
        expect(pathCase("src/components/Button.tsx")).toBe("src/components/button/tsx");
        expect(pathCase("path/to/file/v1.2.3")).toBe("path/to/file/v/1/2/3");
        expect(pathCase("48-HOLA-mundo-6")).toBe("48/hola/mundo/6");
        expect(pathCase("non-SI units")).toBe("non/si/units");
        expect(pathCase("Red1Green2Blue3")).toBe("red/1/green/2/blue/3");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(pathCase("Foo🐣Bar")).toBe("foo/🐣/bar");
            expect(pathCase("hello🌍World")).toBe("hello/🌍/world");
            expect(pathCase("test🎉Party🎈Fun")).toBe("test/🎉/party/🎈/fun");
            expect(pathCase("EMOJI👾Gaming")).toBe("emoji/👾/gaming");
            expect(pathCase("upper🚀Case")).toBe("upper/🚀/case");
            expect(pathCase("snake_case_🐍_test")).toBe("snake/case/🐍/test");
            expect(pathCase("kebab-case-🍔-test")).toBe("kebab/case/🍔/test");
            expect(pathCase("path/to/📁/file")).toBe("path/to/📁/file");
        });
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(pathCase("istanbul_city", { locale })).toBe("istanbul/city");
            expect(pathCase("İZMİR_CITY", { locale })).toBe("izmir/cıty");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(pathCase("GROSSE STRAßE", { locale })).toBe("große/straße");
            expect(pathCase("GROSSE STRASSE", { locale })).toBe("große/straße");
            expect(pathCase("GROßE STRAßE", { locale })).toBe("große/straße");
        });

        it("should fallback gracefully for invalid locale", () => {
            expect(pathCase("test_string", { locale: "invalid-locale" })).toBe("test/string");
        });
    });
});
