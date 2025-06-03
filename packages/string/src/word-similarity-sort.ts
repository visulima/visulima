import { distance as levenshteinDistance } from "./levenshtein"; // Assuming this import path

/** Options for {@linkcode wordSimilaritySort}. */
export interface WordSimilaritySortOptions {
    caseSensitive?: boolean;
    compareFunction?: (a: string, b: string) => number;
}

/**
 * Sorts a string-array by similarity to a given string.
 *
 * By default, calculates the distance between words using the
 * {@link https://en.wikipedia.org/wiki/Levenshtein_distance | Levenshtein distance}.
 * @example Basic usage
 *
 * ```ts
 * import { wordSimilaritySort } from "@visulima/string";
 * import assert from "node:assert";
 *
 * const possibleWords = ["length", "size", "blah", "help"];
 * const suggestions = wordSimilaritySort("hep", possibleWords);
 *
 * assert.deepStrictEqual(suggestions, ["help", "size", "blah", "length"]);
 * ```
 * @example Case-sensitive sorting
 *
 * ```ts
 * import { wordSimilaritySort } from "@visulima/string";
 * import assert from "node:assert";
 *
 * const possibleWords = ["length", "Size", "blah", "HELP"];
 * const suggestions = wordSimilaritySort("hep", possibleWords, { caseSensitive: true });
 *
 * assert.deepStrictEqual(suggestions, ["Size", "blah", "HELP", "length"]);
 * ```
 * @param givenWord The string to measure distance against.
 * @param possibleWords The string-array that will be sorted. This array will
 * not be mutated, but the sorted copy will be returned.
 * @param options Options for the sort.
 * @returns A sorted copy of `possibleWords`.
 */
export const wordSimilaritySort = (
    givenWord: string,
    possibleWords: ReadonlyArray<string>,
    options?: WordSimilaritySortOptions,
): string[] => {
    const { caseSensitive = false, compareFunction = levenshteinDistance } = options ?? {};

    const processedGivenWord = caseSensitive ? givenWord : givenWord.toLowerCase();

    // Step 1 & 2: Pre-process words and calculate their distances to the givenWord
    const wordsWithDistances = possibleWords.map((word) => {
        const processedWord = caseSensitive ? word : word.toLowerCase();

        return {
            distance: compareFunction(processedGivenWord, processedWord),
            originalWord: word,
        };
    });

    // Step 3: Sort based on pre-calculated distance.
    // If distances are equal, sort alphabetically by the original word for a stable and deterministic output.
    wordsWithDistances.sort((a, b) => {
        if (a.distance !== b.distance) {
            return a.distance - b.distance;
        }

        // Tie-breaking: sorts alphabetically by original word.
        return a.originalWord.localeCompare(b.originalWord);
    });

    // Step 4: Map back to original words
    return wordsWithDistances.map((item) => item.originalWord);
};
