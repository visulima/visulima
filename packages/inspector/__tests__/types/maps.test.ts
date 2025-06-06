import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("maps", () => {
    it("returns `Map {}` for empty Maps", () => {
        expect.assertions(1);

        expect(inspect(new Map())).toBe("Map (0) {}");
    });

    it("should correctly inspects Map with a single entry", () => {
        expect.assertions(1);

        expect(inspect(new Map([["a", 1]]))).toBe("Map (1) { 'a' => 1 }");
    });

    it("should inspects both keys and values", () => {
        expect.assertions(1);

        expect(
            inspect(
                new Map([
                    [{ a: 1 }, { b: 1 }],
                    [{ a: 2 }, { b: 2 }],
                ]),
            ),
        ).toBe("Map (2) { { a: 1 } => { b: 1 }, { a: 2 } => { b: 2 } }");
    });

    it("should support quoteStyle", () => {
        expect.assertions(2);

        expect(
            inspect(
                new Map([
                    ["a", 1],
                    ["b", 2],
                    ["c", 3],
                ]),
                {
                    quoteStyle: "single",
                },
            ),
        ).toBe("Map (3) { 'a' => 1, 'b' => 2, 'c' => 3 }");
        expect(
            inspect(
                new Map([
                    ["a", 1],
                    ["b", 2],
                    ["c", 3],
                ]),
                {
                    quoteStyle: "double",
                },
            ),
        ).toBe("Map (3) { \"a\" => 1, \"b\" => 2, \"c\" => 3 }");
    });

    it("should render a Map with indent", () => {
        expect.assertions(7);

        const map = new Map();

        map.set({ a: 1 }, ["b"]);
        map.set(3, Number.NaN);

        expect(inspect(map, { indent: 2 }), "Map keys are not indented (two)").toMatchInlineSnapshot(`"Map (2) { { a: 1 } => [ 'b' ], 3 => NaN }"`);
        expect(inspect(map, { indent: "\t" }), "Map keys are not indented (tabs)").toMatchInlineSnapshot(`"Map (2) { { a: 1 } => [ 'b' ], 3 => NaN }"`);
        expect(inspect(map, { indent: "\t", quoteStyle: "double" }), "Map keys are not indented (tabs + double quotes)").toMatchInlineSnapshot(`"Map (2) { { a: 1 } => [ "b" ], 3 => NaN }"`);

        expect(inspect(new Map(), { indent: 2 }), "empty Map should show as empty (two)").toBe("Map (0) {}");
        expect(inspect(new Map(), { indent: "\t" }), "empty Map should show as empty (tabs)").toBe("Map (0) {}");

        const nestedMap = new Map();

        nestedMap.set(nestedMap, map);

        expect(inspect(nestedMap, { indent: 2 }), "Map containing a Map should work (two)").toMatchInlineSnapshot(`"Map (1) { [Circular] => Map (2) { { a: 1 } => [ 'b' ], 3 => NaN } }"`);
        expect(inspect(nestedMap, { indent: "\t" }), "Map containing a Map should work (tabs)").toMatchInlineSnapshot(`"Map (1) { [Circular] => Map (2) { { a: 1 } => [ 'b' ], 3 => NaN } }"`);
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 35 },
                ),
            ).toBe("Map (3) { 'a' => 1, 'b' => 2, 'c' => 3 }");
        });

        it("maxStringLengths map values longer than maxStringLength (34)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 34 },
                ),
            ).toBe("Map (3) { 'a' => 1, 'b' => 2, …(1) }");
        });

        it("maxStringLengths map values longer than maxStringLength (33)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 33 },
                ),
            ).toBe("Map (3) { 'a' => 1, 'b' => 2, …(1) }");
        });

        it("maxStringLengths map values longer than maxStringLength (32)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 32 },
                ),
            ).toBe("Map (3) { 'a' => 1, 'b' => 2, …(1) }");
        });

        it("maxStringLengths map values longer than maxStringLength (31)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 31 },
                ),
            ).toBe("Map (3) { 'a' => 1, 'b' => 2, …(1) }");
        });

        it("maxStringLengths map values longer than maxStringLength (30)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 30 },
                ),
            ).toBe("Map (3) { 'a' => 1, …(2) }");
        });

        it("maxStringLengths map values longer than maxStringLength (29)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 29 },
                ),
            ).toBe("Map (3) { 'a' => 1, …(2) }");
        });

        it("maxStringLengths map values longer than maxStringLength (28)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 28 },
                ),
            ).toBe("Map (3) { 'a' => 1, …(2) }");
        });

        it("maxStringLengths map values longer than maxStringLength (27)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 27 },
                ),
            ).toBe("Map (3) { 'a' => 1, …(2) }");
        });

        it("maxStringLengths map values longer than maxStringLength (26)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 26 },
                ),
            ).toBe("Map (3) { 'a' => 1, …(2) }");
        });

        it("maxStringLengths map values longer than maxStringLength (25)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 25 },
                ),
            ).toBe("Map (3) { 'a' => 1, …(2) }");
        });

        it("maxStringLengths map values longer than maxStringLength (24)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 24 },
                ),
            ).toBe("Map (3) { 'a' => 1, …(2) }");
        });

        it("maxStringLengths map values longer than maxStringLength (23)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 23 },
                ),
            ).toBe("Map (3) { 'a' => 1, …(2) }");
        });

        it("maxStringLengths map values longer than maxStringLength (22)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 22 },
                ),
            ).toBe("Map (3) { 'a' => 1, …(2) }");
        });

        it("maxStringLengths map values longer than maxStringLength (21)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 21 },
                ),
            ).toBe("Map (3) { 'a' => 1, …(2) }");
        });

        it("maxStringLengths map values longer than maxStringLength (20)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 20 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (19)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 19 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (18)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 18 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (17)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 17 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (16)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 16 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (15)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 15 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (14)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 14 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (13)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 13 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (11)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 11 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (10)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 10 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (9)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 9 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (8)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 8 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (7)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 7 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (6)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 6 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (5)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 5 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (4)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 4 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (3)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 3 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (2)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 2 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (1)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 1 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("maxStringLengths map values longer than maxStringLength (0)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 0 },
                ),
            ).toBe("Map (3) { …(3) }");
        });
    });

    describe("sorted", () => {
        it("returns the map with sorted keys", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 2],
                        ["b", 1],
                    ]),
                    { sorted: true },
                ),
            ).toBe("Map (2) { 'a' => 2, 'b' => 1 }");
        });

        it("returns the map with sorted keys using a custom sort function", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 2],
                        ["b", 1],
                    ]),
                    {
                        sorted: (a, b) => {
                            if (a > b) {
                                return -1;
                            }

                            if (a < b) {
                                return 1;
                            }

                            return 0;
                        },
                    },
                ),
            ).toBe("Map (2) { 'b' => 1, 'a' => 2 }");
        });
    });

    describe("compact", () => {
        it("should format a map on a single line if compact is true", () => {
            expect.assertions(1);

            const map = new Map([
                ["a", 1],
                ["b", 2],
            ]);

            expect(inspect(map, { compact: true })).toMatchInlineSnapshot(`"Map (2) { 'a' => 1, 'b' => 2 }"`);
        });

        it("should format a map on multiple lines if compact is false", () => {
            expect.assertions(1);

            const map = new Map([
                ["a", 1],
                ["b", 2],
            ]);

            expect(inspect(map, { breakLength: 0, compact: false })).toMatchInlineSnapshot(`
                "Map (2) {
                  'a' => 1,
                  'b' => 2
                }"
            `);
        });

        it("should format a map on a single line if it fits within breakLength", () => {
            expect.assertions(1);

            const map = new Map([
                ["a", 1],
                ["b", 2],
            ]);

            expect(inspect(map, { breakLength: 80 })).toMatchInlineSnapshot(`"Map (2) { 'a' => 1, 'b' => 2 }"`);
        });

        it("should format a map on multiple lines if it exceeds breakLength", () => {
            expect.assertions(1);

            const map = new Map([
                ["a", 1],
                ["b", 2],
            ]);

            expect(inspect(map, { breakLength: 20 })).toMatchInlineSnapshot(`
                "Map (2) {
                  'a' => 1,
                  'b' => 2
                }"
            `);
        });
    });
});
