/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/index.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import type { Paths, PickDeep } from "type-fest";

import recursivePick from "./utils/recursive-pick";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isFullArray = (input: any) => Array.isArray(input) && input.length > 0;

/**
 * Pick returns a new object with only the props you pick.
 * @template T
 * @template K
 * @param object the target object to pick props from
 * @param keys an array of prop names you want to keep - allows dot-notation for nested props, eg. `nested.prop` will keep just `{ nested: { prop: 1 } }`
 * @returns a new object with just the picked props
 */
const pick = <T extends { [key in string]: unknown }, K extends Paths<T>>(object: T, keys: Paths<T>[]): PickDeep<T, K> => {
    if (!isFullArray(keys)) {
        return {} as PickDeep<T, K>;
    }

    return recursivePick(object, keys) as PickDeep<T, K>;
};

export default pick;
