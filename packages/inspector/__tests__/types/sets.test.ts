import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("sets", () => {
    it("should return `Set {}` for empty sets", () => {
        expect.assertions(1);

        expect(inspect(new Set())).toBe("Set (0) {}");
    });

    it("should return `Set` with indent", () => {
        expect.assertions(6);

        const set = new Set();

        set.add({ a: 1 });
        set.add(["b"]);

        expect(inspect(set, { breakLength: 2, indent: 2 }), "new Set([{ a: 1 }, [\"b\"]]) should show indentation").toMatchSnapshot("set indent 2");
        expect(inspect(set, { breakLength: 2, indent: "\t" }), "new Set([{ a: 1 }, [\"b\"]]) should show size and contents (tabs)").toMatchSnapshot("set indent tabs");

        expect(inspect(new Set(), { indent: 2 }), "empty Set should show as empty (two)").toBe("Set (0) {}");
        expect(inspect(new Set(), { indent: "\t" }), "empty Set should show as empty (tabs)").toBe("Set (0) {}");

        const nestedSet = new Set();

        nestedSet.add(set);
        nestedSet.add(nestedSet);

        expect(inspect(nestedSet, { breakLength: 2, indent: 2 }), "Set containing a Set should work (two)").toMatchSnapshot("nested set indent 2");
        expect(inspect(nestedSet, { breakLength: 2, indent: "\t" }), "Set containing a Set should work (tabs)").toMatchSnapshot("nested set indent tabs");
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 20 })).toBe("Set (3) { 'a', 'b', 'c' }");
        });

        it("maxStringLengths set values longer than maxStringLength (19)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 19 })).toBe("Set (3) { 'a', …(2) }");
        });

        it("maxStringLengths set values longer than maxStringLength (18)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 18 })).toBe("Set (3) { 'a', …(2) }");
        });

        it("maxStringLengths set values longer than maxStringLength (17)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 17 })).toBe("Set (3) { 'a', …(2) }");
        });

        it("maxStringLengths set values longer than maxStringLength (16)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 16 })).toBe("Set (3) { 'a', …(2) }");
        });

        it("maxStringLengths set values longer than maxStringLength (15)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 15 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths set values longer than maxStringLength (14)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 14 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths set values longer than maxStringLength (13)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 13 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths set values longer than maxStringLength (12)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 12 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths set values longer than maxStringLength (11)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 11 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths set values longer than maxStringLength (10)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 10 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths set values longer than maxStringLength (9)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 9 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths set values longer than maxStringLength (8)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 8 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths set values longer than maxStringLength (7)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 7 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths set values longer than maxStringLength (6)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 6 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths set values longer than maxStringLength (5)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 5 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths set values longer than maxStringLength (4)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 4 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths whole array if maxStringLength 3 or less (3)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 3 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths whole array if maxStringLength 3 or less (2)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 2 })).toBe("Set (3) { …(3) }");
        });

        it("maxStringLengths whole array if maxStringLength 3 or less (1)", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 1 })).toBe("Set (3) { …(3) }");
        });
    });

    describe("sorted", () => {
        it("returns the set with sorted values", () => {
            expect.assertions(1);

            expect(inspect(new Set(["a", "b"]), { sorted: true })).toBe("Set (2) { 'a', 'b' }");
        });

        it("returns the set with sorted values using a custom sort function", () => {
            expect.assertions(1);

            expect(
                inspect(new Set(["a", "b"]), {
                    sorted: (a, b) => {
                        if (a > b) {
                            return -1;
                        }

                        if (a < b) {
                            return 1;
                        }

                        return 0;
                    },
                }),
            ).toBe("Set (2) { 'b', 'a' }");
        });
    });

    describe("compact", () => {
        it("should format a set on a single line if compact is true", () => {
            expect.assertions(1);

            const set = new Set([1, 2]);

            expect(inspect(set, { compact: true })).toBe("Set (2) { 1, 2 }");
        });

        it("should format a set on multiple lines if compact is false", () => {
            expect.assertions(1);

            const set = new Set([1, 2]);

            expect(inspect(set, { breakLength: 0, compact: false })).toBe("Set (2) {\n  1,\n  2\n}");
        });

        it("should format a set on a single line if it fits within breakLength", () => {
            expect.assertions(1);

            const set = new Set([1, 2]);

            expect(inspect(set, { breakLength: 80 })).toBe("Set (2) { 1, 2 }");
        });

        it("should format a set on multiple lines if it exceeds breakLength", () => {
            expect.assertions(1);

            const set = new Set([1, 2]);

            expect(inspect(set, { breakLength: 10 })).toBe("Set (2) {\n  1,\n  2\n}");
        });
    });
});
