import type { State } from "../types";
import copyOwnProperties from "../utils/copy-own-properties";

export const copyMapLoose = <Value extends Map<unknown, unknown>>(map: Value, state: State): Value => {
    const clone = new Map() as Value;

    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(map, clone);

    map.forEach((value, key) => {
        clone.set(key, state.clone(value, state));
    });

    return clone;
};

/**
 * Deeply copy the keys and values of the original, as well as any custom properties.
 */
export const copyMapStrict = <Value extends Map<unknown, unknown>>(map: Value, state: State): Value =>
    copyOwnProperties(map, copyMapLoose<Value>(map, state), state);
