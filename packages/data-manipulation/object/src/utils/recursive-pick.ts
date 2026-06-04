/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/recursivePick.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import type { Paths } from "type-fest";

import isPlainObject from "./is-plain-object";
import pathsAreEqual from "./paths-are-equal";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const recursivePick = <T extends { [key in string]: unknown }, PickedKeys extends Paths<T>[]>(object: T, pickedKeys: PickedKeys, pathUntilNow = ""): T => {
    if (!isPlainObject(object)) {
        return object;
    }

    // eslint-disable-next-line unicorn/no-array-reduce
    return Object.entries(object).reduce<{ [key in string]: unknown }>((carry, [key, value]) => {
        let path = pathUntilNow;

        if (path) {
            path += ".";
        }

        path += key;

        // check pickedKeys up to this point
        if (pickedKeys.length > 0) {
            let passed = false;

            const pathPieces = path.split(".");
            const pathDepth = pathPieces.length;

            pickedKeys.forEach((pickedKey: Paths<T>) => {
                const pickedKeyPieces = (pickedKey as string).split(".");
                const pickedKeyDepth = pickedKeyPieces.length;
                const pickedKeyUpToNow = pickedKeyPieces.slice(0, pathDepth).join(".");
                const pathUpToPickedKeyDepth = pathPieces.slice(0, pickedKeyDepth).join(".");

                if (pathsAreEqual(pathUpToPickedKeyDepth, pickedKeyUpToNow)) {
                    passed = true;
                }
            });

            // there's not one pickedKey that allows up to now

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!passed) {
                return carry;
            }
        }

        // no further recursion needed
        if (!isPlainObject(value)) {
            Object.defineProperty(carry, key, { configurable: true, enumerable: true, value, writable: true });

            return carry;
        }

        Object.defineProperty(carry, key, {
            configurable: true,
            enumerable: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-argument
            value: recursivePick<T, any>(object[key] as any, pickedKeys, path),
            writable: true,
        });

        return carry;
    }, {}) as T;
};

export default recursivePick;
