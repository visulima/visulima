import { describe, expect, it } from "vitest";

import { closestN, similarity } from "../../src/levenshtein";

describe("levenshtein", () => {
    it("test closest1", () => {
        expect.assertions(1);

        const actual = closestN("fast", ["slow", "faster", "fastest"], 1);
        const expected = ["faster"];

        expect(actual).toStrictEqual(expected);
    });

    it("test closest2", () => {
        expect.assertions(1);

        const actual = closestN("fast", ["slow", "faster", "fastest"], 2);
        const expected = ["faster", "fastest"];

        expect(actual).toStrictEqual(expected);
    });

    it("test closestN", () => {
        expect.assertions(1);

        const array = ["slow", "faster", "fastest", "fanta", "feast", "fest"];
        const actual = closestN("fast", array, 4);
        const expected = ["feast", "fest", "faster", "fanta"];

        expect(actual).toStrictEqual(expected);
    });

    describe(similarity, () => {
        it("should return 1 for identical strings", () => {
            expect.assertions(2);

            expect(similarity("foo", "foo")).toBe(1);
            expect(similarity("", "")).toBe(1);
        });

        it("should return a normalized score in the [0, 1] range", () => {
            expect.assertions(2);

            // distance("kitten", "sitting") === 3, max length 7 => 1 - 3/7
            expect(similarity("kitten", "sitting")).toBeCloseTo(1 - 3 / 7, 10);
            expect(similarity("abc", "xyz")).toBe(0);
        });

        it("should handle one empty string", () => {
            expect.assertions(1);

            expect(similarity("", "abcd")).toBe(0);
        });
    });
});
