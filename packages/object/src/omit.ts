/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/index.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import type { OmitDeep, Paths } from "type-fest";

import recursiveOmit from "./utils/recursive-omit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isFullArray = (input: any) => Array.isArray(input) && input.length > 0;

/**
 * omit returns a new object without the props you omit
 *
 * @export
 * @template T
 * @template K
 * @param {T} object the target object to omit props from
 * @param {K[]} keys the prop names you want to omit
 * @returns {OmitDeep<T, K>} a new object without the omitted props
 */
const omit = <T extends { [key in string]: unknown }, K extends string>(object: T, keys: Paths<T>[]): OmitDeep<T, K> => {
    if (!isFullArray(keys)) {
        return object as OmitDeep<T, K>;
    }

    return recursiveOmit(object, keys) as OmitDeep<T, K>;
};

export default omit;
