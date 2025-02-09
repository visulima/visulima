import { describe, expect, it } from "vitest";

import { upperFirst } from "../../../src/case";

describe("upperFirst", () => {
    it("should handle empty string", () => {
        expect(upperFirst("")).toBe("");
    });

    it("should capitalize first letter of lowercase word", () => {
        expect(upperFirst("foo")).toBe("Foo");
    });

    it("should preserve already capitalized word", () => {
        expect(upperFirst("Foo")).toBe("Foo");
    });

    it("should convert first character to uppercase", () => {
        expect(upperFirst("foo")).toBe("Foo");
        expect(upperFirst("bar")).toBe("Bar");
    });

    it("should handle already uppercase first character", () => {
        expect(upperFirst("Foo")).toBe("Foo");
        expect(upperFirst("BAR")).toBe("BAR");
    });

    it("should handle empty string", () => {
        expect(upperFirst("")).toBe("");
    });

    it("should handle single character", () => {
        expect(upperFirst("f")).toBe("F");
        expect(upperFirst("A")).toBe("A");
    });

    it("should handle string with numbers and special characters", () => {
        expect(upperFirst("123foo")).toBe("123foo");
        expect(upperFirst("!foo")).toBe("!foo");
        expect(upperFirst(" foo")).toBe(" foo");
    });

    it("should preserve rest of string case", () => {
        expect(upperFirst("fooBar")).toBe("FooBar");
        expect(upperFirst("FOO_BAR")).toBe("FOO_BAR");
        expect(upperFirst("foo-bar")).toBe("Foo-bar");
    });

    it("should handle special formats and mixed cases", () => {
        expect(upperFirst("c-3PO")).toBe("C-3PO");
        expect(upperFirst("r2-D2")).toBe("R2-D2");
        expect(upperFirst("ocean's")).toBe("Ocean's");
        expect(upperFirst("21jumpStreet")).toBe("21jumpStreet");
        expect(upperFirst("nonSIUnits")).toBe("NonSIUnits");
        expect(upperFirst("red1Green2")).toBe("Red1Green2");
    });
});
