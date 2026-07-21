/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/recursiveOmit.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import copySymbols from "./copy-symbols";
import isPlainObject from "./is-plain-object";
import narrow from "./narrow";
import safeAssign from "./safe-assign";

/**
 * Copy an array, dropping any element whose remaining path tail is fully
 * consumed while preserving the array shape for the kept elements.
 * @param value The array currently being copied.
 * @param tails The omit-path tails still relevant at this node.
 * @returns A new array with the omitted elements removed.
 */
const walkArray = (value: unknown[], tails: ReadonlyArray<ReadonlyArray<string>>): unknown => {
    const result: unknown[] = [];

    for (const [index, element] of value.entries()) {
        const childTails = narrow(tails, String(index));

        if (childTails.some((tail) => tail.length === 0)) {
            // Skip omitted elements while keeping the array shape.
            continue;
        }

        // `walk` is a module-level sibling; the mutual reference resolves at
        // call time, so there is no temporal-dead-zone hazard here.
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        result.push(walk(element, childTails));
    }

    return result;
};

/**
 * Copy a plain object, dropping any property whose remaining path tail is
 * fully consumed.
 * @param value The object currently being copied.
 * @param tails The omit-path tails still relevant at this node.
 * @returns A new object with the omitted properties removed.
 */
const walkObject = (value: Record<string, unknown>, tails: ReadonlyArray<ReadonlyArray<string>>): unknown => {
    const carry: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
        const childTails = narrow(tails, key);

        if (childTails.some((tail) => tail.length === 0)) {
            continue;
        }

        // `walk` is a module-level sibling; the mutual reference resolves at
        // call time, so there is no temporal-dead-zone hazard here.
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        safeAssign(carry, key, walk(child, childTails));
    }

    copySymbols(value, carry);

    return carry;
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
        return walkArray(value, tails);
    }

    if (!isPlainObject(value)) {
        return value;
    }

    return walkObject(value, tails);
};

/**
 * Recursively omit the given pre-split paths from a plain object or array.
 * @param object The target object to omit props from.
 * @param omittedKeys The omitted paths, already split into segment arrays.
 * @returns A new object/array without the omitted props.
 */
const recursiveOmit = <T extends { [key in string]: unknown }>(object: T, omittedKeys: ReadonlyArray<string[]>): T => walk(object, omittedKeys) as T;

export default recursiveOmit;
