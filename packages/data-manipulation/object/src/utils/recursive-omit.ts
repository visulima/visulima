/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/recursiveOmit.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import isPlainObject from "is-plain-obj";
import type { Paths } from "type-fest";

import pathsAreEqual from "./paths-are-equal.js";

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

        if (omittedKeys.some((guardPath) => pathsAreEqual(path, guardPath as string))) {
            return carry;
        }

        // no further recursion needed
        if (!isPlainObject(value)) {
            // eslint-disable-next-line no-param-reassign
            carry[key] = value;

            return carry;
        }

        // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-explicit-any
        carry[key] = recursiveOmit<T, OmittedKeys>(object[key] as any, omittedKeys, path);

        return carry;
    }, {}) as T;
};

export default recursiveOmit;
