import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe.each([Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray])("inspect with TypedArrays", (TypedArray) => {
    it(`should inspect an empty ${TypedArray.name}`, () => {
        expect.assertions(1);

        expect(inspect(new TypedArray())).toBe(`${TypedArray.name} (0) []`);
    });

    it(`should inspect a ${TypedArray.name} with values`, () => {
        expect.assertions(1);

        expect(inspect(new TypedArray([1, 2, 3]))).toBe(`${TypedArray.name} (3) [ 1, 2, 3 ]`);
    });

    describe("maxStringLength option", () => {
        it("should not truncate a short TypedArray", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 40 })).toBe(`${TypedArray.name} (3) [ 1, 2, 3 ]`);
        });

        it.each(Array.from({ length: 20 }, (_, index) => index + 1).reverse())("should truncate a TypedArray when maxStringLength is %s", (length) => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: length })).toBe(`${TypedArray.name} (3) [ …(3) ]`);
        });
    });

    describe("non-integer properties", () => {
        it("should inspect non-integer properties", () => {
            expect.assertions(1);

            const array = new TypedArray([1, 2, 3]);

            // @ts-expect-error - missing reference
            array.foo = "bar";

            expect(inspect(array)).toBe(`${TypedArray.name} (3) [ 1, 2, 3, foo: 'bar' ]`);
        });
    });
});
