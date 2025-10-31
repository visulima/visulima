import { distance } from "fastest-levenshtein";

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

const findAlternatives = (string: string, array: string[]): string[] => {
    const id = string.toLowerCase();

    return array.filter((nextId) => isSimilar(nextId.toLowerCase(), id));
};

export default findAlternatives;
