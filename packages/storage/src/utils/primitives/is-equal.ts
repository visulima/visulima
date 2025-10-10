import { isDeepStrictEqual } from "node:util";

/**
 * Deep equality check for objects, with optional keys to ignore.
 * @param a First object to compare
 * @param b Second object to compare
 * @param keysToIgnore Keys to exclude from comparison
 * @returns True if objects are equal (excluding ignored keys)
 */
const isEqual = (a: object, b: object, ...keysToIgnore: string[]): boolean =>
    isDeepStrictEqual(
        Object.entries(a).filter((value) => !keysToIgnore.includes(value[0])),
        Object.entries(b).filter((value) => !keysToIgnore.includes(value[0])),
    );

export default isEqual;
