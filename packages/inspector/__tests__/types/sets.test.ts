import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with Sets", () => {
    it("should inspect an empty Set", () => {
        expect.assertions(1);

        expect(inspect(new Set())).toBe("Set (0) {}");
    });

    it("should inspect a Set with values", () => {
        expect.assertions(1);

        expect(inspect(new Set([1, 2]))).toBe("Set (2) { 1, 2 }");
    });

    it("should inspect a Set with nested values", () => {
        const set = new Set();

        set.add({ a: 1 });
        set.add(["b"]);

        expect(inspect(set)).toBe("Set (2) { { a: 1 }, [ 'b' ] }");
    });

    it("should inspect a Set with circular references", () => {
        const set = new Set();

        set.add(set);

        expect(inspect(set)).toBe("Set (1) { [Circular] }");
    });

    describe("maxStringLength option", () => {
        it("should truncate a long Set", () => {
            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 19 })).toBe("Set (3) { 'a', …(2) }");
        });

        it("should not truncate a short Set", () => {
            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 20 })).toBe("Set (3) { 'a', 'b', 'c' }");
        });

        it("should truncate a long Set to a minimum length", () => {
            expect(inspect(new Set(["a", "b", "c"]), { maxStringLength: 5 })).toBe("Set (3) { …(3) }");
        });
    });

    describe("sorted option", () => {
        it("should sort a Set", () => {
            expect(inspect(new Set(["a", "b"]), { sorted: true })).toBe("Set (2) { 'a', 'b' }");
        });

        it("should sort a Set with a custom sort function", () => {
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

    describe("compact option", () => {
        it("should format a set on a single line when compact is true", () => {
            const set = new Set([1, 2]);

            expect(inspect(set, { compact: true })).toBe("Set (2) { 1, 2 }");
        });

        it("should format a set on multiple lines when compact is false", () => {
            const set = new Set([1, 2]);

            expect(inspect(set, { breakLength: 0, compact: false })).toMatchSnapshot();
        });

        it("should format a set on a single line if it fits within breakLength", () => {
            const set = new Set([1, 2]);

            expect(inspect(set, { breakLength: 80 })).toBe("Set (2) { 1, 2 }");
        });

        it("should format a set on multiple lines if it exceeds breakLength", () => {
            const set = new Set([1, 2]);

            expect(inspect(set, { breakLength: 10 })).toMatchSnapshot();
        });

        it("should format a set with indentation", () => {
            const set = new Set();

            set.add({ a: 1 });
            set.add(["b"]);

            expect(inspect(set, { breakLength: 2, indent: 2 })).toMatchSnapshot();
        });

        it("should format a set with tab indentation", () => {
            const set = new Set();

            set.add({ a: 1 });
            set.add(["b"]);

            expect(inspect(set, { breakLength: 2, indent: "\t" })).toMatchSnapshot();
        });

        it("should format a nested set with indentation", () => {
            const nestedSet = new Set();
            const set = new Set();

            set.add(1);
            nestedSet.add(set);
            nestedSet.add(nestedSet);

            expect(inspect(nestedSet, { breakLength: 2, indent: 2 })).toMatchSnapshot();
        });
    });
});
