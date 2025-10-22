/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/recursivePick.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import isPlainObject from "is-plain-obj";
import type { Paths } from "type-fest";

import pathsAreEqual from "./paths-are-equal";

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

            pickedKeys.forEach((pickedKey: Paths<T>) => {
                const pathDepth = path.split(".").length;
                const pickedKeyDepth = (pickedKey as string).split(".").length;
                const pickedKeyUpToNow = (pickedKey as string).split(".").slice(0, pathDepth).join(".");
                const pathUpToPickedKeyDepth = path.split(".").slice(0, pickedKeyDepth).join(".");

                if (pathsAreEqual(pathUpToPickedKeyDepth, pickedKeyUpToNow)) {
                    passed = true;
                }
            });

            // there's not one pickedKey that allows up to now

            if (!passed) {
                return carry;
            }
        }

        // no further recursion needed
        if (!isPlainObject(value)) {
            // eslint-disable-next-line no-param-reassign
            carry[key] = value;

            return carry;
        }

        // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-explicit-any
        carry[key] = recursivePick<T, PickedKeys>(object[key] as any, pickedKeys, path);

        return carry;
    }, {}) as T;
};

export default recursivePick;
