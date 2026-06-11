/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/recursiveOmit.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import isPlainObject from "./is-plain-object";
import { segmentsAreEqual } from "./paths-are-equal";
import safeAssign from "./safe-assign";

/**
 * Copy the enumerable symbol-keyed own properties from `source` onto `target`.
 *
 * String paths can never target symbol keys, so they are always preserved
 * verbatim (matching lodash's `omit`).
 * @param source The object to read symbol properties from.
 * @param target The object to copy symbol properties onto.
 */
const copySymbols = (source: object, target: Record<PropertyKey, unknown>): void => {
    for (const symbol of Object.getOwnPropertySymbols(source)) {
        const descriptor = Object.getOwnPropertyDescriptor(source, symbol);

        if (descriptor?.enumerable) {
            // eslint-disable-next-line no-param-reassign
            target[symbol] = (source as Record<PropertyKey, unknown>)[symbol];
        }
    }
};

/**
 * Recursively copy `value`, dropping any property whose path matches one of
 * the pre-split `omittedKeys`. Plain objects and arrays are both traversed.
 * @param value The value currently being copied.
 * @param omittedKeys The omitted paths, pre-split into segment arrays.
 * @param currentPath The segment path leading to `value`.
 * @returns A new value with the omitted paths removed.
 */
const walk = (value: unknown, omittedKeys: ReadonlyArray<string[]>, currentPath: ReadonlyArray<string>): unknown => {
    if (Array.isArray(value)) {
        const result: unknown[] = [];

        for (const [index, element] of value.entries()) {
            const path = [...currentPath, String(index)];

            if (omittedKeys.some((guardPath) => segmentsAreEqual(path, guardPath))) {
                // Skip omitted elements while keeping the array shape.
                continue;
            }

            result.push(walk(element, omittedKeys, path));
        }

        return result;
    }

    if (!isPlainObject(value)) {
        return value;
    }

    const carry: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
        const path = [...currentPath, key];

        if (omittedKeys.some((guardPath) => segmentsAreEqual(path, guardPath))) {
            continue;
        }

        safeAssign(carry, key, walk(child, omittedKeys, path));
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
const recursiveOmit = <T extends { [key in string]: unknown }>(object: T, omittedKeys: ReadonlyArray<string[]>): T =>
    walk(object, omittedKeys, []) as T;

export default recursiveOmit;
