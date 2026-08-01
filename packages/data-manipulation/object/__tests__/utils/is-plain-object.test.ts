import { describe, expect, it } from "vitest";

import isPlainObject from "../../src/utils/is-plain-object";

describe("is-plain-object", () => {
    it("should accept object literals", () => {
        expect.assertions(2);

        expect(isPlainObject({})).toBe(true);
        expect(isPlainObject({ a: 1 })).toBe(true);
    });

    it("should classify a null-prototype object as plain", () => {
        expect.assertions(1);

        expect(isPlainObject(Object.create(null))).toBe(true);
    });

    it("should reject arrays, dates, maps, sets and class instances", () => {
        expect.assertions(5);

        class Custom {
            public value = 1;
        }

        expect(isPlainObject([])).toBe(false);
        expect(isPlainObject(new Date())).toBe(false);
        expect(isPlainObject(new Map())).toBe(false);
        expect(isPlainObject(new Set())).toBe(false);
        expect(isPlainObject(new Custom())).toBe(false);
    });

    it("should reject primitives and null", () => {
        expect.assertions(4);

        expect(isPlainObject(null)).toBe(false);
        expect(isPlainObject(undefined)).toBe(false);
        expect(isPlainObject("x")).toBe(false);
        expect(isPlainObject(1)).toBe(false);
    });

    it("should reject host objects that carry a toStringTag or an iterator", () => {
        expect.assertions(2);

        // Platform objects are what `pick`/`omit` must copy by reference rather
        // than walk into, and they are told apart by these two well-known symbols.
        expect(isPlainObject(new URLSearchParams())).toBe(false);
        expect(isPlainObject(new WeakMap())).toBe(false);
    });
});
