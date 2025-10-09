/**
 * @packageDocumentation
 * Deep equality helper that compares two objects while ignoring specified keys.
 */
import { isDeepStrictEqual } from "node:util";

/**
 * Compare two objects for deep equality while ignoring selected keys.
 */
const isEqual = (a: object, b: object, ...keysToIgnore: string[]): boolean =>
    isDeepStrictEqual(
        Object.entries(a).filter((value) => !keysToIgnore.includes(value[0])),
        Object.entries(b).filter((value) => !keysToIgnore.includes(value[0])),
    );

export default isEqual;
