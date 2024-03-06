import { distance } from "fastest-levenshtein";

const isSimilar = (string1: string, string2: string) => distance(string1, string2) <= string1.length / 3 || string2.includes(string1);

const findAlternatives = (string: string, array: string[]): string[] => {
    const id = string.toLowerCase();

    return array.filter((nextId) => isSimilar(nextId.toLowerCase(), id));
};

export default findAlternatives;
