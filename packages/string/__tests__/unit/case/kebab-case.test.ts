import { describe, expect, it, test } from "vitest";

import { kebabCase } from "../../../src/case";

describe("kebabCase", () => {
    it("should handle empty string", () => {
        expect(kebabCase("")).toBe("");
    });

    it("should preserve lowercase single word", () => {
        expect(kebabCase("foo")).toBe("foo");
    });

    it("should handle mixed case with hyphen", () => {
        expect(kebabCase("foo-bAr")).toBe("foo-b-ar");
        expect(kebabCase("XMLHttpRequest")).toBe("xml-http-request");
    });

    it("should preserve multiple hyphens", () => {
        expect(kebabCase("foo--bar")).toBe("foo--bar");
    });

    it("should convert mixed case to hyphen case", () => {
        expect(kebabCase("FooBAR")).toBe("foo-bar");
    });

    it("should handle single uppercase letter prefix", () => {
        expect(kebabCase("ALink")).toBe("a-link");
    });

    it("should convert snake case to kebab case", () => {
        expect(kebabCase("FOO_BAR")).toBe("foo-bar");
    });

    it("should convert camelCase to kebab-case", () => {
        expect(kebabCase("fooBar")).toBe("foo-bar");
        expect(kebabCase("fooBarBaz")).toBe("foo-bar-baz");
    });

    it("should convert PascalCase to kebab-case", () => {
        expect(kebabCase("FooBar")).toBe("foo-bar");
        expect(kebabCase("FooBarBaz")).toBe("foo-bar-baz");
    });

    it("should convert snake_case to kebab-case", () => {
        expect(kebabCase("foo_bar")).toBe("foo-bar");
        expect(kebabCase("foo_bar_baz")).toBe("foo-bar-baz");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(kebabCase("Foo🐣Bar")).toBe("foo-🐣-bar");
            expect(kebabCase("hello🌍World")).toBe("hello-🌍-world");
            expect(kebabCase("test🎉Party🎈Fun")).toBe("test-🎉-party-🎈-fun");
            expect(kebabCase("EMOJI👾Gaming")).toBe("emoji-👾-gaming");
            expect(kebabCase("upper🚀Case")).toBe("upper-🚀-case");
            expect(kebabCase("snake_case_🐍_test")).toBe("snake-case-🐍-test");
            expect(kebabCase("camelCase🍔Test")).toBe("camel-case-🍔-test");
        });
    });

    it("should convert space separated to kebab-case", () => {
        expect(kebabCase("foo bar")).toBe("foo-bar");
        expect(kebabCase("foo bar baz")).toBe("foo-bar-baz");
    });

    it("should handle empty string", () => {
        expect(kebabCase("")).toBe("");
    });

    it("should handle special formats and mixed cases", () => {
        expect(kebabCase("7samurai")).toBe("7-samurai");
        expect(kebabCase("14BLADES")).toBe("14-blades");
        expect(kebabCase("Happy2-see-you")).toBe("happy-2-see-you");
        expect(kebabCase("B-C-D")).toBe("b-c-d");
        expect(kebabCase("48-HOLA-mundo-6")).toBe("48-hola-mundo-6");
        expect(kebabCase("non-SI units")).toBe("non-si-units");
    });

    describe("locale support", () => {
        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(kebabCase("großeStrasse", { locale })).toBe("große-strasse");
            expect(kebabCase("GROSSE", { locale })).toBe("große");
            expect(kebabCase("GROßE STRAßE", { locale })).toBe("große-straße");
        });
    });
});
