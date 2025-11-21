import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("sets", () => {
    it("should return `Set {}` for empty sets", () => {
        expect.assertions(1);

        expect(inspect(new Set())).toBe("Set (0) {}");
    });

    it("should return `Set` with indent", () => {
        expect.assertions(6);

        const set = new Set([["b"], { a: 1 }]);

        const expectedStringSpaces = ["Set (2) {", "  {", "    a: 1", "  },", "  [ 'b' ]", "}"].join("\n");
        const expectedStringTabs = ["Set (2) {", "	{", "		a: 1", "	},", "	[ 'b' ]", "}"].join("\n");

        expect(inspect(set, { indent: 2 }), "new Set([{ a: 1 }, [\"b\"]]) should show size and contents (two)").toBe(expectedStringSpaces);
        expect(inspect(set, { indent: "\t" }), "new Set([{ a: 1 }, [\"b\"]]) should show size and contents (tabs)").toBe(expectedStringTabs);

        expect(inspect(new Set(), { indent: 2 }), "empty Set should show as empty (two)").toBe("Set (0) {}");
        expect(inspect(new Set(), { indent: "\t" }), "empty Set should show as empty (tabs)").toBe("Set (0) {}");

        const nestedSet = new Set([set]);

        nestedSet.add(nestedSet);

        const expectedNestedSpaces = ["Set (2) {", "  Set (2) {", "    {", "      a: 1", "    },", "    [ 'b' ]", "  },", "  [Circular]", "}"].join("\n");
        const expectedNestedTabs = ["Set (2) {", "	Set (2) {", "		{", "			a: 1", "		},", "		[ 'b' ]", "	},", "	[Circular]", "}"].join("\n");

        expect(inspect(nestedSet, { indent: 2 }), "Set containing a Set should work (two)").toBe(expectedNestedSpaces);
        expect(inspect(nestedSet, { indent: "\t" }), "Set containing a Set should work (tabs)").toBe(expectedNestedTabs);
    });

    describe("truncate", () => {
        it("returns the full representation when truncate is over string length", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 20 })).toBe("Set (3) { 'a', 'b', 'c' }");
        });

        it("truncates set values longer than truncate (19)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 19 })).toBe("Set (3) { 'a', …(2) }");
        });

        it("truncates set values longer than truncate (18)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 18 })).toBe("Set (3) { 'a', …(2) }");
        });

        it("truncates set values longer than truncate (17)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 17 })).toBe("Set (3) { 'a', …(2) }");
        });

        it("truncates set values longer than truncate (16)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 16 })).toBe("Set (3) { 'a', …(2) }");
        });

        it("truncates set values longer than truncate (15)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 15 })).toBe("Set (3) { …(3) }");
        });

        it("truncates set values longer than truncate (14)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 14 })).toBe("Set (3) { …(3) }");
        });

        it("truncates set values longer than truncate (13)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 13 })).toBe("Set (3) { …(3) }");
        });

        it("truncates set values longer than truncate (12)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 12 })).toBe("Set (3) { …(3) }");
        });

        it("truncates set values longer than truncate (11)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 11 })).toBe("Set (3) { …(3) }");
        });

        it("truncates set values longer than truncate (10)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 10 })).toBe("Set (3) { …(3) }");
        });

        it("truncates set values longer than truncate (9)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 9 })).toBe("Set (3) { …(3) }");
        });

        it("truncates set values longer than truncate (8)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 8 })).toBe("Set (3) { …(3) }");
        });

        it("truncates set values longer than truncate (7)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 7 })).toBe("Set (3) { …(3) }");
        });

        it("truncates set values longer than truncate (6)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 6 })).toBe("Set (3) { …(3) }");
        });

        it("truncates set values longer than truncate (5)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 5 })).toBe("Set (3) { …(3) }");
        });

        it("truncates set values longer than truncate (4)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 4 })).toBe("Set (3) { …(3) }");
        });

        it("truncates whole array if truncate 3 or less (3)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 3 })).toBe("Set (3) { …(3) }");
        });

        it("truncates whole array if truncate 3 or less (2)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 2 })).toBe("Set (3) { …(3) }");
        });

        it("truncates whole array if truncate 3 or less (1)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { truncate: 1 })).toBe("Set (3) { …(3) }");
        });
    });
});
