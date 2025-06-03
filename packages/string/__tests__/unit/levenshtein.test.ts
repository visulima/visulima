import { describe, expect, it } from "vitest";

import { closestN } from "../../src/levenshtein";

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
});
