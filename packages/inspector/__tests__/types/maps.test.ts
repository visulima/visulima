import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with Maps", () => {
    it("should return 'Map (0) {}' for an empty Map", () => {
        expect.assertions(1);

        expect(inspect(new Map())).toBe("Map (0) {}");
    });

    it("should correctly inspect a Map with a single entry", () => {
        expect.assertions(1);

        expect(inspect(new Map([["a", 1]]))).toBe("Map (1) { 'a' => 1 }");
    });

    it("should inspect both keys and values in a Map", () => {
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

    it("should respect the 'quoteStyle' option", () => {
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

    it("should correctly indent a Map's contents", () => {
        expect.assertions(7);

        const map = new Map();

        map.set({ a: 1 }, ["b"]);
        map.set(3, Number.NaN);

        expect(inspect(map, { indent: 2 }), "Map keys are not indented (two)").toMatchInlineSnapshot(`"Map (2) { { a: 1 } => [ 'b' ], 3 => NaN }"`);
        expect(inspect(map, { indent: "\t" }), "Map keys are not indented (tabs)").toMatchInlineSnapshot(`"Map (2) { { a: 1 } => [ 'b' ], 3 => NaN }"`);
        expect(inspect(map, { indent: "\t", quoteStyle: "double" }), "Map keys are not indented (tabs + double quotes)").toMatchInlineSnapshot(
            `"Map (2) { { a: 1 } => [ "b" ], 3 => NaN }"`,
        );

        expect(inspect(new Map(), { indent: 2 }), "empty Map should show as empty (two)").toBe("Map (0) {}");
        expect(inspect(new Map(), { indent: "\t" }), "empty Map should show as empty (tabs)").toBe("Map (0) {}");

        const nestedMap = new Map();

        nestedMap.set(nestedMap, map);

        expect(inspect(nestedMap, { indent: 2 }), "Map containing a Map should work (two)").toMatchInlineSnapshot(
            `"Map (1) { [Circular] => Map (2) { { a: 1 } => [ 'b' ], 3 => NaN } }"`,
        );
        expect(inspect(nestedMap, { indent: "\t" }), "Map containing a Map should work (tabs)").toMatchInlineSnapshot(
            `"Map (1) { [Circular] => Map (2) { { a: 1 } => [ 'b' ], 3 => NaN } }"`,
        );
    });

    describe("with maxStringLength option", () => {
        it("should return the full representation when maxStringLength is greater than the actual length", () => {
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

        it("should truncate the map representation when maxStringLength is 34", () => {
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

        it("should truncate the map representation when maxStringLength is 33", () => {
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

        it("should truncate the map representation when maxStringLength is 32", () => {
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

        it("should truncate the map representation when maxStringLength is 31", () => {
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

        it("should truncate the map representation when maxStringLength is 30", () => {
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

        it("should truncate the map representation when maxStringLength is 29", () => {
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

        it("should truncate the map representation when maxStringLength is 28", () => {
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

        it("should truncate the map representation when maxStringLength is 27", () => {
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

        it("should truncate the map representation when maxStringLength is 26", () => {
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

        it("should truncate the map representation when maxStringLength is 25", () => {
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

        it("should truncate the map representation when maxStringLength is 24", () => {
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

        it("should truncate the map representation when maxStringLength is 23", () => {
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

        it("should truncate the map representation when maxStringLength is 22", () => {
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
            ).toBe("Map (3) { …(3) }");
        });

        it("should truncate the map representation when maxStringLength is 21", () => {
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
            ).toBe("Map (3) { …(3) }");
        });

        it("should truncate the map representation when maxStringLength is 20", () => {
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

        it("should truncate the map representation when maxStringLength is 19", () => {
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

        it("should truncate the map representation when maxStringLength is 18", () => {
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

        it("should truncate the map representation when maxStringLength is 17", () => {
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

        it("should truncate the map representation when maxStringLength is 16", () => {
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

        it("should truncate the map representation when maxStringLength is 15", () => {
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

        it("should truncate the map representation when maxStringLength is 14", () => {
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

        it("should truncate the map representation when maxStringLength is 13", () => {
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

        it("should truncate the map representation when maxStringLength is 12", () => {
            expect.assertions(1);
            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { maxStringLength: 12 },
                ),
            ).toBe("Map (3) { …(3) }");
        });

        it("should truncate the map representation when maxStringLength is 11", () => {
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

        it("should truncate the map representation when maxStringLength is 10", () => {
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

        it("should truncate the map representation when maxStringLength is 9", () => {
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

        it("should truncate the map representation when maxStringLength is 8", () => {
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

        it("should truncate the map representation when maxStringLength is 7", () => {
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

        it("should truncate the map representation when maxStringLength is 6", () => {
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

        it("should truncate the map representation when maxStringLength is 5", () => {
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

        it("should truncate the map representation when maxStringLength is 4", () => {
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

        it("should truncate the map representation when maxStringLength is 3", () => {
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

        it("should truncate the map representation when maxStringLength is 2", () => {
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

        it("should truncate the map representation when maxStringLength is 1", () => {
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

        describe("with circular references", () => {
            it("should handle circular references in Maps", () => {
                expect.assertions(1);

                const map = new Map();

                map.set("a", map);

                expect(inspect(map)).toBe("Map (1) { 'a' => [Circular] }");
            });

            it("should handle deeply circular references in Maps", () => {
                expect.assertions(1);

                const map = new Map();

                map.set("a", new Map([["b", map]]));

                expect(inspect(map)).toBe("Map (1) { 'a' => Map (1) { 'b' => [Circular] } }");
            });
        });
    });

    describe("with non-map properties", () => {
        it("should not output non-map properties", () => {
            expect.assertions(1);

            const map = new Map();

            // @ts-expect-error - testing non-standard property
            map.foo = "bar";

            expect(inspect(map)).toBe("Map (0) {}");
        });
    });

    describe("with sorted option", () => {
        it("should sort Maps when sorted is true", () => {
            expect.assertions(1);

            const map = new Map([
                ["a", 2],
                ["b", 1],
            ]);

            expect(inspect(map, { sorted: true })).toBe("Map (2) { 'a' => 2, 'b' => 1 }");
        });
    });
});
