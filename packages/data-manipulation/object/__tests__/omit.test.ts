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
});
