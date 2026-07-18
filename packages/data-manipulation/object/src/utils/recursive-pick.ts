/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/recursivePick.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import copySymbols from "./copy-symbols";
import isPlainObject from "./is-plain-object";
import safeAssign from "./safe-assign";

/**
 * Sentinel returned when a branch contributes nothing to the picked result, so
 * the parent can drop the key entirely instead of keeping an empty shell.
 */
const NOTHING = Symbol("nothing");

/**
 * Narrow the remaining path tails to those still relevant one level below `key`.
 *
 * A tail stays alive when its first segment matches `key` (or is a `*`
 * wildcard); the matched segment is then dropped so the child receives the
 * remainder. An empty resulting tail marks the child as fully picked.
 * @param tails The remaining pick-path tails at the current node.
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
 * Deep-copy a fully picked branch. Plain objects and arrays are cloned;
 * primitives and non-plain values are returned as-is, matching the copy
 * behaviour used elsewhere. Enumerable symbol keys are preserved.
 * @param value The value to copy.
 * @returns A structural copy of `value`.
 */
const deepCopy = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((element) => deepCopy(element));
    }

    if (!isPlainObject(value)) {
        return value;
    }

    const carry: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
        safeAssign(carry, key, deepCopy(child));
    }

    copySymbols(value, carry);

    return carry;
};

/**
 * Recursively copy `value`, keeping only the branches that lead to one of the
 * remaining pick-path `tails`. Plain objects and arrays are both traversed.
 * A tail reaching length zero marks the whole branch as picked.
 * @param value The value currently being copied.
 * @param tails The pick-path tails still relevant at this node.
 * @returns A new value with only the picked branches, or `NOTHING`.
 */
const walk = (value: unknown, tails: ReadonlyArray<ReadonlyArray<string>>): unknown => {
    if (tails.some((tail) => tail.length === 0)) {
        return deepCopy(value);
    }

    if (Array.isArray(value)) {
        const result: unknown[] = [];

        for (const [index, element] of value.entries()) {
            const childTails = narrow(tails, String(index));

            if (childTails.length === 0) {
                continue;
            }

            const child = walk(element, childTails);

            if (child !== NOTHING) {
                result.push(child);
            }
        }

        return result.length > 0 ? result : NOTHING;
    }

    if (!isPlainObject(value)) {
        return NOTHING;
    }

    const carry: Record<string, unknown> = {};
    let kept = false;

    for (const [key, child] of Object.entries(value)) {
        const childTails = narrow(tails, key);

        if (childTails.length === 0) {
            continue;
        }

        const result = walk(child, childTails);

        if (result !== NOTHING) {
            safeAssign(carry, key, result);
            kept = true;
        }
    }

    return kept ? carry : NOTHING;
};

/**
 * Recursively pick the given pre-split paths from a plain object or array.
 * @param object The target object to pick props from.
 * @param pickedKeys The picked paths, already split into segment arrays.
 * @returns A new object/array with only the picked props.
 */
const recursivePick = <T extends { [key in string]: unknown }>(object: T, pickedKeys: ReadonlyArray<string[]>): T => {
    const result = walk(object, pickedKeys);

    if (result !== NOTHING) {
        return result as T;
    }

    // A non-traversable root (a primitive or non-plain value) is returned
    // unchanged; a plain object/array root that matched nothing yields `{}`.
    return (isPlainObject(object) || Array.isArray(object) ? {} : object) as T;
};

export default recursivePick;
