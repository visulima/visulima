import { describe, expect, it, test } from "vitest";

import { snakeCase } from "../../../src/case";

describe("snakeCase", () => {
    it("should convert pascal case to snake case", () => {
        expect(snakeCase("FooBarBaz")).toBe("foo_bar_baz");
        expect(snakeCase("XMLHttpRequest")).toBe("xml_http_request");
    });

    it("should normalize uppercase snake case", () => {
        expect(snakeCase("FOO_BAR")).toBe("foo_bar");
    });

    it("should convert camelCase to snake_case", () => {
        expect(snakeCase("fooBar")).toBe("foo_bar");
        expect(snakeCase("fooBarBaz")).toBe("foo_bar_baz");
    });

    it("should convert PascalCase to snake_case", () => {
        expect(snakeCase("FooBar")).toBe("foo_bar");
        expect(snakeCase("FooBarBaz")).toBe("foo_bar_baz");
    });

    it("should convert kebab-case to snake_case", () => {
        expect(snakeCase("foo-bar")).toBe("foo_bar");
        expect(snakeCase("foo-bar-baz")).toBe("foo_bar_baz");
    });

    it("should convert space separated to snake_case", () => {
        expect(snakeCase("foo bar")).toBe("foo_bar");
        expect(snakeCase("foo bar baz")).toBe("foo_bar_baz");
    });

    it("should handle empty string", () => {
        expect(snakeCase("")).toBe("");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(snakeCase("Foo🐣Bar")).toBe("foo_🐣_bar");
            expect(snakeCase("hello🌍World")).toBe("hello_🌍_world");
            expect(snakeCase("test🎉Party🎈Fun")).toBe("test_🎉_party_🎈_fun");
            expect(snakeCase("EMOJI👾Gaming")).toBe("emoji_👾_gaming");
            expect(snakeCase("upper🚀Case")).toBe("upper_🚀_case");
            expect(snakeCase("camelCase🐪Test")).toBe("camel_case_🐪_test");
            expect(snakeCase("kebab-case-🍔-test")).toBe("kebab_case_🍔_test");
        });
    });

    it("should handle special formats and mixed cases", () => {
        expect(snakeCase("C-3PO_and_R2-D2")).toBe("c_3po_and_r2_d2");
        expect(snakeCase("3_idiots_2009")).toBe("3_idiots_2009");
        expect(snakeCase("12_angry_men")).toBe("12_angry_men");
        expect(snakeCase("48-HOLA-mundo-6")).toBe("48_hola_mundo_6");
        expect(snakeCase("IDoNot0LikeNumber0")).toBe("i_do_not0_like_number0");
    });

    describe("locale support", () => {
        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(snakeCase("großeStrasse", { locale })).toBe("große_strasse");
            expect(snakeCase("GROSSE", { locale })).toBe("große");
            expect(snakeCase("GROßE STRAßE", { locale })).toBe("große_straße");
        });
    });
});
