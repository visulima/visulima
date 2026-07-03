/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/index.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import type { OmitDeep, Paths } from "type-fest";

import recursiveOmit from "./utils/recursive-omit";
import splitPath from "./utils/split-path";

/**
 * Omit returns a new object without the props you omit.
 *
 * Supports dot-notation for nested props (e.g. `nested.prop`), `*` wildcard
 * segments (e.g. `items.*.secret`), array traversal (e.g. `users.0.password`
 * or `users.*.password`), and backslash-escaped dots for keys that literally
 * contain a `.` (e.g. `a\\.b`). Symbol-keyed properties are always preserved.
 * @template T
 * @template K
 * @param object the target object to omit props from
 * @param keys the prop names you want to omit
 * @returns a new object without the omitted props
 * @example
 * ```js
 * omit({ id: "1", name: "n", secret: "x" }, ["secret"]);
 * // => { id: "1", name: "n" }
 *
 * omit({ users: [{ name: "a", password: "p" }] }, ["users.*.password"]);
 * // => { users: [{ name: "a" }] }
 * ```
 */
const omit = <T extends { [key in string]: unknown }, const K extends Paths<T>>(object: T, keys: ReadonlyArray<K>): OmitDeep<T, K> => {
    const splitKeys = keys.map((key) => splitPath(key as string));

    // Always returns a fresh deep copy (even for an empty key list) so the
    // result never shares structure with `object`.
    return recursiveOmit(object, splitKeys) as OmitDeep<T, K>;
};

export default omit;
