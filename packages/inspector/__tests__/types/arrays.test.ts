import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with Arrays", () => {
    it("should return '[]' for an empty array", () => {
        expect.assertions(1);

        expect(inspect([])).toBe("[]");
    });

    it("should inspect a simple array with single-line elements", () => {
        expect.assertions(2);

        const object = [1, 2, 3, "asdf\nsdf"];

        const expected = String.raw`[ 1, 2, 3, 'asdf\nsdf' ]`;

        expect(inspect(object, { indent: 2 })).toBe(expected);
        expect(inspect(object, { indent: "\t" })).toBe(expected);
    });

    it("should correctly indent an array with complex, multi-line elements", () => {
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

    it("should correctly indent an array of objects and arrays", () => {
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

    describe("with maxStringLength option", () => {
        it("should return the full representation when maxStringLength is greater than the actual length", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 17 })).toBe("[ 'a', 'b', 'c' ]");
        });

        it("should truncate the array representation when maxStringLength is 14", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 14 })).toBe("[ 'a', …(2) ]");
        });

        it("should truncate the array representation when maxStringLength is 13", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 13 })).toBe("[ 'a', …(2) ]");
        });

        it("should truncate the array representation when maxStringLength is 12", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 12 })).toBe("[ …(3) ]");
        });

        it("should truncate the array representation when maxStringLength is 11", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 11 })).toBe("[ …(3) ]");
        });

        it("should truncate the array representation when maxStringLength is 10", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 10 })).toBe("[ …(3) ]");
        });

        it("should truncate the array representation when maxStringLength is 9", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 9 })).toBe("[ …(3) ]");
        });

        it("should truncate the array representation when maxStringLength is 8", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 8 })).toBe("[ …(3) ]");
        });

        it("should truncate the array representation when maxStringLength is 7", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 7 })).toBe("[ …(3) ]");
        });

        it("should truncate the array representation when maxStringLength is 6", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 6 })).toBe("[ …(3) ]");
        });

        it("should truncate the array representation when maxStringLength is 5", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 5 })).toBe("[ …(3) ]");
        });

        it("should truncate the array representation when maxStringLength is 4", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 4 })).toBe("[ …(3) ]");
        });

        it("should truncate the whole array when maxStringLength is 3", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 3 })).toBe("[ …(3) ]");
        });

        it("should truncate the whole array when maxStringLength is 2", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 2 })).toBe("[ …(3) ]");
        });

        it("should truncate the whole array when maxStringLength is 1", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { maxStringLength: 1 })).toBe("[ …(3) ]");
        });
    });

    describe("non-integer properties", () => {
        it("should display non-integer properties after the array elements", () => {
            expect.assertions(1);

            const array = ["a", "b", "c"];

            // @ts-expect-error - TS doesn't allow this
            array.foo = "bar";

            expect(inspect(array)).toBe("[ 'a', 'b', 'c', foo: 'bar' ]");
        });
    });

    describe("with sorted option", () => {
        it("should sort and display non-integer properties when 'sorted' is true", () => {
            expect.assertions(1);

            const array = ["a", "b", "c"];

            // @ts-expect-error - TS doesn't allow this
            array.foo = "bar";
            // @ts-expect-error - TS doesn't allow this
            array.baz = "qux";

            expect(inspect(array, { sorted: true })).toBe("[ 'a', 'b', 'c', baz: 'qux', foo: 'bar' ]");
        });
    });

    it("should correctly represent holes in a sparse array as 'undefined'", () => {
        expect.assertions(1);

        const xs = ["a", "b"];

        xs[5] = "f";
        xs[7] = "j";
        xs[8] = "k";

        expect(inspect(xs)).toBe("[ 'a', 'b', undefined, undefined, undefined, 'f', undefined, 'j', 'k' ]");
    });
});
