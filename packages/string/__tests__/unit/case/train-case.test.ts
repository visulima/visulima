import { describe, expect, it } from "vitest";

import { trainCase } from "../../../src/case";

describe("trainCase", () => {
    it("should handle empty string", () => {
        expect(trainCase("")).toBe("");
    });

    it("should handle single letter", () => {
        expect(trainCase("f")).toBe("F");
    });

    it("should handle single word", () => {
        expect(trainCase("foo")).toBe("Foo");
    });

    it("should handle mixed case with hyphen", () => {
        expect(trainCase("foo-bAr")).toBe("Foo-B-Ar");
        expect(trainCase("XMLHttpRequest")).toBe("XML-Http-Request");
    });

    it("should preserve acronyms", () => {
        expect(trainCase("AcceptCH")).toBe("Accept-CH");
    });

    it("should handle multiple separators", () => {
        expect(trainCase("foo_bar-baz/qux")).toBe("Foo-Bar-Baz-Qux");
    });

    it("should preserve uppercase segments", () => {
        expect(trainCase("FOO_BAR")).toBe("FOO-BAR");
    });

    it("should handle multiple hyphens", () => {
        expect(trainCase("foo--bar-Baz")).toBe("Foo-Bar-Baz");
    });

    it("should handle existing train case", () => {
        expect(trainCase("WWW-authenticate")).toBe("WWW-Authenticate");
    });

    it("should convert camelCase to train case", () => {
        expect(trainCase("WWWAuthenticate")).toBe("WWW-Authenticate");
    });

    it("should convert camelCase to Train-Case", () => {
        expect(trainCase("fooBar")).toBe("Foo-Bar");
        expect(trainCase("fooBarBaz")).toBe("Foo-Bar-Baz");
    });

    it("should convert PascalCase to Train-Case", () => {
        expect(trainCase("FooBar")).toBe("Foo-Bar");
        expect(trainCase("FooBarBaz")).toBe("Foo-Bar-Baz");
    });

    it("should convert snake_case to Train-Case", () => {
        expect(trainCase("foo_bar")).toBe("Foo-Bar");
        expect(trainCase("foo_bar_baz")).toBe("Foo-Bar-Baz");
    });

    it("should convert kebab-case to Train-Case", () => {
        expect(trainCase("foo-bar")).toBe("Foo-Bar");
        expect(trainCase("foo-bar-baz")).toBe("Foo-Bar-Baz");
    });

    it("should convert space separated to Train-Case", () => {
        expect(trainCase("foo bar")).toBe("Foo-Bar");
        expect(trainCase("foo bar baz")).toBe("Foo-Bar-Baz");
    });

    it("should handle empty string", () => {
        expect(trainCase("")).toBe("");
    });

    it("should handle mixed case with numbers and special characters", () => {
        expect(trainCase("Foo123Bar")).toBe("Foo-123-Bar");
        expect(trainCase("foo_bar-baz")).toBe("Foo-Bar-Baz");
        expect(trainCase("FOO BAR_BAZ-QUX")).toBe("FOO-BAR-BAZ-QUX");
        expect(trainCase("C-3PO_and_R2-D2")).toBe("C-3-PO-And-R2-D2");
        expect(trainCase("21-JUMP-STREET")).toBe("21-Jump-Street");
        expect(trainCase("21-test-test21-21Test")).toBe("21-Test-Test21-21-Test");
        expect(trainCase("8Mm")).toBe("8-Mm");
        expect(trainCase("Friday-the-13th")).toBe("Friday-The-13th");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(trainCase("Foo🐣Bar")).toBe("Foo-🐣-Bar");
            expect(trainCase("Hello🌍World")).toBe("Hello-🌍-World");
            expect(trainCase("Test🎉Party🎈Fun")).toBe("Test-🎉-Party-🎈-Fun");
            expect(trainCase("emoji👾Gaming")).toBe("Emoji-👾-Gaming");
            expect(trainCase("UPPER🚀case")).toBe("UPPER-🚀-Case");
        });
    });

    describe("locale support", () => {
        it("should handle Turkish specific cases", () => {
            expect(trainCase("İSTANBUL ŞEHİR", { locale: "tr" })).toBe("İSTANBUL-ŞEHİR");

            const locale = "tr-TR";

            expect(trainCase("istanbulCity", { locale })).toBe("İstanbul-City");
            expect(trainCase("izmirAnkara", { locale })).toBe("İzmir-Ankara");
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";

            expect(trainCase("GROSSE STRAßE", { locale })).toBe("GROSSE-STRAßE");
            expect(trainCase("GROSSE STRASSE", { locale })).toBe("GROSSE-STRASSE");
            expect(trainCase("GROßE STRAßE", { locale })).toBe("GROßE-STRAßE");
        });

        it("should handle locale array", () => {
            expect(trainCase("istanbulIzmir", { locale: ["tr-TR", "en-US"] })).toBe("İstanbul-Izmir");
        });
    });
});
