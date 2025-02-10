import { describe, expect, it } from "vitest";

import { flatCase } from "../../../src/case";

describe("flatCase", () => {
    it("should convert camelCase to flat case", () => {
        expect(flatCase("fooBar")).toBe("foobar");
        expect(flatCase("fooBarBaz")).toBe("foobarbaz");
        expect(flatCase("fooBarBAZ")).toBe("foobarbaz");
    });

    it("should handle special acronyms", () => {
        expect(flatCase("XML_HTTP_request")).toBe("xmlhttprequest");
        expect(flatCase("XMLHTTPRequest")).toBe("xmlhttprequest");
        expect(flatCase("AJAXRequest")).toBe("ajaxrequest");
        expect(flatCase("IFrameElement")).toBe("iframeelement");
        expect(flatCase("iOS_app")).toBe("iosapp");
    });

    it("should convert PascalCase to flat case", () => {
        expect(flatCase("FooBar")).toBe("foobar");
        expect(flatCase("FooBarBaz")).toBe("foobarbaz");
        expect(flatCase("FOOBarBAZ")).toBe("foobarbaz");
    });

    it("should convert snake_case to flat case", () => {
        expect(flatCase("foo_bar")).toBe("foobar");
        expect(flatCase("foo_bar_baz")).toBe("foobarbaz");
        expect(flatCase("foo_BAR_baz")).toBe("foobarbaz");
        expect(flatCase("FOO_BAR_BAZ")).toBe("foobarbaz");
    });

    it("should convert kebab-case to flat case", () => {
        expect(flatCase("foo-bar")).toBe("foobar");
        expect(flatCase("foo-bar-baz")).toBe("foobarbaz");
        expect(flatCase("foo-BAR-baz")).toBe("foobarbaz");
        expect(flatCase("FOO-BAR-BAZ")).toBe("foobarbaz");
    });

    it("should convert space separated to flat case", () => {
        expect(flatCase("foo bar")).toBe("foobar");
        expect(flatCase("foo bar baz")).toBe("foobarbaz");
        expect(flatCase("foo BAR baz")).toBe("foobarbaz");
        expect(flatCase("FOO BAR BAZ")).toBe("foobarbaz");
    });

    it("should handle empty string", () => {
        expect(flatCase("")).toBe("");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(flatCase("Foo🐣Bar")).toBe("foo🐣bar");
            expect(flatCase("hello🌍World")).toBe("hello🌍world");
            expect(flatCase("test🎉Party🎈Fun")).toBe("test🎉party🎈fun");
            expect(flatCase("EMOJI👾Gaming")).toBe("emoji👾gaming");
            expect(flatCase("upper🚀Case")).toBe("upper🚀case");
            expect(flatCase("snake_case_🐍_test")).toBe("snakecase🐍test");
            expect(flatCase("kebab-case-🍔-test")).toBe("kebabcase🍔test");
            expect(flatCase("flat📝text")).toBe("flat📝text");
        });
    });

    it("should handle mixed case with numbers and special characters", () => {
        expect(flatCase("Foo123Bar")).toBe("foo123bar");
        expect(flatCase("foo_bar-baz")).toBe("foobarbaz");
        expect(flatCase("FOO BAR_BAZ-QUX")).toBe("foobarbazqux");
    });

    it("should handle special formats and mixed cases", () => {
        expect(flatCase("C-3PO_and_R2-D2")).toBe("c3poandr2d2");
        expect(flatCase("The Taking of Pelham 123")).toBe("thetakingofpelham123");
        expect(flatCase("Ocean's 11")).toBe("ocean's11");
        expect(flatCase("21-JUMP-STREET")).toBe("21jumpstreet");
        expect(flatCase("non-SI units")).toBe("nonsiunits");
        expect(flatCase("Red1Green2Blue3")).toBe("red1green2blue3");
    });

    describe("locale support", () => {
        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(flatCase("großeStrasse", { locale })).toBe("großestrasse");
            expect(flatCase("GROßE", { locale })).toBe("große");
        });
    });
});
