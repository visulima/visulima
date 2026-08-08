/**
 * Storing one key/value pair into a mapping: merge keys, the duplicate-key
 * policy, and the source spans `parseDocument` edits by.
 *
 * The representation itself lives in `collection-builder.ts`; nothing here knows
 * whether it is filling a plain object, a `Map` or a `YAMLMap`. Nothing here
 * touches the cursor either, so the dependency on the composer runs one way.
 */

import { keyToString } from "../nodes/nodes";
import type { MappingTarget } from "./collection-builder";
import type { State } from "./state";
import { throwError } from "./state";

const isPlainObject = (value: unknown): boolean => typeof value === "object" && value !== null && Object.prototype.toString.call(value) === "[object Object]";

/**
 * Every key of a merge source.
 *
 * The source is whatever an alias resolved to, so its shape follows the anchor,
 * not the builder — only the two native shapes reach here, because node mode
 * defers merges to `toJS`.
 */
const sourceKeys = (source: MappingTarget): unknown[] => {
    if (source instanceof Map) {
        return [...source.keys()];
    }

    return Object.keys(source);
};

const sourceGet = (source: MappingTarget, key: unknown): unknown => {
    if (source instanceof Map) {
        return source.get(key);
    }

    return (source as Record<string, unknown>)[String(key)];
};

/**
 * Splice one merge source into `destination`, leaving keys it already holds.
 *
 * Writes go through the builder, so the prototype guard applies here too —
 * routing merges around it is what previously let `&lt;&lt;` bypass the guard.
 */
const mergeMappings = (state: State, destination: MappingTarget, source: unknown, overridableKeys: Set<unknown>): void => {
    if (!isPlainObject(source) && !(source instanceof Map)) {
        throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }

    const from = source as MappingTarget;

    for (const key of sourceKeys(from)) {
        if (!state.build.has(destination, key)) {
            state.build.set(state, destination, key, sourceGet(from, key));
            overridableKeys.add(key);
        }
    }
};

/**
 * Record where one block-mapping entry sits in the source. No-op unless
 * `parseDocument` asked for ranges.
 */
const recordMappingEntry = (state: State, mapping: object, keyNode: unknown, start: number, valueStart: number, end: number): void => {
    if (state.mappingRanges === null || start < 0) {
        return;
    }

    let entries = state.mappingRanges.get(mapping);

    if (entries === undefined) {
        entries = [];
        state.mappingRanges.set(mapping, entries);
    }

    entries.push({ column: start - (state.input.lastIndexOf("\n", start - 1) + 1), end, key: keyToString(keyNode), start, valueStart });
};

/**
 * Store one key/value pair into `result`, honouring merge keys, duplicate-key
 * policy and the prototype-pollution guard. `overridableKeys` tracks keys that
 * a merge introduced (so a later explicit key may override them); it is created
 * lazily — merge keys are rare, so a merge-free mapping never allocates a Set.
 * Returns the (possibly newly created) `overridableKeys` set.
 */
const storeMappingPair = (
    state: State,
    result: MappingTarget,
    overridableKeys: Set<unknown> | undefined,
    keyTag: string | null,
    keyNode: unknown,
    valueNode: unknown,
): Set<unknown> | undefined => {
    const { build } = state;
    let keys = overridableKeys;

    if (state.options.merge !== false && build.isMergeKey(keyTag, keyNode)) {
        keys ??= new Set<unknown>();

        if (Array.isArray(valueNode)) {
            for (const item of valueNode) {
                mergeMappings(state, result, item, keys);
            }
        } else {
            mergeMappings(state, result, valueNode, keys);
        }

        return keys;
    }

    const key = build.key(state, keyNode);

    if (!keys?.has(key) && build.has(result, key)) {
        if (state.options.duplicateKeys === "error") {
            throwError(state, `duplicated mapping key "${String(key)}"`);
        } else if (state.options.duplicateKeys === "ignore") {
            return keys;
        }
    }

    build.set(state, result, key, valueNode);

    keys?.delete(key);

    return keys;
};

export { isPlainObject, recordMappingEntry, storeMappingPair };
