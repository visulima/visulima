/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/index.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import type { Paths, PickDeep } from "type-fest";

import recursivePick from "./utils/recursive-pick";
import splitPath from "./utils/split-path";

/**
 * Pick returns a new object with only the props you pick.
 *
 * Supports dot-notation for nested props (e.g. `nested.prop` keeps just
 * `{ nested: { prop: 1 } }`), `*` wildcard segments (e.g. `items.*.id`), array
 * traversal (e.g. `users.0.name` or `users.*.name`), and backslash-escaped
 * dots for keys that literally contain a `.` (e.g. `a\\.b`).
 * @template T
 * @template K
 * @param object the target object to pick props from
 * @param keys an array of prop names you want to keep
 * @returns a new object with just the picked props
 * @example
 * ```js
 * pick({ id: "1", name: "n", secret: "x" }, ["id", "name"]);
 * // => { id: "1", name: "n" }
 *
 * pick({ users: [{ name: "a", password: "p" }] }, ["users.*.name"]);
 * // => { users: [{ name: "a" }] }
 * ```
 */
const pick = <T extends { [key in string]: unknown }, const K extends Paths<T>>(object: T, keys: ReadonlyArray<K>): PickDeep<T, K> => {
    if (keys.length === 0) {
        return {} as PickDeep<T, K>;
    }

    const splitKeys = keys.map((key) => splitPath(key as string));

    return recursivePick(object, splitKeys) as PickDeep<T, K>;
};

export default pick;
