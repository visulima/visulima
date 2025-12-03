// Copyright 2018-2025 the Deno authors. MIT license.
import { describe, expect, it } from "vitest";

import { wordSimilaritySort } from "../../src/word-similarity-sort";

describe(wordSimilaritySort, () => {
    it("handles basic example", () => {
        expect.assertions(1);

        const possibleWords = ["length", "size", "blah", "help"];
        const givenWord = "hep";

        expect(wordSimilaritySort(givenWord, possibleWords)).toStrictEqual([
            "help",
            "blah",
            "size",
            "length",
        ]);
    });

    it("with case-sensitive sorting", () => {
        expect.assertions(1);

        const possibleWords = ["length", "Size", "blah", "HELP"];
        const givenWord = "hep";

        expect(
            wordSimilaritySort(givenWord, possibleWords, { caseSensitive: true }),
        ).toStrictEqual(["blah", "HELP", "Size", "length"]);
    });

    it("handles empty string", () => {
        expect.assertions(1);

        const possibleWords = ["length", "size", "blah", "help", ""];
        const givenWord = "";

        expect(wordSimilaritySort(givenWord, possibleWords)).toStrictEqual([
            "",
            "blah",
            "help",
            "size",
            "length",
        ]);
    });

    it("handles empty array", () => {
        expect.assertions(1);

        const possibleWords: string[] = [];
        const givenWord = "";

        expect(wordSimilaritySort(givenWord, possibleWords)).toStrictEqual([]);
    });
});
