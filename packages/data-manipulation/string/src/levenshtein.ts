/* eslint-disable import/no-extraneous-dependencies */
import { distance } from "fastest-levenshtein";

export const closestN = (string_: string, array: ReadonlyArray<string>, n: number): (string | undefined)[] => {
    const distances = Array.from({ length: n }).fill(Infinity) as number[];
    const values = Array.from({ length: n }).fill(undefined) as (string | undefined)[];

    for (const element of array) {
        const candidateValue = element;
        let currentDistance = distance(string_, candidateValue);
        let currentValue: string | undefined = candidateValue;

        for (let index = 0; index < n; index += 1) {
            if (currentDistance < (distances[index] as number)) {
                const temporaryDistance = distances[index] as number;
                const temporaryValue = values[index];

                distances[index] = currentDistance;
                values[index] = currentValue;
                currentDistance = temporaryDistance;
                currentValue = temporaryValue;
            }
        }
    }

    return values;
};

export { closest, distance } from "fastest-levenshtein";

// `distance` is also imported as a value at the top of the file for use below.

/**
 * Computes a normalized similarity score between two strings in the range `[0, 1]`,
 * where `1` means the strings are identical and `0` means maximally different.
 *
 * The score is derived from the Levenshtein edit distance, normalized by the
 * length of the longer string: `1 - distance(a, b) / max(a.length, b.length)`.
 * Two empty strings are considered identical (`1`).
 *
 * This is convenient for threshold-based "did you mean?" UX, complementing the
 * raw {@link distance} and the sort-based helpers.
 * @example
 * ```typescript
 * similarity("kitten", "sitting"); // => ~0.571
 * similarity("foo", "foo");        // => 1
 * similarity("", "");              // => 1
 * ```
 * @param a The first string.
 * @param b The second string.
 * @returns A similarity score between 0 and 1 (inclusive).
 */
export const similarity = (a: string, b: string): number => {
    if (a === b) {
        return 1;
    }

    const maxLength = Math.max(a.length, b.length);

    if (maxLength === 0) {
        return 1;
    }

    return 1 - distance(a, b) / maxLength;
};
