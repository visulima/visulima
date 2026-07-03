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
 *
 * Unlike the loose variant, strict mode also deep-clones object keys (matching the
 * behaviour of the structured-clone algorithm) so that mutating a key object after
 * cloning cannot corrupt the source map.
 */
export const copyMapStrict = <Value extends Map<unknown, unknown>>(map: Value, state: State): Value => {
    const clone = new Map() as Value;

    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(map, clone);

    map.forEach((value, key) => {
        clone.set(state.clone(key, state), state.clone(value, state));
    });

    return copyOwnProperties(map, clone, state);
};
