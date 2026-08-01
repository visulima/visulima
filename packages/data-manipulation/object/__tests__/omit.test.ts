import { describe, expect, it } from "vitest";

import { omit } from "../src";

describe(omit, () => {
    it("should omit specified flat properties from the object", () => {
        expect.assertions(1);

        const input = { filled: true, id: "1", name: "n1", omited: true };
        const result = omit(input, ["omited"]);

        expect(result).toStrictEqual({ filled: true, id: "1", name: "n1" });
    });

    it("should omit specified nested properties from the object", () => {
        expect.assertions(1);

        const input = { nested: { omit: { no: 0, yes: 0 } }, secondProp: true };
        const result = omit(input, ["nested.omit.yes"]);

        expect(result).toStrictEqual({ nested: { omit: { no: 0 } }, secondProp: true });
    });

    it("should return the original object if no keys are provided", () => {
        expect.assertions(1);

        const input = { filled: true, id: "1", name: "n1" };
        const result = omit(input, []);

        expect(result).toStrictEqual(input);
    });

    it("should handle wildcard patterns in nested properties correctly", () => {
        expect.assertions(1);

        const input = { omited: { 123: { no: false, yes: true }, 456: { no: false, yes: true } }, picks: { 456: { no: false, yes: true } } };
        const result = omit(input, ["omited.*.yes"]);

        expect(result).toStrictEqual({ omited: { 123: { no: false }, 456: { no: false } }, picks: { 456: { no: false, yes: true } } });
    });

    it("should work with objects containing arrays as properties", () => {
        expect.assertions(1);

        const input = { arrProp: [1, 2, 3], otherProp: true };
        const result = omit(input, ["arrProp"]);

        expect(result).toStrictEqual({ otherProp: true });
    });

    it("should handle empty array of keys gracefully", () => {
        expect.assertions(1);

        const input = { filled: true, id: "1", name: "n1" };
        const result = omit(input, []);

        expect(result).toStrictEqual(input);
    });

    it("should work with objects that have no matching keys to omit", () => {
        expect.assertions(1);

        const input = { filled: true, id: "1", name: "n1" };
        const result = omit(input, ["nonExistentKey"]);

        expect(result).toStrictEqual(input);
    });

    it("should handle non-existent nested properties without errors", () => {
        expect.assertions(1);

        const input = { filled: true, id: "1", name: "n1" };
        const result = omit(input, ["nested.nonExistentKey"]);

        expect(result).toStrictEqual(input);
    });

    it("should work with deeply nested objects", () => {
        expect.assertions(1);

        const input = { level1: { level2: { level3: { propToKeep: false, propToOmit: true } } } };
        const result = omit(input, ["level1.level2.level3.propToOmit"]);

        expect(result).toStrictEqual({ level1: { level2: { level3: { propToKeep: false } } } });
    });

    it("should handle objects with mixed data types (strings, numbers, booleans)", () => {
        expect.assertions(1);

        const input = { boolProp: true, numProp: 42, strProp: "string" };
        const result = omit(input, ["numProp"]);

        expect(result).toStrictEqual({ boolProp: true, strProp: "string" });
    });

    it("should omit FLAT", () => {
        expect.assertions(1);

        const input = { filled: true, id: "1", name: "n1", omited: true };
        const result = omit(input, ["omited"]);

        expect(result).toStrictEqual({ filled: true, id: "1", name: "n1" });
    });

    it("should omit NESTED", () => {
        expect.assertions(4);

        const input = {
            nested: { omit: { no: 0, yes: 0 } },
            secondProp: true,
        };

        const result1 = omit(input, ["nested.omit.yes"]);

        expect(result1).toStrictEqual({ nested: { omit: { no: 0 } }, secondProp: true });

        const result2 = omit(input, ["nested.omit"]);

        expect(result2).toStrictEqual({ nested: {}, secondProp: true });

        const result3 = omit(input, ["nested"]);

        expect(result3).toStrictEqual({ secondProp: true });

        const result4 = omit(input, ["nested.omit.yes", "secondProp"]);

        expect(result4).toStrictEqual({ nested: { omit: { no: 0 } } });
    });

    it("should omit with NESTED wildcards", () => {
        expect.assertions(1);

        const input = {
            omited: { 123: { no: false, yes: true }, 456: { no: false, yes: true } },
            picks: { 456: { no: false, yes: true } },
        };

        const result = omit(input, ["omited.*.yes"]);

        expect(result).toStrictEqual({
            omited: { 123: { no: false }, 456: { no: false } },
            picks: { 456: { no: false, yes: true } },
        });
    });

    it("should return a fresh copy when no keys are provided (not the original reference)", () => {
        expect.assertions(3);

        const input = { nested: { keep: 1 }, top: 2 };
        const result = omit(input, []);

        expect(result).toStrictEqual(input);
        expect(result).not.toBe(input);
        // mutating the result must not affect the input
        expect(input.nested.keep).toBe(1);
    });

    it("should traverse arrays of objects with an indexed path", () => {
        expect.assertions(1);

        const input = {
            users: [
                { name: "a", password: "p1" },
                { name: "b", password: "p2" },
            ],
        };
        const result = omit(input, ["users.0.password"]);

        expect(result).toStrictEqual({ users: [{ name: "a" }, { name: "b", password: "p2" }] });
    });

    it("should traverse arrays of objects with a wildcard path", () => {
        expect.assertions(1);

        const input = {
            users: [
                { name: "a", password: "p1" },
                { name: "b", password: "p2" },
            ],
        };
        const result = omit(input, ["users.*.password"]);

        expect(result).toStrictEqual({ users: [{ name: "a" }, { name: "b" }] });
    });

    it("should target keys containing literal dots via backslash escaping", () => {
        expect.assertions(1);

        const input = { "a.b": "drop", c: "keep" };
        const result = omit(input, [String.raw`a\.b`]);

        expect(result).toStrictEqual({ c: "keep" });
    });

    it("should preserve symbol-keyed properties", () => {
        expect.assertions(2);

        const symbol = Symbol("meta");
        const input = { drop: 1, keep: 2, [symbol]: "kept" };
        const result = omit(input, ["drop"]);

        expect(result).toStrictEqual({ keep: 2, [symbol]: "kept" });
        expect(result[symbol]).toBe("kept");
    });

    it("should keep non-plain values by reference (shared Date)", () => {
        expect.assertions(1);

        const date = new Date();
        const input = { drop: 1, when: date };
        const result = omit(input, ["drop"]);

        expect(result.when).toBe(date);
    });

    it("should not traverse into class instances (omit path is a no-op)", () => {
        expect.assertions(2);

        class Session {
            public token = "secret";
        }

        const input = { id: 1, session: new Session() };
        const result = omit(input, ["session.token"]);

        expect(result.session).toBe(input.session);
        expect((result.session as Session).token).toBe("secret");
    });

    it("should not pollute Object.prototype when omitting near a __proto__ key", () => {
        expect.assertions(3);

        const input = JSON.parse(`{ "__proto__": { "polluted": true }, "safe": 1 }`) as Record<string, unknown>;
        const result = omit(input, ["safe"]);

        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        // The own "__proto__" data property is carried over as an ordinary key.
        expect(Object.hasOwn(result, "__proto__")).toBe(true);
    });

    it("should treat constructor as an ordinary own key", () => {
        expect.assertions(1);

        const input = { constructor: "c", prototype: "p", safe: 1 };

        expect(omit(input, ["constructor"])).toStrictEqual({ prototype: "p", safe: 1 });
    });

    it("should drop a primitive array element addressed by index", () => {
        expect.assertions(1);

        const input = { list: [1, 2, 3] };

        expect(omit(input, ["list.1" as never])).toStrictEqual({ list: [1, 3] });
    });

    it("should not mutate the input when omitting a nested key", () => {
        expect.assertions(2);

        const input = { nested: { secret: "x", visible: 1 } };
        const result = omit(input, ["nested.secret"]);

        expect(input.nested.secret).toBe("x");
        expect(result).toStrictEqual({ nested: { visible: 1 } });
    });

    it("should keep a non-plain value by reference instead of descending into it", () => {
        expect.assertions(2);

        const map = new Map([["secret", "x"]]);
        const input = { map, other: 1 };
        const result = omit(input, ["map.secret" as never]) as { map: Map<string, string> };

        expect(result.map).toBe(map);
        expect(result.map.get("secret")).toBe("x");
    });

    it("should omit from a null-prototype object", () => {
        expect.assertions(1);

        const input = Object.assign(Object.create(null) as Record<string, unknown>, { a: 1, b: 2 });

        expect(omit(input as never, ["b" as never])).toStrictEqual({ a: 1 });
    });

    it("should traverse a nested null-prototype object", () => {
        expect.assertions(1);

        const nested = Object.assign(Object.create(null) as Record<string, unknown>, { keep: 1, secret: 2 });

        expect(omit({ nested } as never, ["nested.secret" as never])).toStrictEqual({ nested: { keep: 1 } });
    });
});
