import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe.each([Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray])("typed arrays", (TypedArray) => {
    it(`returns \`${TypedArray.name}[]\` for empty arrays`, () => {
        expect.assertions(1);

        expect(inspect(new TypedArray())).toBe(`${TypedArray.name}[]`);
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 40 })).toBe(`${TypedArray.name}[ 1, 2, 3 ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (20)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 20 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (19)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 19 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (18)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 18 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (17)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 17 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (16)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 16 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (15)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 15 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (14)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 14 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (13)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 13 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (12)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 12 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (11)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 11 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (10)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 10 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (9)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 9 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (8)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 8 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (7)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 7 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (6)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 6 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (5)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 5 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (4)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 4 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (3)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 3 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (2)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 2 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("maxStringLengths array values longer than maxStringLength (1)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { maxStringLength: 1 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });
    });

    describe("non-integer properties", () => {
        it("outputs non-integer properties right after standard list items", () => {
            expect.assertions(1);

            const array = new TypedArray([1, 2, 3]);

            // @ts-expect-error - missing reference
            array.foo = "bar";

            expect(inspect(array)).toBe(`${TypedArray.name}[ 1, 2, 3, foo: 'bar' ]`);
        });
    });
});
