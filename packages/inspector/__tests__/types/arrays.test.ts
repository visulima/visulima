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

        expect(inspect(value, { indent: 2 })).toBe(
            ["[", "  1,", "  {", "    a: 1,", "    b: {", "      c: 1", "    }", "  },", String.raw`  'asdf\nsdf'`, "]"].join("\n"),
        );
        expect(inspect(value, { indent: "\t" })).toBe(["[", "	1,", "	{", "		a: 1,", "		b: {", "			c: 1", "		}", "	},", String.raw`	'asdf\nsdf'`, "]"].join("\n"));
    });

    it("should return a values array with indent", () => {
        expect.assertions(2);

        const object = [{}, [], { "a-b": 5 }];

        expect(inspect(object, { indent: 2 })).toBe(["[", "  {},", "  [],", "  {", "    'a-b': 5", "  }", "]"].join("\n"));
        expect(inspect(object, { indent: "\t" })).toBe(["[", "	{},", "	[],", "	{", "		'a-b': 5", "	}", "]"].join("\n"));
    });

    describe("truncate", () => {
        it("returns the full representation when truncate is over string length", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 17 })).toBe("[ 'a', 'b', 'c' ]");
        });

        it("truncates array values longer than truncate (14)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 14 })).toBe("[ 'a', …(2) ]");
        });

        it("truncates array values longer than truncate (13)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 13 })).toBe("[ 'a', …(2) ]");
        });

        it("truncates array values longer than truncate (12)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 12 })).toBe("[ …(3) ]");
        });

        it("truncates array values longer than truncate (11)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 11 })).toBe("[ …(3) ]");
        });

        it("truncates array values longer than truncate (10)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 10 })).toBe("[ …(3) ]");
        });

        it("truncates array values longer than truncate (9)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 9 })).toBe("[ …(3) ]");
        });

        it("truncates array values longer than truncate (8)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 8 })).toBe("[ …(3) ]");
        });

        it("truncates array values longer than truncate (7)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 7 })).toBe("[ …(3) ]");
        });

        it("truncates array values longer than truncate (6)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 6 })).toBe("[ …(3) ]");
        });

        it("truncates array values longer than truncate (5)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 5 })).toBe("[ …(3) ]");
        });

        it("truncates array values longer than truncate (4)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 4 })).toBe("[ …(3) ]");
        });

        it("truncates whole array if truncate 3 or less (3)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 3 })).toBe("[ …(3) ]");
        });

        it("truncates whole array if truncate 3 or less (2)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 2 })).toBe("[ …(3) ]");
        });

        it("truncates whole array if truncate 3 or less (1)", () => {
            expect.assertions(1);

            expect(inspect(["a", "b", "c"], { truncate: 1 })).toBe("[ …(3) ]");
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
