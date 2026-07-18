/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/recursiveOmit.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import copySymbols from "./copy-symbols";
import isPlainObject from "./is-plain-object";
import safeAssign from "./safe-assign";

/**
 * Narrow the remaining path tails to those still relevant one level below `key`.
 *
 * A tail stays alive when its first segment matches `key` (or is a `*`
 * wildcard); the matched segment is then dropped so the child receives the
 * remainder. An empty resulting tail marks the child as fully targeted.
 * @param tails The remaining omit-path tails at the current node.
 * @param key The concrete child key being descended into.
 * @returns The tails that still apply below `key`.
 */
const narrow = (tails: ReadonlyArray<ReadonlyArray<string>>, key: string): ReadonlyArray<string>[] => {
    const next: ReadonlyArray<string>[] = [];

    for (const tail of tails) {
        const [head] = tail;

        if (head === "*" || head === key) {
            next.push(tail.slice(1));
        }
    }

    return next;
};

/**
 * Recursively copy `value`, dropping any property whose remaining path tail is
 * fully consumed. Plain objects and arrays are both traversed.
 * @param value The value currently being copied.
 * @param tails The omit-path tails still relevant at this node.
 * @returns A new value with the omitted paths removed.
 */
const walk = (value: unknown, tails: ReadonlyArray<ReadonlyArray<string>>): unknown => {
    if (Array.isArray(value)) {
        const result: unknown[] = [];

        for (const [index, element] of value.entries()) {
            const childTails = narrow(tails, String(index));

            if (childTails.some((tail) => tail.length === 0)) {
                // Skip omitted elements while keeping the array shape.
                continue;
            }

            result.push(walk(element, childTails));
        }

        return result;
    }

    if (!isPlainObject(value)) {
        return value;
    }

    const carry: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
        const childTails = narrow(tails, key);

        if (childTails.some((tail) => tail.length === 0)) {
            continue;
        }

        safeAssign(carry, key, walk(child, childTails));
    }

    copySymbols(value, carry);

    return carry;
};

/**
 * Recursively omit the given pre-split paths from a plain object or array.
 * @param object The target object to omit props from.
 * @param omittedKeys The omitted paths, already split into segment arrays.
 * @returns A new object/array without the omitted props.
 */
const recursiveOmit = <T extends { [key in string]: unknown }>(object: T, omittedKeys: ReadonlyArray<string[]>): T => walk(object, omittedKeys) as T;

export default recursiveOmit;
