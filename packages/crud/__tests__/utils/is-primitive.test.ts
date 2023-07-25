import { describe, expect, it } from "vitest";

import isPrimitive from "../../src/utils/is-primitive";

describe("primitives", () => {
    it("should return true for primitives", () => {
        const nbr = 1;
        const stringString = "hello";
        const bool = true;

        expect(isPrimitive(nbr)).toBeTruthy();
        expect(isPrimitive(stringString)).toBeTruthy();
        expect(isPrimitive(bool)).toBeTruthy();
    });

    it("should return false for non primitive types", () => {
        const object = {};
        const array: string[] = [];
        const symbol = Symbol(0);

        expect(isPrimitive(object)).toBeFalsy();
        expect(isPrimitive(array)).toBeFalsy();
        expect(isPrimitive(symbol)).toBeFalsy();
    });
});
