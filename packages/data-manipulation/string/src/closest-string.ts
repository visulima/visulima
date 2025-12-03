import { distance as levenshteinDistance } from "./levenshtein";

/** Options for {@linkcode closestString}. */
export interface ClosestStringOptions {
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
 * Finds the most similar string from an array of strings.
 *
 * By default, calculates the distance between words using the
 * {@link https://en.wikipedia.org/wiki/Levenshtein_distance | Levenshtein distance}.
 * @example Usage
 * ```ts
 * import { closestString } from "@visulima/string";
 * import assert from "node:assert";
 *
 * const possibleWords = ["length", "size", "blah", "help"];
 * const suggestion = closestString("hep", possibleWords);
 *
 * assert.deepStrictEqual(suggestion, "help");
 * ```
 * @param givenWord The string to measure distance against
 * @param possibleWords The string-array to pick the closest string from
 * @param options The options for the comparison.
 * @returns The closest string from `possibleWords`, or `undefined` if `possibleWords` is empty (though the function throws in this case).
 */
export const closestString = (
    givenWord: string,
    possibleWords: ReadonlyArray<string>,
    options?: ClosestStringOptions,
): string | undefined => {
    if (possibleWords.length === 0) {
        throw new TypeError(
            "When using closestString(), the possibleWords array must contain at least one word",
        );
    }

    const { caseSensitive, compareFn: compareFunction = levenshteinDistance } = { ...options };

    if (!caseSensitive) {
        // eslint-disable-next-line no-param-reassign
        givenWord = givenWord.toLowerCase();
    }

    let nearestWord = possibleWords[0] ?? undefined;
    let closestStringDistance = Infinity;

    for (const each of possibleWords) {
        const distance = caseSensitive
            ? compareFunction(givenWord, each)
            : compareFunction(givenWord, each.toLowerCase());

        if (distance < closestStringDistance) {
            nearestWord = each;
            closestStringDistance = distance;
        }
    }

    return nearestWord;
};
