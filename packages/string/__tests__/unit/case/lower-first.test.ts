import { describe, expect, it, test } from "vitest";

import { lowerFirst } from "../../../src/case";

describe("lowerFirst", () => {
    it("should handle empty string", () => {
        expect(lowerFirst("")).toBe("");
    });

    it("should preserve already lowercase first letter", () => {
        expect(lowerFirst("foo")).toBe("foo");
    });

    it("should convert first uppercase letter to lowercase", () => {
        expect(lowerFirst("Foo")).toBe("foo");
    });

    it("should convert first character to lowercase", () => {
        expect(lowerFirst("Foo")).toBe("foo");
        expect(lowerFirst("BAR")).toBe("bAR");
    });

    it("should handle already lowercase first character", () => {
        expect(lowerFirst("foo")).toBe("foo");
        expect(lowerFirst("bar")).toBe("bar");
    });

    it("should handle empty string", () => {
        expect(lowerFirst("")).toBe("");
    });

    it("should handle single character", () => {
        expect(lowerFirst("F")).toBe("f");
        expect(lowerFirst("a")).toBe("a");
    });

    it("should handle string with numbers and special characters", () => {
        expect(lowerFirst("123Foo")).toBe("123Foo");
        expect(lowerFirst("!Foo")).toBe("!Foo");
        expect(lowerFirst(" Foo")).toBe(" Foo");
    });

    it("should preserve rest of string case", () => {
        expect(lowerFirst("FooBar")).toBe("fooBar");
        expect(lowerFirst("FOO_BAR")).toBe("fOO_BAR");
        expect(lowerFirst("Foo-bar")).toBe("foo-bar");
    });
});
