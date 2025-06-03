import { distance as levenshteinDistance } from "./levenshtein";

/** Options for {@linkcode compareSimilarity}. */
export interface CompareSimilarityOptions {
    /**
     * Whether the distance should include case.
     * @default {false}
     */
    caseSensitive?: boolean;

    /**
     * A custom comparison function to use for comparing strings.
     * @param a The first string for comparison.
     * @param b The second string for comparison.
     * @returns The distance between the two strings.
     * @default {levenshteinDistance}
     */
    compareFn?: (a: string, b: string) => number;
}

/**
 * Takes a string and generates a comparator function to determine which of two
 * strings is more similar to the given one.
 *
 * By default, calculates the distance between words using the
 * {@link https://en.wikipedia.org/wiki/Levenshtein_distance | Levenshtein distance}.
 * @param givenWord The string to measure distance against.
 * @param options Options for the sort.
 * @returns The difference in distance. This will be a negative number if `a`
 * is more similar to `givenWord` than `b`, a positive number if `b` is more
 * similar, or `0` if they are equally similar.
 * @example Usage
 *
 * Most-similar words will be at the start of the array.
 *
 * ```ts
 * import { compareSimilarity } from "@visulima/string";
 * import assert from "node:assert";
 *
 * const words = ["hi", "hello", "help"];
 * const sortedWords = words.toSorted(compareSimilarity("hep"));
 *
 * assert.deepStrictEqual(sortedWords, ["help", "hi", "hello"]);
 * ```
 */
export const compareSimilarity = (
    givenWord: string,
    options?: CompareSimilarityOptions,
): (a: string, b: string) => number => {
    const { compareFn: compareFunction = levenshteinDistance } = { ...options };

    if (options?.caseSensitive) {
        return (a: string, b: string) =>
            compareFunction(givenWord, a) - compareFunction(givenWord, b);
    }

    // eslint-disable-next-line no-param-reassign
    givenWord = givenWord.toLowerCase();

    return (a: string, b: string) =>
        compareFunction(givenWord, a.toLowerCase())
        - compareFunction(givenWord, b.toLowerCase());
};
