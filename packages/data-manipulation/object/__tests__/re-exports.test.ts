import { describe, expect, it } from "vitest";

import { deepKeys, deepKeysFromList, deleteProperty, escapePath, getProperty, hasProperty, setProperty } from "../src";

/**
 * `@visulima/object` is a façade: `dot-prop` and `deeks` are bundled in rather
 * than declared as runtime dependencies, so these pin the re-exported surface.
 * A bundler or dependency bump that drops one of them fails here instead of in
 * a consumer.
 */
describe("re-exported dot-prop helpers", () => {
    it("should get, set, check and delete nested properties", () => {
        expect.assertions(5);

        const target: Record<string, unknown> = { a: { b: [{ c: 1 }] } };

        const initial: unknown = getProperty(target, "a.b.0.c");

        expect(initial).toBe(1);
        expect(hasProperty(target, "a.b.0.c")).toBe(true);

        setProperty(target, "a.b.0.d", 2);

        const added: unknown = getProperty(target, "a.b.0.d");

        expect(added).toBe(2);

        deleteProperty(target, "a.b.0.c");

        const fallback: unknown = getProperty(target, "missing.path", "fallback");

        expect(hasProperty(target, "a.b.0.c")).toBe(false);
        expect(fallback).toBe("fallback");
    });

    it("should escape a literal dot in a key", () => {
        expect.assertions(2);

        const escaped = escapePath("a.b");

        const value: unknown = getProperty({ "a.b": 1 }, escaped);

        expect(escaped).toBe(String.raw`a\.b`);
        expect(value).toBe(1);
    });

    it("should refuse to pollute Object.prototype via setProperty", () => {
        expect.assertions(2);

        const target: Record<string, unknown> = {};

        setProperty(target, "__proto__.polluted", true);

        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
    });

    it("should refuse to pollute via a constructor.prototype path", () => {
        expect.assertions(1);

        const target: Record<string, unknown> = {};

        setProperty(target, "constructor.prototype.polluted", true);

        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
});

describe("re-exported deeks helpers", () => {
    it("should list the deep keys of an object", () => {
        expect.assertions(1);

        expect(deepKeys({ a: { b: 1, c: { d: 2 } }, e: 3 })).toStrictEqual(["a.b", "a.c.d", "e"]);
    });

    it("should list the deep keys of a list of objects", () => {
        expect.assertions(1);

        expect(deepKeysFromList([{ a: 1 }, { b: { c: 2 } }])).toStrictEqual([["a"], ["b.c"]]);
    });
});
