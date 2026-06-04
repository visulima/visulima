/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/recursiveOmit.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import type { Paths } from "type-fest";

import isPlainObject from "./is-plain-object";
import pathsAreEqual from "./paths-are-equal";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const recursiveOmit = <T extends { [key in string]: unknown }, OmittedKeys extends Paths<T>[]>(object: T, omittedKeys: OmittedKeys, pathUntilNow = ""): T => {
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

        if (omittedKeys.some((guardPath) => pathsAreEqual(path, guardPath))) {
            return carry;
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
            value: recursiveOmit<T, any>(object[key] as any, omittedKeys, path),
            writable: true,
        });

        return carry;
    }, {}) as T;
};

export default recursiveOmit;
