import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("maps", () => {
    it("returns `Map{}` for empty Maps", () => {
        expect.assertions(1);

        expect(inspect(new Map())).toBe("Map{}");
    });

    it("inspects both keys and values", () => {
        expect.assertions(1);

        expect(
            inspect(
                new Map([
                    [{ a: 1 }, { b: 1 }],
                    [{ a: 2 }, { b: 2 }],
                ]),
            ),
        ).toBe("Map{ { a: 1 } => { b: 1 }, { a: 2 } => { b: 2 } }");
    });

    describe("truncate", () => {
        it("returns the full representation when truncate is over string length", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 35 },
                ),
            ).toBe("Map{ 'a' => 1, 'b' => 2, 'c' => 3 }");
        });

        it("truncates map values longer than truncate (34)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 34 },
                ),
            ).toBe("Map{ 'a' => 1, 'b' => 2, …(1) }");
        });

        it("truncates map values longer than truncate (33)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 33 },
                ),
            ).toBe("Map{ 'a' => 1, 'b' => 2, …(1) }");
        });

        it("truncates map values longer than truncate (32)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 32 },
                ),
            ).toBe("Map{ 'a' => 1, 'b' => 2, …(1) }");
        });

        it("truncates map values longer than truncate (31)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 31 },
                ),
            ).toBe("Map{ 'a' => 1, 'b' => 2, …(1) }");
        });

        it("truncates map values longer than truncate (30)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 30 },
                ),
            ).toBe("Map{ 'a' => 1, …(2) }");
        });

        it("truncates map values longer than truncate (29)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 29 },
                ),
            ).toBe("Map{ 'a' => 1, …(2) }");
        });

        it("truncates map values longer than truncate (28)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 28 },
                ),
            ).toBe("Map{ 'a' => 1, …(2) }");
        });

        it("truncates map values longer than truncate (27)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 27 },
                ),
            ).toBe("Map{ 'a' => 1, …(2) }");
        });

        it("truncates map values longer than truncate (26)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 26 },
                ),
            ).toBe("Map{ 'a' => 1, …(2) }");
        });

        it("truncates map values longer than truncate (25)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 25 },
                ),
            ).toBe("Map{ 'a' => 1, …(2) }");
        });

        it("truncates map values longer than truncate (24)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 24 },
                ),
            ).toBe("Map{ 'a' => 1, …(2) }");
        });

        it("truncates map values longer than truncate (23)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 23 },
                ),
            ).toBe("Map{ 'a' => 1, …(2) }");
        });

        it("truncates map values longer than truncate (22)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 22 },
                ),
            ).toBe("Map{ 'a' => 1, …(2) }");
        });

        it("truncates map values longer than truncate (21)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 21 },
                ),
            ).toBe("Map{ 'a' => 1, …(2) }");
        });

        it("truncates map values longer than truncate (20)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 20 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (19)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 19 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (18)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 18 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (17)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 17 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (16)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 16 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (15)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 15 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (14)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 14 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (13)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 13 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (11)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 11 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (10)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 10 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (9)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 9 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (8)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 8 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (7)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 7 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (6)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 6 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (5)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 5 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (4)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 4 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (3)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 3 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (2)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 2 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (1)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 1 },
                ),
            ).toBe("Map{ …(3) }");
        });

        it("truncates map values longer than truncate (0)", () => {
            expect.assertions(1);

            expect(
                inspect(
                    new Map([
                        ["a", 1],
                        ["b", 2],
                        ["c", 3],
                    ]),
                    { truncate: 0 },
                ),
            ).toBe("Map{ …(3) }");
        });
    });
});
