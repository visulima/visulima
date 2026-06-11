/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/recursivePick.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import isPlainObject from "./is-plain-object";
import { segmentsAreEqual } from "./paths-are-equal";
import safeAssign from "./safe-assign";

/**
 * Determine whether the current path is on the way to (or at) any picked key.
 *
 * A node passes when, comparing up to the shorter of the two depths, the
 * concrete path and a picked path agree (allowing `*` wildcards). This keeps a
 * branch alive while descending toward a deeper picked key.
 * @param path The segment path leading to the current node.
 * @param pickedKeys The picked paths, pre-split into segment arrays.
 * @returns `true` if the node should be kept/traversed.
 */
const pathPasses = (path: ReadonlyArray<string>, pickedKeys: ReadonlyArray<string[]>): boolean =>
    pickedKeys.some((pickedKey) => {
        const depth = Math.min(path.length, pickedKey.length);

        return segmentsAreEqual(path.slice(0, depth), pickedKey.slice(0, depth));
    });

/**
 * Recursively copy `value`, keeping only the branches that lead to one of the
 * pre-split `pickedKeys`. Plain objects and arrays are both traversed.
 * @param value The value currently being copied.
 * @param pickedKeys The picked paths, pre-split into segment arrays.
 * @param currentPath The segment path leading to `value`.
 * @returns A new value containing only the picked branches.
 */
const walk = (value: unknown, pickedKeys: ReadonlyArray<string[]>, currentPath: ReadonlyArray<string>): unknown => {
    if (Array.isArray(value)) {
        const result: unknown[] = [];

        for (const [index, element] of value.entries()) {
            const path = [...currentPath, String(index)];

            if (pickedKeys.length > 0 && !pathPasses(path, pickedKeys)) {
                continue;
            }

            result.push(walk(element, pickedKeys, path));
        }

        return result;
    }

    if (!isPlainObject(value)) {
        return value;
    }

    const carry: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
        const path = [...currentPath, key];

        if (pickedKeys.length > 0 && !pathPasses(path, pickedKeys)) {
            continue;
        }

        safeAssign(carry, key, walk(child, pickedKeys, path));
    }

    return carry;
};

/**
 * Recursively pick the given pre-split paths from a plain object or array.
 * @param object The target object to pick props from.
 * @param pickedKeys The picked paths, already split into segment arrays.
 * @returns A new object/array with only the picked props.
 */
const recursivePick = <T extends { [key in string]: unknown }>(object: T, pickedKeys: ReadonlyArray<string[]>): T =>
    walk(object, pickedKeys, []) as T;

export default recursivePick;
