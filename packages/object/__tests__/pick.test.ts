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
});
