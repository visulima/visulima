import { describe, expect, it } from "vitest";

import isPrimitive from "../../src/utils/is-primitive";

describe("primitives", () => {
    it("should return true for primitives", () => {
        expect.assertions(3);

        const nbr = 1;
        const stringString = "hello";
        const bool = true;

        expect(isPrimitive(nbr)).toBe(true);
        expect(isPrimitive(stringString)).toBe(true);
        expect(isPrimitive(bool)).toBe(true);
    });

    it("should return false for non primitive types", () => {
        expect.assertions(3);

        const object = {};
        const array: string[] = [];
        const symbol = Symbol(0);

        expect(isPrimitive(object)).toBe(false);
        expect(isPrimitive(array)).toBe(false);
        expect(isPrimitive(symbol)).toBe(false);
    });
});
