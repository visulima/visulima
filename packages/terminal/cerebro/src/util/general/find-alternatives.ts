import { distance } from "fastest-levenshtein";

/**
 * Checks if two strings are similar based on substring matching and Levenshtein distance.
 */
const isSimilar = (string1: string, string2: string): boolean => {
    // Fast path: exact substring match
    if (string2.includes(string1)) {
        return true;
    }

    // Fast path: length difference too large
    const lengthDiff = Math.abs(string1.length - string2.length);

    if (lengthDiff > string1.length / 2) {
        return false;
    }

    // Calculate distance only if necessary
    return distance(string1, string2) <= string1.length / 3;
};

/**
 * Finds strings in an array that are similar to the given string.
 * @param string The target string to match against
 * @param array Array of candidate strings to search
 * @returns Array of similar strings from the input array
 */
const findAlternatives = (string: string, array: string[]): string[] => {
    const id = string.toLowerCase();

    return array.filter((nextId) => isSimilar(nextId.toLowerCase(), id));
};

export default findAlternatives;
