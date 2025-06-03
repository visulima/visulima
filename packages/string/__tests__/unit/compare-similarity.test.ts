import { describe, expect, it } from "vitest";

import { compareSimilarity } from "../../src/compare-similarity";

describe(compareSimilarity, () => {
    it("handles basic example 1", () => {
        expect.assertions(1);

        const baseWord = "eature";
        const wordsToSort = ["creature", "fixture", "future", "feather"];
        // Sort a copy of the array to avoid mutating the original
        const sortedWords = [...wordsToSort].sort(compareSimilarity(baseWord));

        expect(sortedWords).toStrictEqual(["creature", "future", "fixture", "feather"]);
    });

    it("handles basic example 2 (case sensitive)", () => {
        expect.assertions(1);

        const baseWord = "hi";
        const wordsToSort = ["hi", "hello", "help", "HOWDY"];
        // Sort a copy of the array
        const sortedWords = [...wordsToSort].sort(compareSimilarity(baseWord, { caseSensitive: true }));

        expect(sortedWords).toStrictEqual(["hi", "help", "hello", "HOWDY"]);
    });
});
