import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe.each([Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray])("typed arrays", (TypedArray) => {
    it(`returns \`${TypedArray.name}[]\` for empty arrays`, () => {
        expect.assertions(1);

        expect(inspect(new TypedArray())).toBe(`${TypedArray.name}[]`);
    });

    describe("truncate", () => {
        it("returns the full representation when truncate is over string length", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 40 })).toBe(`${TypedArray.name}[ 1, 2, 3 ]`);
        });

        it("truncates array values longer than truncate (20)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 20 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (19)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 19 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (18)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 18 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (17)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 17 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (16)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 16 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (15)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 15 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (14)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 14 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (13)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 13 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (12)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 12 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (11)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 11 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (10)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 10 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (9)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 9 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (8)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 8 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (7)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 7 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (6)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 6 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (5)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 5 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (4)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 4 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (3)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 3 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (2)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 2 })).toBe(`${TypedArray.name}[ …(3) ]`);
        });

        it("truncates array values longer than truncate (1)", () => {
            expect.assertions(1);

            expect(inspect(new TypedArray([1, 2, 3]), { truncate: 1 })).toBe(`${TypedArray.name}[ …(3) ]`);
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
