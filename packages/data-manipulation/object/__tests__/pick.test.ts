import { describe, expect, it } from "vitest";

import { pick } from "../src";

describe(pick, () => {
    it("should pick flat properties correctly when provided", () => {
        expect.assertions(1);

        const input = { filled: true, id: "1", name: "n1", notfilled: false };
        const expected = pick(input, ["name", "filled", "id"]);

        expect(expected).toStrictEqual({ filled: true, id: "1", name: "n1" });
    });

    it("should return empty object when no keys are provided", () => {
        expect.assertions(1);

        const input = { filled: true, id: "1", name: "n1", notfilled: false };
        const expected = pick(input, []);

        expect(expected).toStrictEqual({});
    });

    it("should pick nested properties using dot-notation", () => {
        expect.assertions(1);

        const input = { nested: { picks: { no: 0, yes: 0 } }, secondProp: true };
        const expected = pick(input, ["nested.picks.yes"]);

        expect(expected).toStrictEqual({ nested: { picks: { yes: 0 } } });
    });

    it("should pick multiple nested properties correctly", () => {
        expect.assertions(1);

        const input = { nested: { picks: { no: 0, yes: 0 } }, secondProp: { no: false, yes: true } };
        const expected = pick(input, ["nested.picks.yes", "secondProp.yes"]);

        expect(expected).toStrictEqual({ nested: { picks: { yes: 0 } }, secondProp: { yes: true } });
    });

    it("should pick properties with wildcard notation", () => {
        expect.assertions(1);

        const input = {
            omited: { 123: { no: false, yes: true } },
            picks: { 123: { no: false, yes: true }, 456: { no: false, yes: true } },
        };
        const expected = pick(input, ["picks.*.yes"]);

        expect(expected).toStrictEqual({ picks: { 123: { yes: true }, 456: { yes: true } } });
    });

    it("should handle empty object input gracefully", () => {
        expect.assertions(1);

        const input = {};
        const expected = pick(input, ["anyKey"]);

        expect(expected).toStrictEqual({});
    });

    it("should handle non-existent keys gracefully", () => {
        expect.assertions(1);

        const input = { filled: true, id: "1", name: "n1" };
        const expected = pick(input, ["nonExistentKey"]);

        expect(expected).toStrictEqual({});
    });

    it("should handle deeply nested properties correctly", () => {
        expect.assertions(1);

        const input = { a: { b: { c: { d: 1 } } } };
        const expected = pick(input, ["a.b.c.d"]);

        expect(expected).toStrictEqual({ a: { b: { c: { d: 1 } } } });
    });

    it("should handle arrays within objects correctly", () => {
        expect.assertions(1);

        const input = { a: [1, 2, 3], b: "test" };
        const expected = pick(input, ["a"]);

        expect(expected).toStrictEqual({ a: [1, 2, 3] });
    });

    it("should handle mixed types within objects correctly", () => {
        expect.assertions(1);

        const input = { a: 1, b: "string", c: true, d: null };
        const expected = pick(input, ["a", "b", "c"]);

        expect(expected).toStrictEqual({ a: 1, b: "string", c: true });
    });

    it("should pick FLAT", () => {
        expect.assertions(1);

        const input = { filled: true, id: "1", name: "n1", notfilled: false };
        const expected = pick(input, ["name", "filled", "id"]);

        expect(expected).toStrictEqual({ filled: true, id: "1", name: "n1" });
    });

    it("should pick 0 props", () => {
        expect.assertions(1);

        const input = { filled: true, id: "1", name: "n1", notfilled: false };
        const expected = pick(input, []);

        expect(expected).toStrictEqual({});
    });

    it("should pick NESTED - single pick", () => {
        expect.assertions(1);

        const input = {
            nested: { picks: { no: 0, yes: 0 } },
            secondProp: true,
        };
        const expected = pick(input, ["nested.picks.yes"]);

        expect(expected).toStrictEqual({ nested: { picks: { yes: 0 } } });
    });

    it("should pick NESTED - single pick 2", () => {
        expect.assertions(1);

        const input = {
            nested: { picks: { no: 0, yes: 0 } },
            secondProp: true,
        };
        const expected = pick(input, ["nested.picks.yes"]);

        expect(expected).toStrictEqual({ nested: { picks: { yes: 0 } } });
    });

    it("should pick NESTED - single pick 3", () => {
        expect.assertions(1);

        const input = {
            nested: { picks: { no: 0, yes: 0 } },
            secondProp: true,
        };
        const expected = pick(input, ["nested"]);

        expect(expected).toStrictEqual({ nested: { picks: { no: 0, yes: 0 } } });
    });

    it("should pick NESTED - multiple pick", () => {
        expect.assertions(3);

        const input = {
            nested: { picks: { no: 0, yes: 0 } },
            secondProp: { no: false, yes: true },
        };

        const expected1 = pick(input, ["nested.picks.yes", "secondProp.yes"]);

        expect(expected1).toStrictEqual({ nested: { picks: { yes: 0 } }, secondProp: { yes: true } });

        const expected2 = pick(input, ["nested.picks", "secondProp.yes"]);

        expect(expected2).toStrictEqual({ nested: { picks: { no: 0, yes: 0 } }, secondProp: { yes: true } });

        const expected3 = pick(input, ["nested", "secondProp.yes"]);

        expect(expected3).toStrictEqual({ nested: { picks: { no: 0, yes: 0 } }, secondProp: { yes: true } });
    });

    it("should pick with NESTED wildcards", () => {
        expect.assertions(1);

        const input = {
            omited: {
                123: { no: false, yes: true },
            },
            picks: {
                123: { no: false, yes: true },
                456: { no: false, yes: true },
            },
        };

        type Result = { picks: { 123: { yes: boolean }; 456: { yes: boolean } } };

        const expected: Result = pick(input, ["picks.*.yes"]);

        expect(expected).toStrictEqual({
            picks: {
                123: { yes: true },
                456: { yes: true },
            },
        });
    });

    it("should traverse arrays of objects with an indexed path", () => {
        expect.assertions(1);

        const input = {
            users: [
                { name: "a", password: "p1" },
                { name: "b", password: "p2" },
            ],
        };
        const expected = pick(input, ["users.0.name"]);

        expect(expected).toStrictEqual({ users: [{ name: "a" }] });
    });

    it("should traverse arrays of objects with a wildcard path", () => {
        expect.assertions(1);

        const input = {
            users: [
                { name: "a", password: "p1" },
                { name: "b", password: "p2" },
            ],
        };
        const expected = pick(input, ["users.*.name"]);

        expect(expected).toStrictEqual({ users: [{ name: "a" }, { name: "b" }] });
    });

    it("should target keys containing literal dots via backslash escaping", () => {
        expect.assertions(1);

        const input = { "a.b": "keep", c: "drop" };
        const expected = pick(input, [String.raw`a\.b`]);

        expect(expected).toStrictEqual({ "a.b": "keep" });
    });

    it("should not share structure with the source object", () => {
        expect.assertions(2);

        const input = { nested: { keep: 1 } };
        const result = pick(input, ["nested"]);

        expect(result).toStrictEqual({ nested: { keep: 1 } });
        expect(result.nested).not.toBe(input.nested);
    });

    it("should drop a picked path that is deeper than the actual data", () => {
        expect.assertions(1);

        const input: Record<string, unknown> = { a: { b: 1 } };
        const result = pick(input, ["a.b.c"]);

        expect(result).toStrictEqual({});
    });

    it("should drop primitive array elements under a wildcard leaf path", () => {
        expect.assertions(1);

        const input: Record<string, unknown> = { users: ["raw", { name: "a", password: "p" }] };
        const result = pick(input, ["users.*.name"]);

        expect(result).toStrictEqual({ users: [{ name: "a" }] });
    });

    it("should preserve symbol-keyed properties inside a fully picked branch", () => {
        expect.assertions(2);

        const symbol = Symbol("meta");
        const input = { nested: { keep: 1, [symbol]: 2 }, other: true };
        const result = pick(input, ["nested"]);

        expect(result).toStrictEqual({ nested: { keep: 1, [symbol]: 2 } });
        expect((result.nested as Record<PropertyKey, unknown>)[symbol]).toBe(2);
    });

    it("should keep non-plain values by reference when picked", () => {
        expect.assertions(1);

        const date = new Date();
        const input = { other: 1, when: date };
        const result = pick(input, ["when"]);

        expect(result.when).toBe(date);
    });
});
