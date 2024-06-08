import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe.each([
    ["objects", inspect],
    ["objects (Object.create(null))", (object, ...rest) => inspect(Object.assign(Object.create(null), object), ...rest)],
])("%s", (name, function_) => {
    it("returns `{}` for empty objects", () => {
        expect.assertions(1);

        expect(function_({})).toBe("{}");
    });

    it("quotes a key if it contains special chars", () => {
        expect.assertions(2);

        expect(function_({ "a.b": 1 })).toBe("{ 'a.b': 1 }");
        expect(function_({ "a b": 1 })).toBe("{ 'a b': 1 }");
    });

    it("quotes a key if it is empty", () => {
        expect.assertions(1);

        expect(function_({ "": 1 })).toBe("{ '': 1 }");
    });

    it("quotes a key if it contains a single quote", () => {
        expect.assertions(1);

        expect(function_({ "'": 1 })).toBe("{ '\\'': 1 }");
    });

    it("quotes a key if it contains a double quote", () => {
        expect.assertions(1);

        expect(function_({ '"': 1 })).toBe("{ '\"': 1 }");
    });

    if (name === "objects") {
        // eslint-disable-next-line vitest/no-conditional-tests
        it("detects circular references", () => {
            expect.assertions(1);

            const main = {};
            main.a = main;

            expect(function_(main)).toBe("{ a: [Circular] }");
        });
    }

    it("returns `{}` for empty objects with an anonoymous prototype", () => {
        expect.assertions(1);

        expect(function_(Object.create({ a: 1 }))).toBe("{}");
    });

    it("returns `{}` for empty objects with a null prototype", () => {
        expect.assertions(1);

        expect(function_(Object.create(Object.create(null)))).toBe("{}");
    });

    it("shows objects' own properties for objects with an anonoymous prototype", () => {
        expect.assertions(1);

        const object = Object.create({ a: 1 });
        object.b = 2;
        expect(function_(object)).toBe("{ b: 2 }");
    });

    describe("truncate", () => {
        it("returns the full representation when truncate is over string length", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 20 })).toBe("{ a: 1, b: 2, c: 3 }");
        });

        it("truncates object values longer than truncate (19)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 19 })).toBe("{ a: 1, …(2) }");
        });

        it("truncates object values longer than truncate (18)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 18 })).toBe("{ a: 1, …(2) }");
        });

        it("truncates object values longer than truncate (17)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 17 })).toBe("{ a: 1, …(2) }");
        });

        it("truncates object values longer than truncate (16)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 16 })).toBe("{ a: 1, …(2) }");
        });

        it("truncates object values longer than truncate (15)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 15 })).toBe("{ a: 1, …(2) }");
        });

        it("truncates object values longer than truncate (14)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 14 })).toBe("{ a: 1, …(2) }");
        });

        it("truncates object values longer than truncate (13)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 13 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (12)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 12 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (11)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 11 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (10)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 10 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (9)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 9 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (8)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 8 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (7)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 7 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (6)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 6 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (5)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 5 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (4)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 4 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (3)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 3 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (2)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 2 })).toBe("{ …(3) }");
        });

        it("truncates object values longer than truncate (1)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 1 })).toBe("{ …(3) }");
        });
    });
});
