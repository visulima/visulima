import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("arrays", () => {
    it("returns `[]` for empty arrays", () => {
        expect.assertions(1);

        expect(inspect([])).toBe("[]");
    });

    it("simple array with all single line elements", () => {
        expect.assertions(2);

        const object = [1, 2, 3, "asdf\nsdf"];

        const expected = String.raw`[ 1, 2, 3, 'asdf\nsdf' ]`;

        expect(inspect(object, { indent: 2 })).toBe(expected);
        expect(inspect(object, { indent: "\t" })).toBe(expected);
    });

    it("should return a indent array with complex elements", () => {
        expect.assertions(2);

        const value = [1, { a: 1, b: { c: 1 } }, "asdf\nsdf"];

        expect(inspect(value, { indent: 2 })).toMatchInlineSnapshot(`
          "[
            1,
            { a: 1,
            b: { c: 1 } },
            'asdf\\nsdf'
          ]"
        `);
        expect(inspect(value, { indent: "\t" })).toMatchInlineSnapshot(`
          "[
          	1,
          	{ a: 1,
          	b: { c: 1 } },
          	'asdf\\nsdf'
          ]"
        `);
    });

    it("should return a values array with indent", () => {
        expect.assertions(2);

        const object = [{}, [], { "a-b": 5 }];

        expect(inspect(object, { indent: 2 })).toMatchInlineSnapshot(`
          "[
            {},
            [],
            { 'a-b': 5 }
          ]"
        `);
        expect(inspect(object, { indent: "\t" })).toMatchInlineSnapshot(`
          "[
          	{},
          	[],
          	{ 'a-b': 5 }
          ]"
        `);
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 17 })).toBe("[ 'a', 'b', 'c' ]");
        });

        it("maxStringLengths array values longer than maxStringLength (14)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 14 })).toBe("[ 'a', …(2) ]");
        });

        it("maxStringLengths array values longer than maxStringLength (13)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 13 })).toBe("[ 'a', …(2) ]");
        });

        it("maxStringLengths array values longer than maxStringLength (12)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 12 })).toBe("[ …(3) ]");
        });

        it("maxStringLengths array values longer than maxStringLength (11)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 11 })).toBe("[ …(3) ]");
        });

        it("maxStringLengths array values longer than maxStringLength (10)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 10 })).toBe("[ …(3) ]");
        });

        it("maxStringLengths array values longer than maxStringLength (9)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 9 })).toBe("[ …(3) ]");
        });

        it("maxStringLengths array values longer than maxStringLength (8)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 8 })).toBe("[ …(3) ]");
        });

        it("maxStringLengths array values longer than maxStringLength (7)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 7 })).toBe("[ …(3) ]");
        });

        it("maxStringLengths array values longer than maxStringLength (6)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 6 })).toBe("[ …(3) ]");
        });

        it("maxStringLengths array values longer than maxStringLength (5)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 5 })).toBe("[ …(3) ]");
        });

        it("maxStringLengths array values longer than maxStringLength (4)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 4 })).toBe("[ …(3) ]");
        });

        it("maxStringLengths whole array if maxStringLength 3 or less (3)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 3 })).toBe("[ …(3) ]");
        });

        it("maxStringLengths whole array if maxStringLength 3 or less (2)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 2 })).toBe("[ …(3) ]");
        });

        it("maxStringLengths whole array if maxStringLength 3 or less (1)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 1 })).toBe("[ …(3) ]");
        });
    });

    describe("non-integer properties", () => {
        it("outputs non-integer properties right after standard list items", () => {
            expect.assertions(1);

            const array = ["a", "b", "c"];

            // @ts-expect-error - TS doesn't allow this
            array.foo = "bar";

            expect(inspect(array)).toBe("[ 'a', 'b', 'c', foo: 'bar' ]");
        });
    });

    it("should return hole in array in the correct order", () => {
        expect.assertions(1);

        const xs = ["a", "b"];

        xs[5] = "f";
        xs[7] = "j";
        xs[8] = "k";

        expect(inspect(xs)).toBe("[ 'a', 'b', undefined, undefined, undefined, 'f', undefined, 'j', 'k' ]");
    });
});
