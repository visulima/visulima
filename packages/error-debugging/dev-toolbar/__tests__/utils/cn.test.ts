import { describe, expect, it } from "vitest";

import cn from "../../src/utils/cn";

describe("cn", () => {
    it("merges multiple class names", () => {
        expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("handles conditional classes (false is excluded)", () => {
        expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    });

    it("handles conditional classes (truthy condition is included)", () => {
        expect(cn("foo", true && "bar")).toBe("foo bar");
    });

    it("resolves tailwind conflicts by keeping the last one", () => {
        expect(cn("p-4", "p-2")).toBe("p-2");
    });

    it("resolves conflicting tailwind modifiers", () => {
        expect(cn("text-red-500", "text-blue-300")).toBe("text-blue-300");
    });

    it("handles undefined values", () => {
        expect(cn("foo", undefined, "bar")).toBe("foo bar");
    });

    it("handles null values", () => {
        // eslint-disable-next-line unicorn/no-null
        expect(cn("foo", null, "bar")).toBe("foo bar");
    });

    it("handles empty strings", () => {
        expect(cn("", "foo")).toBe("foo");
    });

    it("handles array inputs", () => {
        expect(cn(["foo", "bar"])).toBe("foo bar");
    });

    it("handles object inputs (truthy keys included)", () => {
        expect(cn({ bar: false, foo: true })).toBe("foo");
    });

    it("handles object inputs (all truthy, order follows insertion order)", () => {
        expect(cn({ bar: true, foo: true })).toBe("bar foo");
    });

    it("returns empty string when called with no arguments", () => {
        expect(cn()).toBe("");
    });

    it("handles mixed inputs (strings, arrays, objects)", () => {
        expect(cn("base", ["extra"], { optional: true })).toBe("base extra optional");
    });

    it("handles deeply nested arrays", () => {
        expect(cn(["foo", ["bar", "baz"]])).toBe("foo bar baz");
    });

    it("preserves non-conflicting tailwind classes", () => {
        expect(cn("px-4", "py-2")).toBe("px-4 py-2");
    });
});
